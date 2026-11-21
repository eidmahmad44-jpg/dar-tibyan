'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const sec = require('../lib/security');
const { LogStore, MsgStore } = require('../lib/store');

test('سياسة كلمات المرور', () => {
  assert.ok(sec.checkPassword('123456'));
  assert.ok(sec.checkPassword('12345678'));
  assert.ok(sec.checkPassword('password'));
  assert.ok(sec.checkPassword('aaaaaaaa'));
  assert.ok(sec.checkPassword('01012345678x', { phone: '01012345678' }));
  assert.strictEqual(sec.checkPassword('Sa3d#2026ok'), null);
});
test('تجزئة scrypt والتحقق وإعادة التجزئة', async () => {
  const h = await sec.hashPassword('Secret#123');
  assert.ok(h.startsWith('s1$'));
  assert.strictEqual((await sec.verifyPassword('Secret#123', h)).ok, true);
  assert.strictEqual((await sec.verifyPassword('wrong', h)).ok, false);
  assert.strictEqual((await sec.verifyPassword('x', null)).ok, false);
});
test('القفل التصاعدي', () => {
  for (let i = 0; i < 5; i++) sec.recordFail('k1');
  assert.ok(sec.lockLeft('k1') > 0); sec.recordOk('k1'); assert.strictEqual(sec.lockLeft('k1'), 0);
});
test('التخزين: ترقيم، حذف، تحمّل سطر تالف، ضغط', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-')), f = path.join(d, 'l.jsonl');
  const s = new LogStore(f);
  s.setMany([{ id: 'a', studentId: 's1', date: '2026-01-02', ts: 1, attendance: 'present' }, { id: 'b', studentId: 's1', date: '2026-01-03', ts: 2, attendance: 'late' }]);
  s.setMany([{ id: 'a', studentId: 's1', date: '2026-01-02', ts: 3, attendance: 'absent' }]);
  s.del('b'); fs.appendFileSync(f, '{broken json\n');
  const s2 = new LogStore(f);
  assert.strictEqual(s2.forStudent('s1').length, 1); assert.strictEqual(s2.forStudent('s1')[0].attendance, 'absent');
  const m = new MsgStore(path.join(d, 'm.jsonl'));
  m.add({ id: '1', groupId: 'g', userId: 'u', ts: 5, text: 'x' }); m.add({ id: '2', groupId: 'g', userId: 'v', ts: 9, text: 'y' });
  assert.strictEqual(m.unread('g', 6, 'u'), 1);
  const m2 = new MsgStore(path.join(d, 'm.jsonl')); assert.strictEqual(m2.page('g', Infinity).length, 2);
});
