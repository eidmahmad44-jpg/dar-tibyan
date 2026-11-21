'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { solve, solveWithDiagnosis, validatePlacement } = require('../lib/scheduler');
const { coverage, TOTAL_AYAHS, SURAHS } = require('../lib/quran');

const H = (h, m = 0) => h * 60 + m;
const week = (from, to, days = [0, 1, 2, 3, 4, 6]) => days.map((day) => ({ day, from, to }));

function verify(problem, res) {
  // تحقق مستقل من كل القيود الصلبة على الحل الناتج
  const buf = problem.settings.bufferMin || 0;
  const A = res.assignments;
  for (const a of A) {
    const win = problem.settings.availability.filter((w) => w.day === a.day);
    assert.ok(win.some((w) => w.from <= a.start && a.end <= w.to), 'داخل المتاح');
    for (const b of (problem.settings.blocked || []).filter((x) => x.day === a.day)) assert.ok(a.end <= b.from || a.start >= b.to, 'خارج المحجوب');
    const g = problem.groups.find((x) => x.id === a.groupId);
    if (g.allowedWindows && g.allowedWindows.length) assert.ok(g.allowedWindows.some((w) => w.day === a.day && w.from <= a.start && a.end <= w.to), 'نافذة المجموعة');
    let absent = 0;
    for (const m of g.memberIds) if ((problem.busy[m] || []).some((w) => w.day === a.day && w.from < a.end && a.start < w.to)) absent++;
    assert.ok(absent <= (g.maxAbsent | 0), 'الغياب');
  }
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
    if (A[i].day !== A[j].day) continue;
    assert.ok(A[i].end + buf <= A[j].start || A[j].end + buf <= A[i].start, 'لا تداخل/فاصل');
    assert.notStrictEqual(A[i].groupId, A[j].groupId, 'حصة واحدة للمجموعة يومياً');
  }
  for (const g of problem.groups) assert.strictEqual(A.filter((a) => a.groupId === g.id).length, g.sessionsPerWeek, 'العدد الأسبوعي');
}

test('يجد جدولاً مطابقاً لكل القيود', () => {
  const problem = {
    settings: { availability: week(H(16), H(21)), blocked: week(H(18), H(18, 30)), bufferMin: 10, granularityMin: 15, weekStart: 6 },
    groups: [
      { id: 'a', name: 'ابتدائي بنين', durationMin: 45, sessionsPerWeek: 3, memberIds: ['s1', 's2', 's3'], maxAbsent: 0, preferredTime: 'afternoon' },
      { id: 'b', name: 'إعدادي بنات', durationMin: 60, sessionsPerWeek: 2, memberIds: ['s4', 's5'], maxAbsent: 0 },
      { id: 'c', name: 'ثانوي بنين', durationMin: 60, sessionsPerWeek: 2, memberIds: ['s6'], maxAbsent: 0 },
    ],
    busy: { s1: [{ day: 0, from: H(16), to: H(17) }], s4: [{ day: 1, from: H(16), to: H(19) }] },
  };
  const res = solve(problem);
  assert.ok(['optimal', 'feasible'].includes(res.status), res.status);
  assert.strictEqual(res.assignments.length, 7);
  verify(problem, res);
});

test('يرفض الممتنع ويشرح السبب (لا حلاً تقريبياً)', () => {
  const problem = {
    settings: { availability: [{ day: 0, from: H(16), to: H(17) }], blocked: [], bufferMin: 0, granularityMin: 15 },
    groups: [{ id: 'a', name: 'أ', durationMin: 60, sessionsPerWeek: 2, memberIds: [], maxAbsent: 0 }],
    busy: {},
  };
  const res = solve(problem);
  assert.strictEqual(res.status, 'infeasible');
  assert.strictEqual(res.assignments.length, 0);
  assert.ok(res.reasons.length > 0);
});

test('يكتشف التعارض الدقيق: مجموعتان تتنافسان على الفترة الوحيدة', () => {
  const problem = {
    settings: { availability: [{ day: 2, from: H(17), to: H(18) }], blocked: [], bufferMin: 0, granularityMin: 15 },
    groups: [
      { id: 'a', name: 'أ', durationMin: 60, sessionsPerWeek: 1, memberIds: [], maxAbsent: 0 },
      { id: 'b', name: 'ب', durationMin: 60, sessionsPerWeek: 1, memberIds: [], maxAbsent: 0 },
    ],
    busy: {},
  };
  const res = solveWithDiagnosis(problem);
  assert.strictEqual(res.status, 'infeasible');
  assert.ok(res.relaxations && res.relaxations.length >= 1);
});

test('يحترم غياب الطلاب: الحل الوحيد الواقعي', () => {
  const problem = {
    settings: { availability: [{ day: 0, from: H(16), to: H(19) }], blocked: [], bufferMin: 0, granularityMin: 30 },
    groups: [{ id: 'a', name: 'أ', durationMin: 60, sessionsPerWeek: 1, memberIds: ['x', 'y'], maxAbsent: 0 }],
    busy: { x: [{ day: 0, from: H(16), to: H(18) }], y: [{ day: 0, from: H(16), to: H(17) }] },
  };
  const res = solve(problem);
  assert.strictEqual(res.assignments[0].start, H(18));
  verify(problem, res);
});

test('أداء: ١٢ مجموعة × ٣ حصص ضمن مهلة معقولة', () => {
  const groups = [];
  for (let i = 0; i < 12; i++) groups.push({ id: 'g' + i, name: 'م' + i, durationMin: 45, sessionsPerWeek: 3, memberIds: ['m' + i], maxAbsent: 0 });
  const problem = { settings: { availability: week(H(15), H(22)), blocked: [], bufferMin: 10, granularityMin: 15 }, groups, busy: {} };
  const t = Date.now();
  const res = solve(problem);
  assert.ok(['optimal', 'feasible'].includes(res.status), res.status);
  assert.ok(Date.now() - t < 6000);
  assert.strictEqual(res.assignments.length, 36);
  verify(problem, res);
});

test('validatePlacement يكشف التعارض والفاصل', () => {
  const ctx = { settings: { availability: week(H(16), H(20)), blocked: [], bufferMin: 10 }, group: { id: 'a', memberIds: [], maxAbsent: 0 }, busy: {} };
  const r = validatePlacement(ctx, { day: 0, start: H(16, 30), duration: 60 }, [{ groupId: 'b', day: 0, start: H(16), duration: 45 }]);
  assert.ok(r.some((x) => x.code === 'OVERLAP' && x.hard));
  const ok = validatePlacement(ctx, { day: 0, start: H(17), duration: 60 }, [{ groupId: 'b', day: 0, start: H(16), duration: 45 }]);
  assert.strictEqual(ok.length, 0);
});

test('القرآن: ٦٢٣٦ آية وحساب الاتحاد بلا تكرار', () => {
  assert.strictEqual(SURAHS.length, 114);
  assert.strictEqual(TOTAL_AYAHS, 6236);
  const c = coverage([{ surah: 1, from: 1, to: 7 }, { surah: 1, from: 3, to: 5 }, { surah: 114, from: 1, to: 6 }]);
  assert.strictEqual(c.total, 13);
});
