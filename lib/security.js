'use strict';
/** أدوات الحماية: تجزئة كلمات المرور، سياسة القوة، القفل التصاعدي، السجل الأمني. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/* ---------- تجزئة scrypt غير متزامنة مع تحديد التزامن ---------- */
const N_NEW = 32768, MAXMEM = 128 * 1024 * 1024;
let active = 0; const waiting = [];
function limited(fn) {
  return new Promise((resolve, reject) => {
    const run = () => { active++; fn().then(resolve, reject).finally(() => { active--; const n = waiting.shift(); if (n) n(); }); };
    if (active < 3) run(); else waiting.push(run);
  });
}
const scrypt = (pw, salt, N) => limited(() => new Promise((res, rej) => crypto.scrypt(pw, salt, 32, { N, r: 8, p: 1, maxmem: MAXMEM }, (e, k) => (e ? rej(e) : res(k)))));
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const k = await scrypt(pw, salt, N_NEW);
  return `s1$${N_NEW}$${salt.toString('hex')}$${k.toString('hex')}`;
}
let DUMMY = null;
/** يعيد {ok, rehash}. إن كان stored فارغاً يُجري عملاً مكافئاً حتى لا يُعرف وجود الحساب من زمن الاستجابة. */
async function verifyPassword(pw, stored) {
  if (!stored) { DUMMY = DUMMY || (await hashPassword('dummy-password-for-timing')); stored = DUMMY; pw = pw + '!'; }
  let N, salt, hash, legacy = false;
  if (stored.startsWith('s1$')) { const p = stored.split('$'); N = +p[1]; salt = Buffer.from(p[2], 'hex'); hash = Buffer.from(p[3], 'hex'); }
  else { const p = stored.split(':'); N = 16384; salt = p[0]; hash = Buffer.from(p[1], 'hex'); legacy = true; }
  const k = await scrypt(pw, salt, N);
  const ok = k.length === hash.length && crypto.timingSafeEqual(k, hash);
  return { ok, rehash: ok && (legacy || N < N_NEW) };
}

/* ---------- سياسة كلمات المرور ---------- */
const COMMON = new Set(['12345678', '123456789', '1234567890', '987654321', '11111111', '00000000', '12341234', '11223344', '123123123', '1q2w3e4r', 'qwertyui', 'qwertyuiop', 'qwerty123', 'password', 'password1', 'password123', 'passw0rd', 'iloveyou', 'admin123', 'abc12345', 'abcd1234', 'abcdefgh', 'letmein1', 'welcome1', 'allah123', 'allahakbar', 'muhammad', 'mohamed123', 'mohammed', 'ahmed123', 'quran123', 'islam123', 'bismillah', 'alhamdulillah', 'dartibyan', 'tibyan123', 'tibyan1234', '01234567', '0123456789', '147258369', '123456789a', 'a1234567', 'a12345678', 'aa123456', 'zxcvbnm1', 'asdfghjk', '12121212', '55555555', '88888888', '99999999', 'sheikh123', 'sheikh1234']);
function seqLike(s) {
  if (s.length < 6) return false; let up = true, down = true;
  for (let i = 1; i < s.length; i++) { const d = s.charCodeAt(i) - s.charCodeAt(i - 1); if (d !== 1) up = false; if (d !== -1) down = false; }
  return up || down;
}
/** يعيد نص الخطأ بالعربية أو null إن كانت مقبولة. */
function checkPassword(pw, { phone = '', name = '', minLen = 8 } = {}) {
  pw = String(pw || '');
  if (pw.length < minLen) return `كلمة المرور ${minLen} أحرف على الأقل`;
  if (pw.length > 100) return 'كلمة المرور طويلة جداً';
  const low = pw.toLowerCase();
  if (COMMON.has(low)) return 'كلمة المرور شائعة وسهلة التخمين، اختر غيرها';
  if (/^(.{1,3})\1+$/.test(pw) || new Set(pw).size <= 2) return 'كلمة المرور فيها تكرار كثير';
  if (seqLike(low)) return 'كلمة المرور تسلسل سهل (مثل 123456)';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 8 && (pw.replace(/\D/g, '').includes(digits.slice(-8)))) return 'لا تستخدم رقم هاتفك ككلمة مرور';
  const n = String(name).trim().toLowerCase();
  if (n.length >= 4 && low.includes(n.replace(/\s+/g, ''))) return 'لا تضمّن اسمك في كلمة المرور';
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 2 && pw.length < 12) return 'اخلط حروفاً وأرقاماً (أو اجعلها 12 خانة فأكثر)';
  return null;
}
/** كلمة مؤقتة مقروءة (بلا حروف ملتبسة). */
function tempPassword() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = ''; const b = crypto.randomBytes(10); for (let i = 0; i < 10; i++) s += A[b[i] % A.length];
  return s;
}

/* ---------- القفل التصاعدي ---------- */
const fails = new Map();
const lockLeft = (k) => { const f = fails.get(k); return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0; };
function recordFail(k) {
  const f = fails.get(k) || { n: 0, until: 0, last: 0 }; f.n++; f.last = Date.now();
  if (f.n >= 5) f.until = Date.now() + Math.min(30 * 60000, 60000 * 2 ** (f.n - 5));
  fails.set(k, f);
}
const recordOk = (k) => fails.delete(k);
/** نافذة ثابتة سريعة (O(1)) لتحديد معدل الطلبات. */
const buckets = new Map();
function bucket(k, max, ms) {
  const t = Date.now(); let b = buckets.get(k);
  if (!b || t - b.s > ms) { b = { s: t, n: 0 }; buckets.set(k, b); }
  return ++b.n <= max;
}
setInterval(() => { const t = Date.now(); for (const [k, v] of buckets) if (t - v.s > 600000) buckets.delete(k); for (const [k, v] of fails) if (t - v.last > 3600000) fails.delete(k); }, 300000).unref();

/* ---------- السجل الأمني ---------- */
let auditFile = null;
function auditInit(dir) { auditFile = path.join(dir, 'audit.log'); }
function audit(ev, who, ip, extra) {
  if (!auditFile) return;
  try {
    try { if (fs.statSync(auditFile).size > 2e6) fs.renameSync(auditFile, auditFile + '.1'); } catch { /* none */ }
    fs.appendFileSync(auditFile, JSON.stringify({ t: Date.now(), ev, who: who || '', ip: ip || '', ...(extra || {}) }) + '\n');
  } catch { /* لا نُسقط الطلب بسبب السجل */ }
}
function auditTail(n = 100) {
  try {
    const st = fs.statSync(auditFile), len = Math.min(st.size, 200000), buf = Buffer.alloc(len), fd = fs.openSync(auditFile, 'r');
    fs.readSync(fd, buf, 0, len, st.size - len); fs.closeSync(fd);
    return buf.toString('utf8').split('\n').filter(Boolean).slice(-n).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse();
  } catch { return []; }
}
const maskId = (s) => { s = String(s || ''); return s.length > 5 ? s.slice(0, 3) + '***' + s.slice(-2) : s; };
module.exports = { hashPassword, verifyPassword, checkPassword, tempPassword, lockLeft, recordFail, recordOk, bucket, audit, auditInit, auditTail, maskId };
