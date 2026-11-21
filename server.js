'use strict';
/**
 * دار تبيان لعلوم القرآن — الخادم
 * بلا اعتماديات خارجية (Node 18+).
 * التخزين: db.json (الأساس: مستخدمون/طلاب/مجموعات/حصص) + logs.jsonl + messages.jsonl (تُلحَق سطراً بسطر).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { solveWithDiagnosis, validatePlacement } = require('./lib/scheduler');
const { SURAHS, coverage } = require('./lib/quran');
const { LogStore, MsgStore } = require('./lib/store');
const sec = require('./lib/security');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DB_FILE = path.join(DATA_DIR, 'db.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
sec.auditInit(DATA_DIR);

/* ============================== التخزين ============================== */
const STAGES = ['primary', 'prep', 'secondary'];
const GENDERS = ['boys', 'girls'];
const SLOT_TYPES = ['hifz', 'review', 'tajweed', 'educational', 'kuttab', 'other'];
const EVENT_TYPES = ['exam', 'kuttab', 'educational', 'trip', 'meeting', 'other'];
const ATT = ['present', 'late', 'absent', 'excused'];

function defaultSettings() {
  const days = [6, 0, 1, 2, 3, 4];
  return {
    center: { name: 'دار تبيان لعلوم القرآن', phone: '', whatsapp: '', address: '', about: '', countryCode: '20' },
    timezone: 'Africa/Cairo', autoApprove: false,
    schedule: { availability: days.map((day) => ({ day, from: 16 * 60, to: 21 * 60 })), blocked: [], bufferMin: 10, granularityMin: 15, maxDailyMin: 300 },
    stageWindows: { primary: { from: 15 * 60, to: 20 * 60 }, prep: { from: 16 * 60, to: 21 * 60 }, secondary: { from: 17 * 60, to: 22 * 60 } },
  };
}
const emptyDb = () => ({ v: 2, created: Date.now(), settings: defaultSettings(), users: {}, students: {}, groups: {}, slots: {}, events: {}, sessions: {} });
let db;
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {
  if (e.code !== 'ENOENT') { console.error('تعذّر قراءة قاعدة البيانات:', e.message, '\nلن يُكتب فوقها. أصلح الملف أو استرجع نسخة من data/backups.'); process.exit(1); }
  db = emptyDb();
}
for (const k of Object.keys(emptyDb())) if (db[k] === undefined) db[k] = emptyDb()[k];
const logStore = new LogStore(path.join(DATA_DIR, 'logs.jsonl'));
const msgStore = new MsgStore(path.join(DATA_DIR, 'messages.jsonl'));
// ترحيل من الصيغة القديمة (كل شيء في db.json)
if (db.logs || db.messages) {
  logStore.setMany(Object.values(db.logs || {}));
  for (const m of db.messages || []) msgStore.add(m);
  delete db.logs; delete db.messages;
}

let saveTimer = null;
function save() { touch(); if (!saveTimer) saveTimer = setTimeout(() => { saveTimer = null; flush(); }, 800); }
function flush() {
  try {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
    dailyBackup();
  } catch (e) { console.error('فشل الحفظ:', e.message); }
}
function dailyBackup() {
  const day = new Date().toISOString().slice(0, 10), dir = path.join(DATA_DIR, 'backups'), dest = path.join(dir, day);
  if (fs.existsSync(dest)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ['db.json', 'logs.jsonl', 'messages.jsonl']) { try { fs.copyFileSync(path.join(DATA_DIR, f), path.join(dest, f)); } catch { /* غير موجود بعد */ } }
  const olds = fs.readdirSync(dir).sort().slice(0, -14);
  for (const o of olds) fs.rmSync(path.join(dir, o), { recursive: true, force: true });
}
function shutdown() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } flush(); process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
process.on('uncaughtException', (e) => console.error('uncaughtException', e));
if (db.logs === undefined && !fs.existsSync(DB_FILE)) flush();

/* ============================== الفهارس ============================== */
let idx = null;
function touch() { idx = null; }
function getIdx() {
  if (idx) return idx;
  const I = { phone: new Map(), user: new Map(), cal: new Map(), code: new Map(), byParent: new Map(), byGroup: new Map(), sheikh: null };
  for (const u of Object.values(db.users)) {
    I.cal.set(u.calToken, u);
    if (u.role === 'parent') I.phone.set(u.phone, u);
    if (u.role === 'sheikh') { I.user.set(u.username, u); I.sheikh = u; }
  }
  for (const s of Object.values(db.students)) {
    I.code.set(s.code, s);
    if (!I.byParent.has(s.parentId)) I.byParent.set(s.parentId, []);
    I.byParent.get(s.parentId).push(s);
    if (s.status === 'active') for (const g of s.groupIds) { if (!I.byGroup.has(g)) I.byGroup.set(g, []); I.byGroup.get(g).push(s); }
  }
  return (idx = I);
}

/* ============================== أدوات ============================== */
const uid = (p) => p + crypto.randomBytes(6).toString('hex');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const now = () => Date.now();
class HttpError extends Error { constructor(code, msg, extra) { super(msg); this.code = code; this.extra = extra; } }
const fail = (code, msg, extra) => { throw new HttpError(code, msg, extra); };
const AR_DIGITS = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9, '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9 };
function normPhone(s) {
  let t = String(s || '').replace(/[٠-٩۰-۹]/g, (c) => AR_DIGITS[c]).replace(/[^\d+]/g, '');
  if (t.startsWith('+')) t = t.slice(1); else if (t.startsWith('00')) t = t.slice(2); else if (t.startsWith('0')) return t.length >= 8 && t.length <= 15 ? t : null;
  if (t.startsWith('20') && t.length === 12) t = '0' + t.slice(2);
  return t.length >= 8 && t.length <= 15 ? t : null;
}
const S = (v, max = 200) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
function I(v, min, max, def) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; }
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
const dateOk = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
const CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newStudentCode() {
  for (;;) {
    let c = ''; const b = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) c += CODE_ALPHA[b[i] % CODE_ALPHA.length];
    if (!getIdx().code.has(c)) return c;
  }
}
const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
let fmtCache = null;
function todayStr() {
  try {
    if (!fmtCache || fmtCache.tz !== db.settings.timezone) fmtCache = { tz: db.settings.timezone, f: new Intl.DateTimeFormat('en-CA', { timeZone: db.settings.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }) };
    return fmtCache.f.format(new Date());
  } catch { return new Date().toISOString().slice(0, 10); }
}
function addDays(ds, n) { const [y, m, d] = ds.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
function weekdayOf(ds) { const [y, m, d] = ds.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const mins = (s) => (s >= 90 ? `${Math.ceil(s / 60)} دقيقة` : `${s} ثانية`);

/* ============================== الجلسات ============================== */
const SESSION_MS = 30 * 86400000, SESSION_MAX_MS = 90 * 86400000, MAX_SESSIONS = 8;
function createSession(userId) {
  const mine = Object.entries(db.sessions).filter(([, s]) => s.userId === userId).sort((a, b) => a[1].created - b[1].created);
  while (mine.length >= MAX_SESSIONS) delete db.sessions[mine.shift()[0]];
  const tok = crypto.randomBytes(32).toString('hex');
  db.sessions[sha(tok)] = { userId, created: now(), exp: now() + SESSION_MS };
  save(); return tok;
}
function userFromToken(tok) {
  if (!tok) return null;
  const k = sha(tok), s = db.sessions[k];
  if (!s) return null;
  const t = now();
  if (s.exp < t || t - s.created > SESSION_MAX_MS) { delete db.sessions[k]; return null; }
  if (s.exp - t < SESSION_MS - 5 * 86400000) s.exp = t + SESSION_MS;
  return db.users[s.userId] || null;
}
function revokeUser(userId, exceptKey) { for (const [k, s] of Object.entries(db.sessions)) if (s.userId === userId && k !== exceptKey) delete db.sessions[k]; }
setInterval(() => { const t = now(); for (const [k, s] of Object.entries(db.sessions)) if (s.exp < t) delete db.sessions[k]; for (const [k, v] of tickets) if (v.exp < t) tickets.delete(k); }, 600000).unref();
const tickets = new Map();
const sheikhExists = () => !!getIdx().sheikh;
let SETUP_CODE = process.env.SETUP_CODE || '';
if (!sheikhExists() && !SETUP_CODE) {
  const f = path.join(DATA_DIR, 'SETUP_CODE.txt');
  try { SETUP_CODE = fs.readFileSync(f, 'utf8').trim(); } catch { /* new */ }
  if (!SETUP_CODE) { SETUP_CODE = crypto.randomInt(100000, 999999).toString(); fs.writeFileSync(f, SETUP_CODE + '\n'); }
}

/* ============================== صلاحيات وبيانات ============================== */
const isSheikh = (u) => u.role === 'sheikh';
function myStudents(u) {
  if (isSheikh(u)) return Object.values(db.students);
  if (u.role === 'parent') return getIdx().byParent.get(u.id) || [];
  const s = db.students[u.studentId]; return s ? [s] : [];
}
const canSeeStudent = (u, s) => isSheikh(u) || (u.role === 'parent' && s.parentId === u.id) || (u.role === 'student' && u.studentId === s.id);
function canChat(u, gid) {
  const g = db.groups[gid]; if (!g) return false;
  if (isSheikh(u)) return true;
  if (!myStudents(u).some((s) => s.status === 'active' && s.groupIds.includes(gid))) return false;
  return u.role === 'student' ? g.allowStudentChat !== false : true;
}
const studentGet = (id) => db.students[id] || fail(404, 'الطالب غير موجود');
function mustSee(u, id) { const s = studentGet(id); if (!canSeeStudent(u, s)) fail(403, 'غير مصرّح'); return s; }
const groupMembers = (gid) => getIdx().byGroup.get(gid) || [];

const statsCache = new Map();
function statsFor(s) {
  const today = todayStr(), key = today + '|' + (logStore.ver.get(s.id) || 0);
  const c = statsCache.get(s.id); if (c && c.k === key) return c.v;
  const logs = logStore.forStudent(s.id), since = addDays(today, -30);
  const cnt = { present: 0, late: 0, absent: 0, excused: 0 }; let n30 = 0;
  for (const l of logs) { if (l.date < since) break; cnt[l.attendance]++; n30++; }
  const counted = cnt.present + cnt.late + cnt.absent;
  const avg = (k) => { const v = []; for (let i = 0; i < logs.length && i < 20; i++) if (logs[i][k] > 0) v.push(logs[i][k]); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
  const cov = coverage(logs.filter((l) => l.memo && l.memo.kind === 'new').map((l) => ({ surah: l.memo.surah, from: l.memo.from, to: l.memo.to })));
  let absentStreak = 0; for (const l of logs) { if (l.attendance === 'absent') absentStreak++; else if (l.attendance === 'excused') continue; else break; }
  let presentStreak = 0; for (const l of logs) { if (l.attendance === 'present') presentStreak++; else if (l.attendance === 'excused') continue; else break; }
  const v = {
    counts: cnt, sessions30: n30, attendanceRate: counted ? Math.round(((cnt.present + cnt.late) / counted) * 100) : null,
    punctuality: cnt.present + cnt.late ? Math.round((cnt.present / (cnt.present + cnt.late)) * 100) : null,
    behavior: avg('behavior'), commitment: avg('commitment'), newAyahs: cov.total, percent: cov.percent, absentStreak, presentStreak,
    last: logs[0] ? { date: logs[0].date, attendance: logs[0].attendance, memo: logs[0].memo || null, note: logs[0].note || '' } : null,
  };
  statsCache.set(s.id, { k: key, v }); return v;
}
function publicStudent(s, u) {
  const o = {
    id: s.id, name: s.name, age: s.age, gender: s.gender, stage: s.stage, surah: s.surah, ayah: s.ayah || 0, baseJuz: s.baseJuz || 0,
    status: s.status, groupIds: s.groupIds, busy: s.busy || [], note: s.note || '', parentId: s.parentId, created: s.created, stats: statsFor(s),
  };
  if (u.role !== 'student') o.code = s.code;
  // الخصوصية: رقم الهاتف لا يخرج إلا للشيخ، أو لولي الأمر صاحب الحساب نفسه.
  if (isSheikh(u) || (u.role === 'parent' && s.parentId === u.id)) { const p = db.users[s.parentId]; if (p) o.parent = { name: p.name, phone: p.phone }; }
  if (isSheikh(u)) o.privateNote = s.privateNote || '';
  return o;
}
function bootstrap(u) {
  const studs = myStudents(u);
  const gids = new Set(isSheikh(u) ? Object.keys(db.groups) : studs.filter((s) => s.status === 'active').flatMap((s) => s.groupIds));
  const groups = [...gids].map((id) => db.groups[id]).filter(Boolean).map((g) => ({ ...g, members: isSheikh(u) ? groupMembers(g.id).length : undefined, chat: canChat(u, g.id) }));
  const slots = Object.values(db.slots).filter((s) => gids.has(s.groupId));
  const sids = new Set(studs.map((s) => s.id));
  const events = Object.values(db.events).filter((e) => isSheikh(u) || ((!e.groupId && !e.studentId) || (e.groupId && gids.has(e.groupId)) || (e.studentId && sids.has(e.studentId))));
  const unread = {};
  for (const g of groups) if (g.chat) unread[g.id] = msgStore.unread(g.id, (u.read && u.read[g.id]) || 0, u.id);
  const out = {
    user: { id: u.id, role: u.role, name: u.name, phone: u.phone || '', username: u.username || '', calToken: u.calToken, studentId: u.studentId || null, mustChange: !!u.mustChange },
    center: db.settings.center, timezone: db.settings.timezone, today: todayStr(),
    students: studs.map((s) => publicStudent(s, u)), groups, slots, events, unread,
  };
  if (isSheikh(u)) { out.settings = { schedule: db.settings.schedule, stageWindows: db.settings.stageWindows, autoApprove: !!db.settings.autoApprove }; out.pending = studs.filter((s) => s.status === 'pending').length; }
  return out;
}

/* ============================== البث الحي (SSE) ============================== */
const clients = new Map();
function sse(res, type, data) { try { res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* مغلق */ } }
function broadcastMessage(m) { for (const [, c] of clients) if (canChat(c.user, m.groupId)) sse(c.res, 'message', m); }
let refreshAud = null, refreshTimer = null;
function broadcastRefresh(aud = 'all') {
  refreshAud = refreshAud === 'all' || aud === 'all' ? 'all' : 'sheikh';
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => { const a = refreshAud; refreshAud = null; refreshTimer = null; for (const [, c] of clients) if (a === 'all' || isSheikh(c.user)) sse(c.res, 'refresh', { j: isSheikh(c.user) ? 0 : 1 }); }, 1000);
}
setInterval(() => { for (const [, c] of clients) { try { c.res.write(': ping\n\n'); } catch { /* ignore */ } } }, 25000).unref();

/* ============================== الموجّه ============================== */
const routes = [];
function route(method, pattern, auth, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, auth, handler });
}
/** يحفظ ويبثّ تحديثاً. الافتراضي: تغيير الشيخ يصل للجميع، وتغيير الأسرة يصل للشيخ فقط. */
const mut = (fn, aud) => async (ctx) => { const r = await fn(ctx); save(); broadcastRefresh(aud || (ctx.user && isSheikh(ctx.user) ? 'all' : 'sheikh')); return r; };
const ipGate = (ip, key = 'auth', max = 60) => { if (!sec.bucket(key + ':' + ip, max, 600000)) fail(429, 'محاولات كثيرة من هذا الجهاز. انتظر قليلاً.'); };

route('GET', '/api/public/info', 'public', () => ({ center: { name: db.settings.center.name, phone: db.settings.center.phone, whatsapp: db.settings.center.whatsapp, address: db.settings.center.address, about: db.settings.center.about }, setupNeeded: !sheikhExists() }));

/* ----- مصادقة ----- */
async function attempt(ip, key, label, user, pw) {
  const left = sec.lockLeft(key);
  if (left) { sec.audit('locked', sec.maskId(label), ip); fail(429, `أُوقفت المحاولات مؤقتاً لحماية الحساب. أعد المحاولة بعد ${mins(left)}.`); }
  const r = await sec.verifyPassword(pw, user && user.pass);
  if (!user || !r.ok) { sec.recordFail(key); sec.audit('login_fail', sec.maskId(label), ip); fail(401, 'بيانات الدخول غير صحيحة'); }
  sec.recordOk(key);
  if (r.rehash) { user.pass = await sec.hashPassword(pw); save(); }
  sec.audit('login_ok', sec.maskId(label), ip);
  return { token: createSession(user.id), mustChange: !!user.mustChange };
}
route('POST', '/api/auth/setup', 'public', async ({ req, body }) => {
  const ip = clientIp(req);
  if (sheikhExists()) fail(403, 'تمّ إعداد النظام مسبقاً');
  ipGate(ip, 'setup', 10);
  if (S(body.setupCode, 20) !== SETUP_CODE) { sec.audit('setup_fail', '', ip); fail(403, 'رمز الإعداد غير صحيح. تجده في نافذة تشغيل الخادم أو في الملف data/SETUP_CODE.txt'); }
  const name = S(body.name, 60), username = S(body.username, 30).toLowerCase(), pw = S(body.password, 100);
  if (name.length < 2) fail(400, 'اكتب اسم الشيخ');
  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) fail(400, 'اسم المستخدم: أحرف إنجليزية صغيرة وأرقام (3 على الأقل)');
  const pe = sec.checkPassword(pw, { name, minLen: 10 }); if (pe) fail(400, pe);
  const u = { id: uid('u_'), role: 'sheikh', name, username, pass: await sec.hashPassword(pw), calToken: crypto.randomBytes(16).toString('hex'), read: {}, created: now() };
  db.users[u.id] = u;
  if (body.centerName) db.settings.center.name = S(body.centerName, 80);
  save(); sec.audit('setup_ok', username, ip);
  try { fs.unlinkSync(path.join(DATA_DIR, 'SETUP_CODE.txt')); } catch { /* ok */ }
  return { token: createSession(u.id) };
});
async function newParent(phone, name, pw, mustChange) {
  const u = { id: uid('u_'), role: 'parent', name: S(name, 60) || 'ولي الأمر', phone, pass: await sec.hashPassword(pw), calToken: crypto.randomBytes(16).toString('hex'), read: {}, created: now(), mustChange: !!mustChange };
  db.users[u.id] = u; touch(); return u;
}
/** قبول تلقائي: يُقبل الطالب ويوضع في أقل مجموعة ازدحاماً تطابق مرحلته ونوعه وفيها مكان. وإلا يبقى بانتظار الشيخ. */
function autoPlace(s) {
  if (!db.settings.autoApprove) return false;
  let best = null, bn = 1e9;
  for (const g of Object.values(db.groups)) {
    if (g.stage !== s.stage || g.gender !== s.gender) continue;
    const n = groupMembers(g.id).length;
    if (n < g.capacity && n < bn) { best = g; bn = n; }
  }
  if (!best) return false;
  s.status = 'active'; s.groupIds = [best.id]; touch(); return true;
}
const creatingParents = new Map();
/** يمنع إنشاء حسابين لنفس الرقم عند وصول طلبين متزامنين. */
async function ensureParent(phone, name, pw, mustChange) {
  const ex = getIdx().phone.get(phone); if (ex) return { p: ex, created: false };
  if (creatingParents.has(phone)) { await creatingParents.get(phone).catch(() => {}); const e2 = getIdx().phone.get(phone); if (e2) return { p: e2, created: false }; }
  const pr = newParent(phone, name, pw, mustChange); creatingParents.set(phone, pr);
  try { return { p: await pr, created: true }; } finally { creatingParents.delete(phone); }
}
function newStudent(parent, d) {
  const age = I(d.age, 4, 70, 10), surah = I(d.surah, 1, 114, 1);
  const s = {
    id: uid('s_'), parentId: parent.id, name: S(d.name, 60), age, gender: oneOf(d.gender, GENDERS, 'boys'),
    stage: oneOf(d.stage, STAGES, age <= 11 ? 'primary' : age <= 14 ? 'prep' : 'secondary'),
    surah, ayah: 0, baseJuz: I(d.baseJuz, 0, 30, 0), status: 'pending', groupIds: [], busy: [], note: '', privateNote: '', code: newStudentCode(), created: now(),
  };
  if (s.name.length < 2) fail(400, 'اكتب اسم الطالب');
  const su = { id: uid('u_'), role: 'student', studentId: s.id, name: s.name, calToken: crypto.randomBytes(16).toString('hex'), read: {}, created: now() };
  s.userId = su.id; db.users[su.id] = su; db.students[s.id] = s; touch();
  return s;
}
route('POST', '/api/auth/register', 'public', async ({ req, body }) => {
  const ip = clientIp(req); ipGate(ip, 'reg', 12);
  const phone = normPhone(body.phone); if (!phone) fail(400, 'رقم الهاتف غير صالح');
  const pname = S(body.parentName, 60); if (pname.length < 2) fail(400, 'اكتب اسمك (يظهر للشيخ فوق رقم هاتفك)');
  const pw = S(body.password, 100); const pe = sec.checkPassword(pw, { phone, name: pname, minLen: 8 }); if (pe) fail(400, pe);
  if (getIdx().phone.has(phone)) fail(409, 'هذا الرقم مسجّل مسبقاً. سجّل الدخول بدلاً من ذلك.');
  const c = body.child || {};
  if (S(c.name, 60).length < 2) fail(400, 'اكتب اسم الطالب');
  if (!Number.isFinite(Number(c.age))) fail(400, 'اكتب سنّ الطالب');
  const { p, created } = await ensureParent(phone, pname, pw, false);
  if (!created) fail(409, 'هذا الرقم مسجّل مسبقاً. سجّل الدخول بدلاً من ذلك.');
  autoPlace(newStudent(p, c)); save(); broadcastRefresh('sheikh'); sec.audit('register', sec.maskId(phone), ip);
  return { token: createSession(p.id) };
});
route('POST', '/api/auth/login', 'public', async ({ req, body }) => {
  const ip = clientIp(req); ipGate(ip);
  const phone = normPhone(body.phone || body.id), pw = String(body.password || '');
  if (!phone || !pw) fail(400, 'أدخل رقم الهاتف وكلمة المرور');
  return attempt(ip, 'p:' + phone, phone, getIdx().phone.get(phone), pw);
});
route('POST', '/api/auth/admin-login', 'public', async ({ req, body }) => {
  const ip = clientIp(req); ipGate(ip, 'adm', 30);
  const un = S(body.username, 30).toLowerCase(), pw = String(body.password || '');
  if (!un || !pw) fail(400, 'أدخل بياناتك كاملة');
  return attempt(ip, 'a:' + un, un, getIdx().user.get(un), pw);
});
route('POST', '/api/auth/code-login', 'public', async ({ req, body }) => {
  const ip = clientIp(req); ipGate(ip);
  const code = normCode(body.code); if (code.length !== 8) fail(400, 'رمز الطالب 8 خانات');
  const key = 'c:' + code, left = sec.lockLeft(key);
  if (left) fail(429, `أُوقفت المحاولات مؤقتاً. أعد المحاولة بعد ${mins(left)}.`);
  const s = getIdx().code.get(code);
  if (!s || s.status === 'rejected') { sec.recordFail(key); sec.recordFail('cip:' + ip); if (sec.lockLeft('cip:' + ip)) fail(429, 'محاولات خاطئة كثيرة من هذا الجهاز. انتظر قليلاً.'); sec.audit('code_fail', sec.maskId(code), ip); fail(401, 'رمز الدخول غير صحيح'); }
  sec.recordOk(key); sec.audit('code_ok', sec.maskId(code), ip);
  return { token: createSession(s.userId) };
});
route('POST', '/api/auth/logout', 'any', ({ tok }) => { delete db.sessions[tok]; save(); return { ok: true }; });
route('POST', '/api/auth/password', 'any', async ({ req, user, body, tok }) => {
  if (!user.pass) fail(400, 'حساب الطالب يدخل برمز، لا كلمة مرور له');
  const ip = clientIp(req); const key = 'pw:' + user.id;
  if (sec.lockLeft(key)) fail(429, 'محاولات كثيرة. انتظر قليلاً.');
  const r = await sec.verifyPassword(String(body.old || ''), user.pass);
  if (!r.ok) { sec.recordFail(key); fail(403, 'كلمة المرور الحالية غير صحيحة'); }
  sec.recordOk(key);
  const pw = S(body.password, 100); const pe = sec.checkPassword(pw, { phone: user.phone, name: user.name, minLen: isSheikh(user) ? 10 : 8 }); if (pe) fail(400, pe);
  if (pw === String(body.old)) fail(400, 'اختر كلمة مرور مختلفة عن الحالية');
  user.pass = await sec.hashPassword(pw); user.mustChange = false; revokeUser(user.id, tok); save();
  sec.audit('password_change', sec.maskId(user.phone || user.username), ip);
  return { ok: true };
});
route('GET', '/api/bootstrap', 'any', ({ user }) => bootstrap(user));
route('POST', '/api/stream-ticket', 'any', ({ user }) => { const t = crypto.randomBytes(24).toString('hex'); tickets.set(t, { userId: user.id, exp: now() + 30000 }); return { ticket: t }; });
route('GET', '/api/audit', 'sheikh', () => sec.auditTail(100));

/* ----- الإعدادات ----- */
function cleanIntervals(arr, withLabel) {
  return (Array.isArray(arr) ? arr : []).slice(0, 80).map((x) => {
    const o = { day: I(x.day, 0, 6, 0), from: I(x.from, 0, 1440, 0), to: I(x.to, 0, 1440, 0) };
    if (withLabel) o.label = S(x.label, 40);
    return o;
  }).filter((x) => x.to > x.from);
}
route('PUT', '/api/settings', 'sheikh', mut(({ body }) => {
  const st = db.settings;
  if (body.center) {
    const c = body.center;
    st.center = { name: S(c.name, 80) || st.center.name, phone: S(c.phone, 30), whatsapp: S(c.whatsapp, 30), address: S(c.address, 200), about: S(c.about, 600), countryCode: S(c.countryCode, 4).replace(/\D/g, '') || '20' };
  }
  if (body.autoApprove !== undefined) st.autoApprove = !!body.autoApprove;
  if (body.timezone) { try { new Intl.DateTimeFormat('en', { timeZone: body.timezone }); st.timezone = body.timezone; } catch { fail(400, 'المنطقة الزمنية غير معروفة'); } }
  if (body.schedule) {
    const s = body.schedule;
    st.schedule = { availability: cleanIntervals(s.availability), blocked: cleanIntervals(s.blocked, true), bufferMin: I(s.bufferMin, 0, 60, 10), granularityMin: oneOf(I(s.granularityMin, 5, 30, 15), [5, 10, 15, 20, 30], 15), maxDailyMin: I(s.maxDailyMin, 0, 1440, 0) };
  }
  if (body.stageWindows) for (const k of STAGES) { const w = body.stageWindows[k]; if (w && I(w.to, 0, 1440, 0) > I(w.from, 0, 1440, 0)) st.stageWindows[k] = { from: I(w.from, 0, 1440, 0), to: I(w.to, 0, 1440, 0) }; }
  return { ok: true };
}));
route('GET', '/api/backup', 'sheikh', ({ req, res }) => {
  const users = Object.fromEntries(Object.entries(db.users).map(([k, u]) => [k, { ...u, pass: undefined }]));
  const copy = { ...db, sessions: {}, users, logs: logStore.all(), messages: msgStore.all() };
  const buf = Buffer.from(JSON.stringify(copy));
  sec.audit('backup', 'sheikh', clientIp(req));
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="tibyan-backup-${todayStr()}.json"`, 'Cache-Control': 'no-store' });
  res.end(buf); return null;
});

/* ----- الطلاب ----- */
const sanitizeBusy = (arr) => cleanIntervals(arr, true).slice(0, 40);
route('POST', '/api/students', 'any', mut(async ({ req, user, body }) => {
  if (user.role === 'student') fail(403, 'غير مصرّح');
  if (S(body.name, 60).length < 2) fail(400, 'اكتب اسم الطالب');
  if (!Number.isFinite(Number(body.age))) fail(400, 'اكتب سنّ الطالب');
  if (!isSheikh(user) && myStudents(user).length >= 12) fail(400, 'بلغتَ الحدّ الأقصى للأبناء في حساب واحد');
  let parent = user, temp = null;
  if (isSheikh(user)) {
    const phone = normPhone(body.parentPhone); if (!phone) fail(400, 'رقم هاتف ولي الأمر غير صالح');
    temp = sec.tempPassword();
    const er = await ensureParent(phone, body.parentName, temp, true); parent = er.p;
    if (er.created) sec.audit('parent_created', sec.maskId(phone), clientIp(req)); else temp = null;
  }
  const s = newStudent(parent, body);
  if (!isSheikh(user)) autoPlace(s);
  if (isSheikh(user)) { s.status = 'active'; s.groupIds = (Array.isArray(body.groupIds) ? body.groupIds : []).filter((g) => db.groups[g]); }
  return { id: s.id, code: s.code, parentTempPassword: temp };
}));
route('PUT', '/api/students/:id', 'any', mut(({ user, params, body }) => {
  const s = mustSee(user, params.id);
  if (user.role === 'student') fail(403, 'غير مصرّح');
  if (body.busy !== undefined) s.busy = sanitizeBusy(body.busy);
  if (body.name !== undefined) { const n = S(body.name, 60); if (n.length < 2) fail(400, 'الاسم قصير'); s.name = n; db.users[s.userId].name = n; }
  if (body.age !== undefined) s.age = I(body.age, 4, 70, s.age);
  if (isSheikh(user)) {
    if (body.gender) s.gender = oneOf(body.gender, GENDERS, s.gender);
    if (body.stage) s.stage = oneOf(body.stage, STAGES, s.stage);
    if (body.surah !== undefined) s.surah = I(body.surah, 1, 114, s.surah);
    if (body.ayah !== undefined) s.ayah = I(body.ayah, 0, 300, 0);
    if (body.baseJuz !== undefined) s.baseJuz = I(body.baseJuz, 0, 30, 0);
    if (body.note !== undefined) s.note = S(body.note, 300);
    if (body.privateNote !== undefined) s.privateNote = S(body.privateNote, 500);
    if (body.status) s.status = oneOf(body.status, ['active', 'pending', 'rejected', 'paused'], s.status);
    if (Array.isArray(body.groupIds)) s.groupIds = body.groupIds.filter((g) => db.groups[g]);
  } else if (body.surah !== undefined && s.status === 'pending') s.surah = I(body.surah, 1, 114, s.surah);
  return { ok: true };
}));
function removeStudent(s) {
  logStore.delStudent(s.id);
  for (const [k, e] of Object.entries(db.events)) if (e.studentId === s.id) delete db.events[k];
  revokeUser(s.userId); delete db.users[s.userId]; delete db.students[s.id]; statsCache.delete(s.id); touch();
}
route('DELETE', '/api/students/:id', 'any', mut(({ req, user, params }) => {
  const s = mustSee(user, params.id);
  if (user.role === 'student') fail(403, 'غير مصرّح');
  if (!isSheikh(user) && s.status !== 'pending') fail(403, 'لا يمكن حذف طالب مقبول. تواصل مع الشيخ.');
  const parentId = s.parentId;
  removeStudent(s);
  if (!getIdx().byParent.get(parentId)) { revokeUser(parentId); delete db.users[parentId]; touch(); }
  sec.audit('student_delete', user.role, clientIp(req));
  return { ok: true };
}));
route('POST', '/api/students/:id/reset-code', 'any', mut(({ req, user, params }) => {
  const s = mustSee(user, params.id); if (user.role === 'student') fail(403, 'غير مصرّح');
  s.code = newStudentCode(); revokeUser(s.userId); touch(); sec.audit('reset_code', user.role, clientIp(req));
  return { code: s.code };
}));
route('POST', '/api/parents/:id/reset-password', 'sheikh', mut(async ({ req, params }) => {
  const p = db.users[params.id]; if (!p || p.role !== 'parent') fail(404, 'غير موجود');
  const t = sec.tempPassword(); p.pass = await sec.hashPassword(t); p.mustChange = true; revokeUser(p.id);
  sec.audit('reset_password', sec.maskId(p.phone), clientIp(req));
  return { password: t };
}));
route('GET', '/api/students/:id/logs', 'any', ({ user, params }) => { const s = mustSee(user, params.id); return logStore.forStudent(s.id).slice(0, 300); });

/* ----- المجموعات ----- */
function cleanGroup(b, old) {
  const stage = oneOf(b.stage, STAGES, old ? old.stage : 'primary'), gender = oneOf(b.gender, GENDERS, old ? old.gender : 'boys');
  const name = S(b.name, 60) || (old && old.name); if (!name) fail(400, 'اكتب اسم المجموعة');
  return {
    name, stage, gender, level: S(b.level, 60), color: /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : (old && old.color) || '#19432d',
    sessionsPerWeek: I(b.sessionsPerWeek, 0, 7, 2), durationMin: I(b.durationMin, 15, 240, 45), sessionType: oneOf(b.sessionType, SLOT_TYPES, 'hifz'),
    preferredTime: oneOf(b.preferredTime, ['any', 'morning', 'afternoon', 'evening'], 'any'), maxAbsent: I(b.maxAbsent, 0, 20, 0), capacity: I(b.capacity, 1, 100, 12),
    allowedWindows: cleanIntervals(b.allowedWindows),
    allowStudentChat: b.allowStudentChat === undefined ? (old ? old.allowStudentChat : gender === 'boys') : !!b.allowStudentChat,
    chatLocked: b.chatLocked === undefined ? !!(old && old.chatLocked) : !!b.chatLocked, place: S(b.place, 100),
  };
}
route('POST', '/api/groups', 'sheikh', mut(({ body }) => { const g = { id: uid('g_'), created: now(), ...cleanGroup(body) }; db.groups[g.id] = g; return { id: g.id }; }));
route('PUT', '/api/groups/:id', 'sheikh', mut(({ params, body }) => { const g = db.groups[params.id] || fail(404, 'غير موجود'); Object.assign(g, cleanGroup(body, g)); return { ok: true }; }));
route('DELETE', '/api/groups/:id', 'sheikh', mut(({ params }) => {
  if (!db.groups[params.id]) fail(404, 'غير موجود');
  delete db.groups[params.id];
  for (const [k, s] of Object.entries(db.slots)) if (s.groupId === params.id) delete db.slots[k];
  for (const [k, e] of Object.entries(db.events)) if (e.groupId === params.id) delete db.events[k];
  for (const s of Object.values(db.students)) s.groupIds = s.groupIds.filter((x) => x !== params.id);
  msgStore.dropGroup(params.id);
  return { ok: true };
}));
route('PUT', '/api/groups/:id/members', 'sheikh', mut(({ params, body }) => {
  if (!db.groups[params.id]) fail(404, 'غير موجود');
  const want = new Set(Array.isArray(body.studentIds) ? body.studentIds : []);
  for (const s of Object.values(db.students)) {
    const has = s.groupIds.includes(params.id);
    if (want.has(s.id) && !has) { s.groupIds.push(params.id); if (s.status === 'pending') s.status = 'active'; }
    if (!want.has(s.id) && has) s.groupIds = s.groupIds.filter((x) => x !== params.id);
  }
  return { ok: true };
}));

/* ----- الحصص الأسبوعية ----- */
function slotContext(groupId) {
  const g = db.groups[groupId] || fail(404, 'المجموعة غير موجودة');
  const members = groupMembers(groupId), busy = {}; for (const m of members) busy[m.id] = m.busy || [];
  return { settings: { ...db.settings.schedule, weekStart: 6 }, group: { id: g.id, allowedWindows: g.allowedWindows, maxAbsent: g.maxAbsent, memberIds: members.map((m) => m.id) }, busy };
}
function cleanSlot(b, groupId) {
  const start = I(b.start, 0, 1439, -1), duration = I(b.duration, 5, 480, 0);
  if (start < 0 || !duration || start + duration > 1440) fail(400, 'وقت الحصة غير صالح');
  return { groupId, day: I(b.day, 0, 6, 0), start, duration, type: oneOf(b.type, SLOT_TYPES, 'hifz'), place: S(b.place, 100), link: /^https?:\/\//.test(b.link || '') ? S(b.link, 300) : '', pinned: !!b.pinned };
}
function checkSlot(slot, exceptId, force) {
  const others = Object.values(db.slots).filter((s) => s.id !== exceptId).map((s) => ({ groupId: s.groupId, day: s.day, start: s.start, duration: s.duration }));
  const issues = validatePlacement(slotContext(slot.groupId), slot, others), hard = issues.filter((i) => i.hard);
  if (hard.length) fail(409, hard[0].text, { issues, hard: true });
  if (issues.length && !force) fail(409, 'توجد ملاحظات على هذا الموعد', { issues, hard: false });
}
route('POST', '/api/slots', 'sheikh', mut(({ body }) => { const g = db.groups[body.groupId] || fail(404, 'اختر مجموعة'); const slot = cleanSlot(body, g.id); checkSlot(slot, null, !!body.force); const s = { id: uid('t_'), ...slot }; db.slots[s.id] = s; return { id: s.id }; }));
route('PUT', '/api/slots/:id', 'sheikh', mut(({ params, body }) => { const old = db.slots[params.id] || fail(404, 'غير موجود'); const slot = cleanSlot({ ...old, ...body }, old.groupId); checkSlot(slot, old.id, !!body.force); Object.assign(old, slot); return { ok: true }; }));
route('DELETE', '/api/slots/:id', 'sheikh', mut(({ params }) => { delete db.slots[params.id]; return { ok: true }; }));

/* ----- محرّك التوزيع الذكي ----- */
function buildProblem(groupIds, opts) {
  const sch = db.settings.schedule, chosen = groupIds.map((id) => db.groups[id]).filter(Boolean), chosenIds = new Set(chosen.map((g) => g.id));
  const busy = {}, groups = [];
  for (const g of chosen) {
    const members = groupMembers(g.id); for (const m of members) busy[m.id] = m.busy || [];
    let windows = g.allowedWindows;
    if (!windows || !windows.length) { const w = db.settings.stageWindows[g.stage]; windows = w ? [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, from: w.from, to: w.to })) : []; }
    groups.push({ id: g.id, name: g.name, durationMin: g.durationMin, sessionsPerWeek: g.sessionsPerWeek, allowedWindows: windows, preferredTime: g.preferredTime, maxAbsent: g.maxAbsent, memberIds: members.map((m) => m.id) });
  }
  const fixed = Object.values(db.slots).filter((s) => !chosenIds.has(s.groupId) || s.pinned).map((s) => ({ groupId: s.groupId, day: s.day, start: s.start, duration: s.duration }));
  return { settings: { ...sch, weekStart: 6 }, groups, busy, fixed, limits: { timeMs: I(opts.timeMs, 500, 8000, 3000), improveMs: I(opts.improveMs, 0, 5000, 1500), optimize: opts.optimize !== false } };
}
route('POST', '/api/schedule/solve', 'sheikh', ({ body }) => {
  const ids = (Array.isArray(body.groupIds) ? body.groupIds : []).filter((id) => db.groups[id]);
  if (!ids.length) fail(400, 'اختر مجموعة واحدة على الأقل');
  const problem = buildProblem(ids, body.options || {}), res = solveWithDiagnosis(problem);
  const emptyGroups = problem.groups.filter((g) => !g.memberIds.length).map((g) => g.name);
  return { ...res, warnings: emptyGroups.length ? [`مجموعات بلا طلاب مقبولين (لا قيود غياب عليها): ${emptyGroups.join('، ')}`] : [] };
});
route('POST', '/api/schedule/apply', 'sheikh', mut(({ body }) => {
  const ids = new Set((Array.isArray(body.groupIds) ? body.groupIds : []).filter((id) => db.groups[id]));
  const list = Array.isArray(body.assignments) ? body.assignments : [];
  if (!ids.size || !list.length) fail(400, 'لا يوجد ما يُطبَّق');
  const keep = Object.values(db.slots).filter((s) => !ids.has(s.groupId) || s.pinned);
  const placed = keep.map((s) => ({ groupId: s.groupId, day: s.day, start: s.start, duration: s.duration })), created = [];
  for (const a of list) {
    if (!ids.has(a.groupId)) fail(400, 'مجموعة غير مختارة');
    const slot = cleanSlot({ ...a, type: db.groups[a.groupId].sessionType, place: db.groups[a.groupId].place }, a.groupId);
    const issues = validatePlacement(slotContext(slot.groupId), slot, placed).filter((i) => i.hard || ['BLOCKED', 'OUTSIDE', 'ABSENT', 'GROUP_WINDOW'].includes(i.code));
    if (issues.length) fail(409, 'الجدول لم يعد صالحاً (تغيّرت البيانات). أعد التوزيع. السبب: ' + issues[0].text);
    placed.push({ groupId: slot.groupId, day: slot.day, start: slot.start, duration: slot.duration }); created.push(slot);
  }
  for (const s of Object.values(db.slots)) if (ids.has(s.groupId) && !s.pinned) delete db.slots[s.id];
  for (const s of created) { const id = uid('t_'); db.slots[id] = { id, ...s }; }
  return { created: created.length };
}));

/* ----- الفعاليات ----- */
function cleanEvent(b) {
  const title = S(b.title, 80); if (!title) fail(400, 'اكتب عنوان الموعد');
  if (!dateOk(b.date)) fail(400, 'التاريخ غير صالح');
  const hasTime = b.start !== null && b.start !== undefined && b.start !== '';
  return { title, type: oneOf(b.type, EVENT_TYPES, 'other'), date: b.date, start: hasTime ? I(b.start, 0, 1439, 0) : null, duration: I(b.duration, 5, 600, 60), groupId: b.groupId && db.groups[b.groupId] ? b.groupId : null, studentId: b.studentId && db.students[b.studentId] ? b.studentId : null, note: S(b.note, 300), place: S(b.place, 100) };
}
route('POST', '/api/events', 'sheikh', mut(({ body }) => { const e = { id: uid('e_'), ...cleanEvent(body) }; db.events[e.id] = e; return { id: e.id }; }));
route('PUT', '/api/events/:id', 'sheikh', mut(({ params, body }) => { const e = db.events[params.id] || fail(404, 'غير موجود'); Object.assign(e, cleanEvent(body)); return { ok: true }; }));
route('DELETE', '/api/events/:id', 'sheikh', mut(({ params }) => { delete db.events[params.id]; return { ok: true }; }));

/* ----- سجلّ الحصص والتقييم ----- */
route('POST', '/api/logs/batch', 'sheikh', mut(({ body }) => {
  if (!dateOk(body.date)) fail(400, 'التاريخ غير صالح');
  if (body.date > addDays(todayStr(), 1)) fail(400, 'لا يمكن تسجيل حصة في المستقبل');
  const gid = body.groupId && db.groups[body.groupId] ? body.groupId : null, slotId = body.slotId && db.slots[body.slotId] ? body.slotId : '';
  const entries = Array.isArray(body.entries) ? body.entries.slice(0, 300) : [], recs = [];
  for (const e of entries) {
    const s = db.students[e.studentId]; if (!s) continue;
    const attendance = oneOf(e.attendance, ATT, null); if (!attendance) continue;
    const key = [s.id, body.date, gid || '', slotId].join('|'), present = attendance === 'present' || attendance === 'late';
    const rec = { id: key, studentId: s.id, groupId: gid, slotId, date: body.date, attendance, behavior: present ? I(e.behavior, 0, 5, 0) : 0, commitment: I(e.commitment, 0, 5, 0), note: S(e.note, 300), ts: now() };
    if (present && e.memo && e.memo.surah) {
      const sur = SURAHS[I(e.memo.surah, 1, 114, 1) - 1], from = I(e.memo.from, 1, sur.ayahs, 1), to = I(e.memo.to, from, sur.ayahs, from);
      rec.memo = { kind: oneOf(e.memo.kind, ['new', 'review', 'exam'], 'new'), surah: sur.n, from, to, rating: I(e.memo.rating, 0, 5, 0) };
      if (rec.memo.kind === 'new') { s.surah = sur.n; s.ayah = to; }
    }
    recs.push(rec);
  }
  logStore.setMany(recs);
  return { saved: recs.length };
}));
route('DELETE', '/api/logs/:id', 'sheikh', mut(({ params }) => { logStore.del(decodeURIComponent(params.id)); return { ok: true }; }));
route('GET', '/api/logs/day', 'sheikh', ({ url }) => {
  const date = url.searchParams.get('date'), gid = url.searchParams.get('groupId') || '';
  if (!dateOk(date)) fail(400, 'تاريخ غير صالح');
  return logStore.day(date, gid);
});

/* ----- الدردشة ----- */
route('GET', '/api/chat/:gid/messages', 'any', ({ user, params, url }) => {
  if (!canChat(user, params.gid)) fail(403, 'غير مصرّح');
  return msgStore.page(params.gid, +url.searchParams.get('before') || Infinity, 60);
});
route('POST', '/api/chat/:gid/messages', 'any', ({ user, params, body }) => {
  const g = db.groups[params.gid];
  if (!g || !canChat(user, g.id)) fail(403, 'غير مصرّح');
  if (g.chatLocked && !isSheikh(user)) fail(403, 'الغرفة مغلقة للكتابة، الشيخ فقط يرسل');
  if (!sec.bucket('msg:' + user.id, 20, 60000)) fail(429, 'أرسلت رسائل كثيرة. انتظر قليلاً.');
  const text = S(body.text, 1000); if (!text) fail(400, 'الرسالة فارغة');
  let name = user.name;
  if (user.role === 'student') name = user.name.split(' ').slice(0, 2).join(' ');
  if (isSheikh(user)) name = 'الشيخ ' + user.name.replace(/^الشيخ\s+/, '');
  const m = { id: uid('m_'), groupId: g.id, userId: user.id, role: user.role, name, text, ts: now() };
  msgStore.add(m);
  user.read = user.read || {}; user.read[g.id] = m.ts; save(); broadcastMessage(m);
  return m;
});
route('DELETE', '/api/chat/messages/:id', 'any', ({ user, params }) => {
  const m = msgStore.get(params.id) || fail(404, 'غير موجود');
  if (!isSheikh(user) && m.userId !== user.id) fail(403, 'غير مصرّح');
  msgStore.remove(m.id);
  for (const [, c] of clients) if (canChat(c.user, m.groupId)) sse(c.res, 'delete', { id: m.id });
  return { ok: true };
});
route('POST', '/api/chat/:gid/read', 'any', ({ user, params }) => { if (!canChat(user, params.gid)) fail(403, 'غير مصرّح'); user.read = user.read || {}; user.read[params.gid] = now(); save(); return { ok: true }; });

/* ----- التقويم (ICS) ----- */
const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const TYPE_LABEL = { hifz: 'حفظ', review: 'مراجعة', tajweed: 'تلاوة وتجويد', educational: 'درس تربوي', kuttab: 'الكتّاب', other: 'حصة', exam: 'اختبار', trip: 'رحلة', meeting: 'اجتماع' };
const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function fold(line) {
  const out = []; let cur = '', bytes = 0;
  for (const ch of line) { const b = Buffer.byteLength(ch); if (bytes + b > 72) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; } else { cur += ch; bytes += b; } }
  out.push(cur); return out.join('\r\n');
}
const p2 = (n) => String(n).padStart(2, '0');
const icsT = (ds, min) => ds.replace(/-/g, '') + 'T' + p2(Math.floor(min / 60)) + p2(min % 60) + '00';
function buildIcs(u) {
  const gids = new Set(isSheikh(u) ? Object.keys(db.groups) : myStudents(u).filter((s) => s.status === 'active').flatMap((s) => s.groupIds));
  const sids = new Set(myStudents(u).map((s) => s.id));
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dar Tibyan//AR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEsc(db.settings.center.name), 'X-WR-TIMEZONE:' + db.settings.timezone];
  const today = todayStr(), stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const alarm = (txt) => ['BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(txt), 'END:VALARM'];
  for (const s of Object.values(db.slots)) {
    if (!gids.has(s.groupId)) continue;
    const g = db.groups[s.groupId]; let d = today; for (let i = 0; i < 7 && weekdayOf(d) !== s.day; i++) d = addDays(d, 1);
    const title = `${g.name} — ${TYPE_LABEL[s.type] || 'حصة'}`;
    L.push('BEGIN:VEVENT', 'UID:' + s.id + '@tibyan', 'DTSTAMP:' + stamp, 'DTSTART:' + icsT(d, s.start), 'DTEND:' + icsT(d, s.start + s.duration), 'RRULE:FREQ=WEEKLY;BYDAY=' + ICS_DAYS[s.day], 'SUMMARY:' + icsEsc(title), ...(s.place ? ['LOCATION:' + icsEsc(s.place)] : []), ...alarm(title + ' بعد 30 دقيقة'), 'END:VEVENT');
  }
  for (const e of Object.values(db.events)) {
    if (!(isSheikh(u) || (!e.groupId && !e.studentId) || (e.groupId && gids.has(e.groupId)) || (e.studentId && sids.has(e.studentId)))) continue;
    const title = `${TYPE_LABEL[e.type] || ''}: ${e.title}`;
    L.push('BEGIN:VEVENT', 'UID:' + e.id + '@tibyan', 'DTSTAMP:' + stamp);
    if (e.start === null) L.push('DTSTART;VALUE=DATE:' + e.date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + addDays(e.date, 1).replace(/-/g, ''));
    else L.push('DTSTART:' + icsT(e.date, e.start), 'DTEND:' + icsT(e.date, Math.min(1439, e.start + e.duration)));
    L.push('SUMMARY:' + icsEsc(title), ...(e.note ? ['DESCRIPTION:' + icsEsc(e.note)] : []), ...alarm(title), 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

/* ============================== الخدمة ============================== */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };
const SEC = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
};
const secHeaders = (req) => (String(req.headers['x-forwarded-proto'] || '').startsWith('https') ? { ...SEC, 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : SEC);
const origin = (req) => `${req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : 'http'}://${req.headers.host || 'localhost:' + PORT}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fileCache = new Map();
function sendFile(req, res, file, extra) {
  let st; try { st = fs.statSync(file); } catch { return false; }
  if (!st.isFile()) return false;
  const ext = path.extname(file).toLowerCase(), etag = `W/"${st.size}-${Math.round(st.mtimeMs)}"`;
  const h = { 'Content-Type': MIME[ext] || 'application/octet-stream', ETag: etag, 'Cache-Control': ext === '.html' || file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=300, must-revalidate', ...secHeaders(req), ...extra };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); res.end(); return true; }
  let buf = fileCache.get(file);
  if (!buf || buf.etag !== etag) { buf = { etag, raw: fs.readFileSync(file) }; if (/^\.(html|js|css|json|webmanifest|svg|xml|txt)$/.test(ext)) buf.gz = zlib.gzipSync(buf.raw); fileCache.set(file, buf); }
  if (buf.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { res.writeHead(200, { ...h, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }); res.end(buf.gz); } else { res.writeHead(200, h); res.end(buf.raw); }
  return true;
}
function sendText(req, res, text, type, code = 200, extra) { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache', ...secHeaders(req), ...extra }); res.end(text); }
function sendJson(req, res, obj, code = 200) {
  const body = Buffer.from(JSON.stringify(obj)), h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...secHeaders(req) };
  if (body.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) zlib.gzip(body, (e, z) => { if (e) { res.writeHead(code, h); res.end(body); } else { res.writeHead(code, { ...h, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }); res.end(z); } });
  else { res.writeHead(code, h); res.end(body); }
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const parts = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > 1e6) { reject(new HttpError(413, 'الطلب كبير جداً')); req.destroy(); } else parts.push(c); });
    req.on('end', () => { if (!parts.length) return resolve({}); try { const v = JSON.parse(Buffer.concat(parts).toString('utf8')); resolve(v && typeof v === 'object' ? v : {}); } catch { reject(new HttpError(400, 'بيانات غير صالحة')); } });
    req.on('error', reject);
  });
}
function landing(req) {
  const c = db.settings.center, wa = c.whatsapp ? normPhone(c.whatsapp) : null;
  return fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').replace(/\{\{ORIGIN\}\}/g, esc(origin(req))).replace(/\{\{CENTER\}\}/g, esc(c.name)).replace(/\{\{WA\}\}/g, wa ? esc(`https://wa.me/${wa.startsWith('0') ? (c.countryCode || '20') + wa.slice(1) : wa}`) : '#join');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let p; try { p = decodeURIComponent(url.pathname).replace(/\\/g, '/'); } catch { p = '/'; }
  try {
    if (p.startsWith('/api/')) {
      const ip = clientIp(req);
      if (p === '/api/stream' && req.method === 'GET') {
        const t = tickets.get(url.searchParams.get('ticket') || ''); tickets.delete(url.searchParams.get('ticket') || '');
        const u = t && t.exp > now() ? db.users[t.userId] : null;
        if (!u) return sendText(req, res, 'unauthorized', 'text/plain', 401);
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', ...secHeaders(req) });
        res.write('retry: 4000\n\n');
        const id = uid('c_'); clients.set(id, { res, user: u }); sse(res, 'hello', { t: now() });
        req.on('close', () => clients.delete(id)); return;
      }
      if (!sec.bucket('api:' + ip, 3000, 60000)) throw new HttpError(429, 'طلبات كثيرة جداً. انتظر قليلاً.');
      const m = p.match(/^\/api\/calendar\/([a-f0-9]{32})\.ics$/);
      if (m && req.method === 'GET') {
        const u = getIdx().cal.get(m[1]);
        if (!u) return sendText(req, res, 'not found', 'text/plain', 404);
        return sendText(req, res, buildIcs(u), 'text/calendar; charset=utf-8', 200, { 'Content-Disposition': 'inline; filename="tibyan.ics"' });
      }
      const r = routes.find((x) => x.method === req.method && x.re.test(p));
      if (!r) throw new HttpError(404, 'غير موجود');
      const mm = p.match(r.re), params = {}; r.keys.forEach((k, i) => (params[k] = mm[i + 1]));
      let user = null, tok = null;
      if (r.auth !== 'public') {
        const h = req.headers.authorization || '', raw = h.startsWith('Bearer ') ? h.slice(7) : null;
        user = userFromToken(raw);
        if (!user) throw new HttpError(401, 'انتهت الجلسة، سجّل الدخول من جديد');
        tok = sha(raw);
        if (r.auth === 'sheikh' && !isSheikh(user)) throw new HttpError(403, 'هذه العملية للشيخ فقط');
      }
      const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
      const out = await r.handler({ req, res, url, params, body, user, tok });
      if (out === null) return;
      return sendJson(req, res, out);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'غير مسموح');
    if (p === '/') return sendText(req, res, landing(req), 'text/html; charset=utf-8');
    if (p === '/app' || p === '/app/') return sendFile(req, res, path.join(PUBLIC, 'app.html')) || sendText(req, res, 'missing', 'text/plain', 500);
    if (p === '/robots.txt') return sendText(req, res, `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /app\nSitemap: ${origin(req)}/sitemap.xml\n`, 'text/plain; charset=utf-8');
    if (p === '/sitemap.xml') return sendText(req, res, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(origin(req))}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url></urlset>\n`, 'application/xml; charset=utf-8');
    const clean = path.normalize(p).replace(/^(\.\.[/\\])+/, ''), file = path.join(PUBLIC, clean);
    if (!file.startsWith(PUBLIC + path.sep) || (['index.html', 'app.html'].includes(path.basename(file)) && clean !== '/app.html')) return sendText(req, res, 'not found', 'text/plain; charset=utf-8', 404);
    if (clean.endsWith('sw.js') ? sendFile(req, res, file, { 'Service-Worker-Allowed': '/' }) : sendFile(req, res, file)) return;
    return sendText(req, res, 'الصفحة غير موجودة', 'text/plain; charset=utf-8', 404);
  } catch (e) {
    if (!(e instanceof HttpError)) { console.error(e); e = new HttpError(500, 'خطأ داخلي في الخادم'); }
    if (!res.headersSent) sendJson(req, res, { error: e.message, ...(e.extra || {}) }, e.code);
  }
});
server.keepAliveTimeout = 65000; server.headersTimeout = 20000; server.requestTimeout = 30000;
server.listen(PORT, HOST, () => {
  console.log('\n  دار تبيان لعلوم القرآن — الخادم يعمل');
  console.log(`  افتح:  http://localhost:${PORT}   (التطبيق: /app)`);
  if (!sheikhExists()) console.log(`\n  أول تشغيل: رمز إعداد حساب الشيخ هو  ${SETUP_CODE}\n  (محفوظ أيضاً في data/SETUP_CODE.txt)\n`);
});
