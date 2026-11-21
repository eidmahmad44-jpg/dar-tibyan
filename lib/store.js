'use strict';
/**
 * تخزين إضافي (append-only JSONL) للبيانات الكثيرة النمو: التقييمات والرسائل.
 * الكتابة O(1) (سطر واحد)، والقراءة من فهارس في الذاكرة، والضغط (compaction) عند البدء.
 */
const fs = require('fs');

function readLines(file) {
  let txt = '';
  try { txt = fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const out = [];
  for (const line of txt.split('\n')) {
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch { /* سطر تالف (انقطاع كهرباء): يُتجاهل */ }
  }
  return out;
}
function writeAtomic(file, lines) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, lines.length ? lines.join('\n') + '\n' : '');
  fs.renameSync(tmp, file);
}

class LogStore {
  constructor(file) {
    this.file = file; this.byId = new Map(); this.byStudent = new Map(); this.byDate = new Map();
    this.ver = new Map(); this.sorted = new Map();
    const recs = readLines(file); let lines = 0;
    for (const r of recs) { lines++; if (r.op === 'set') this._set(r.rec); else if (r.op === 'del') this._del(r.id); }
    if (lines > this.byId.size * 2 + 500) this.compact();
  }
  _bump(sid) { this.ver.set(sid, (this.ver.get(sid) || 0) + 1); this.sorted.delete(sid); }
  _unindex(o) {
    const s = this.byStudent.get(o.studentId); if (s) { s.delete(o.id); if (!s.size) this.byStudent.delete(o.studentId); }
    const d = this.byDate.get(o.date); if (d) { d.delete(o.id); if (!d.size) this.byDate.delete(o.date); }
    this._bump(o.studentId);
  }
  _set(rec) {
    const old = this.byId.get(rec.id); if (old) this._unindex(old);
    this.byId.set(rec.id, rec);
    if (!this.byStudent.has(rec.studentId)) this.byStudent.set(rec.studentId, new Map());
    this.byStudent.get(rec.studentId).set(rec.id, rec);
    if (!this.byDate.has(rec.date)) this.byDate.set(rec.date, new Map());
    this.byDate.get(rec.date).set(rec.id, rec);
    this._bump(rec.studentId);
  }
  _del(id) { const o = this.byId.get(id); if (!o) return false; this._unindex(o); this.byId.delete(id); return true; }
  setMany(recs) {
    if (!recs.length) return;
    for (const r of recs) this._set(r);
    fs.appendFileSync(this.file, recs.map((rec) => JSON.stringify({ op: 'set', rec })).join('\n') + '\n');
  }
  del(id) { if (this._del(id)) fs.appendFileSync(this.file, JSON.stringify({ op: 'del', id }) + '\n'); }
  delStudent(sid) {
    const s = this.byStudent.get(sid); if (!s) return;
    const ids = [...s.keys()]; for (const id of ids) this._del(id);
    fs.appendFileSync(this.file, ids.map((id) => JSON.stringify({ op: 'del', id })).join('\n') + '\n');
  }
  /** سجلات الطالب من الأحدث إلى الأقدم (مخزّنة مؤقتاً حتى يتغيّر شيء). */
  forStudent(sid) {
    let a = this.sorted.get(sid);
    if (!a) {
      a = [...(this.byStudent.get(sid) || new Map()).values()].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : y.ts - x.ts));
      this.sorted.set(sid, a);
    }
    return a;
  }
  day(date, gid) { return [...(this.byDate.get(date) || new Map()).values()].filter((l) => (l.groupId || '') === gid); }
  all() { return [...this.byId.values()]; }
  compact() { writeAtomic(this.file, [...this.byId.values()].map((rec) => JSON.stringify({ op: 'set', rec }))); }
}

class MsgStore {
  constructor(file, perGroup = 3000) {
    this.file = file; this.cap = perGroup; this.byGroup = new Map(); this.byId = new Map();
    const recs = readLines(file); let lines = 0;
    for (const r of recs) {
      lines++;
      if (r.op === 'add') this._add(r.m); else if (r.op === 'del') { const m = this.byId.get(r.id); if (m) { m.deleted = true; m.text = ''; } } else if (r.op === 'grp') this._dropGroup(r.gid);
    }
    this.lines = lines;
    if (lines > this.byId.size * 2 + 1000) this.compact();
  }
  _add(m) {
    let a = this.byGroup.get(m.groupId); if (!a) this.byGroup.set(m.groupId, (a = []));
    a.push(m); this.byId.set(m.id, m);
    if (a.length > this.cap) { const x = a.shift(); this.byId.delete(x.id); }
  }
  _dropGroup(gid) { for (const m of this.byGroup.get(gid) || []) this.byId.delete(m.id); this.byGroup.delete(gid); }
  add(m) { this._add(m); fs.appendFileSync(this.file, JSON.stringify({ op: 'add', m }) + '\n'); }
  get(id) { return this.byId.get(id); }
  remove(id) { const m = this.byId.get(id); if (!m) return null; m.deleted = true; m.text = ''; fs.appendFileSync(this.file, JSON.stringify({ op: 'del', id }) + '\n'); return m; }
  dropGroup(gid) { this._dropGroup(gid); fs.appendFileSync(this.file, JSON.stringify({ op: 'grp', gid }) + '\n'); }
  page(gid, before, limit = 60) {
    const a = this.byGroup.get(gid) || []; const out = [];
    for (let i = a.length - 1; i >= 0 && out.length < limit; i--) if (a[i].ts < before && !a[i].deleted) out.push(a[i]);
    return out.reverse();
  }
  unread(gid, since, userId) {
    const a = this.byGroup.get(gid) || []; let n = 0;
    for (let i = a.length - 1; i >= 0 && a[i].ts > since; i--) if (!a[i].deleted && a[i].userId !== userId) n++;
    return n;
  }
  all() { return [...this.byId.values()].filter((m) => !m.deleted); }
  compact() {
    const lines = []; for (const a of this.byGroup.values()) for (const m of a) if (!m.deleted) lines.push(JSON.stringify({ op: 'add', m }));
    writeAtomic(this.file, lines);
  }
}
module.exports = { LogStore, MsgStore };
