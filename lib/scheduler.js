'use strict';
/**
 * محرّك جدولة الحصص — بحث تام (Exact CSP) وليس تقريبياً.
 *
 * النموذج:
 *   - متغيّر لكل حصة أسبوعية مطلوبة (مجموعة × رقم الحصة).
 *   - المجال = كل (يوم، بداية) على شبكة زمنية تحقق القيود الصلبة:
 *       1) داخل نافذة متاحة للشيخ وخارج الاستراحات المحجوبة.
 *       2) داخل النوافذ المسموحة للمجموعة (إن حُدّدت).
 *       3) عدد الطلاب المنشغلين في الوقت ≤ الغياب المسموح للمجموعة.
 *       4) لا تعارض مع حصص ثابتة/مثبّتة، وحدّ أقصى لدقائق اليوم (اختياري).
 *   - قيود بين المتغيّرات: لا تداخل بين أي حصتين مع فاصل راحة، وحصة واحدة
 *     للمجموعة في اليوم.
 *
 * الخوارزمية: Backtracking مع MRV (أصغر مجال أولاً) + Forward Checking +
 * كسر التماثل بين حصص المجموعة الواحدة + Branch & Bound على تكلفة التفضيلات.
 * إن وُجد حل صالح فالبحث يجده (ضمن الميزانية الزمنية)، وإن لم يوجد يُثبت ذلك
 * أو يُصرّح بأن الميزانية انتهت (status = 'unknown') — لا يُقدَّم حل «شبه صحيح» أبداً.
 */

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return NaN;
  const h = +m[1], mi = +m[2];
  if (h > 24 || mi > 59 || (h === 24 && mi !== 0)) return NaN;
  return h * 60 + mi;
}
function fmt(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/* ---------- أدوات المجالات الزمنية ---------- */
function normIntervals(list) {
  const out = [];
  for (const it of list || []) {
    const day = it.day | 0, from = it.from | 0, to = it.to | 0;
    if (day < 0 || day > 6 || !(to > from)) continue;
    out.push({ day, from: Math.max(0, from), to: Math.min(1440, to) });
  }
  return out;
}
function mergeDay(list) {
  const s = list.slice().sort((a, b) => a.from - b.from);
  const out = [];
  for (const x of s) {
    const l = out[out.length - 1];
    if (l && x.from <= l.to) l.to = Math.max(l.to, x.to);
    else out.push({ from: x.from, to: x.to });
  }
  return out;
}
function subtract(wins, blocks) {
  const out = [];
  for (const w of wins) {
    let cur = w.from;
    for (const b of blocks) {
      if (b.to <= cur || b.from >= w.to) continue;
      if (b.from > cur) out.push({ from: cur, to: b.from });
      cur = Math.max(cur, b.to);
      if (cur >= w.to) break;
    }
    if (cur < w.to) out.push({ from: cur, to: w.to });
  }
  return out;
}
/** نوافذ الشيخ الحرة لكل يوم = المتاح − المحجوب. */
function freeWindows(settings) {
  const av = normIntervals(settings.availability), bl = normIntervals(settings.blocked);
  const out = [];
  for (let d = 0; d < 7; d++) {
    out.push(subtract(mergeDay(av.filter((x) => x.day === d)), mergeDay(bl.filter((x) => x.day === d))));
  }
  return out;
}
function perDay(list) {
  const norm = normIntervals(list);
  const out = [];
  for (let d = 0; d < 7; d++) out.push(mergeDay(norm.filter((x) => x.day === d)));
  return out;
}
function gridStarts(from, to, d, gran) {
  const last = to - d, out = [];
  if (last < from) return out;
  out.push(from);
  let s = Math.ceil(from / gran) * gran;
  if (s === from) s += gran;
  for (; s <= last; s += gran) out.push(s);
  return out;
}
const inside = (wins, start, end) => wins.some((w) => w.from <= start && end <= w.to);
const overlaps = (wins, start, end) => wins.some((w) => w.from < end && start < w.to);
const gapOK = (aS, aE, bS, bE, buf) => aE + buf <= bS || bE + buf <= aS;
const bandOf = (start) => (start < 720 ? 'morning' : start < 1020 ? 'afternoon' : 'evening');

/* ---------- بناء المسألة ---------- */
function prepare(problem) {
  const s = problem.settings || {};
  const settings = {
    availability: s.availability || [],
    blocked: s.blocked || [],
    bufferMin: Math.max(0, s.bufferMin | 0),
    granularityMin: [5, 10, 15, 20, 30].includes(s.granularityMin | 0) ? s.granularityMin | 0 : 15,
    maxDailyMin: Math.max(0, s.maxDailyMin | 0),
    weekStart: Number.isInteger(s.weekStart) ? ((s.weekStart % 7) + 7) % 7 : 6,
  };
  const free = freeWindows(settings);
  const dayPos = (d) => (d - settings.weekStart + 7) % 7;
  const busyPerDay = {};
  for (const [sid, list] of Object.entries(problem.busy || {})) busyPerDay[sid] = perDay(list);

  const fixed = (problem.fixed || []).map((f) => ({
    groupId: f.groupId, day: f.day | 0, start: f.start | 0, end: (f.start | 0) + (f.duration | 0), duration: f.duration | 0,
  }));
  const usedBase = new Array(7).fill(0);
  for (const f of fixed) usedBase[f.day] += f.duration;

  const groups = (problem.groups || []).map((g) => ({
    id: g.id, name: g.name || g.id,
    duration: Math.max(5, g.durationMin | 0),
    perWeek: Math.max(0, g.sessionsPerWeek | 0),
    windows: problem.ignoreWindows ? null : (g.allowedWindows && g.allowedWindows.length ? perDay(g.allowedWindows) : null),
    pref: g.preferredTime || 'any',
    maxAbsent: Math.max(0, (g.maxAbsent | 0) + (problem.extraAbsent | 0)),
    members: g.memberIds || [],
  }));
  return { settings, free, dayPos, busyPerDay, fixed, usedBase, groups };
}

function pairPenalty(perWeek, dpA, dpB) {
  if (perWeek < 2) return 0;
  const ideal = Math.floor(7 / perWeek);
  let gap = Math.abs(dpA - dpB);
  gap = Math.min(gap, 7 - gap);
  return Math.max(0, ideal - gap) * 5;
}

/** المرشحون لحصة مجموعة معيّنة + عدّادات تشخيصية لكل مرحلة تصفية. */
function candidatesFor(P, g) {
  const { settings, free, dayPos, busyPerDay, fixed, usedBase } = P;
  const buf = settings.bufferMin, gran = settings.granularityMin, d = g.duration;
  const stages = { avail: 0, window: 0, absent: 0, fixed: 0 };
  const fixedSibs = fixed.filter((f) => f.groupId === g.id);
  const sibDays = new Set(fixedSibs.map((f) => f.day));
  const out = [];
  for (let day = 0; day < 7; day++) {
    for (const w of free[day]) {
      for (const start of gridStarts(w.from, w.to, d, gran)) {
        const end = start + d;
        stages.avail++;
        if (g.windows && !inside(g.windows[day], start, end)) continue;
        stages.window++;
        let absent = 0;
        for (const m of g.members) {
          const b = busyPerDay[m];
          if (b && overlaps(b[day], start, end)) absent++;
        }
        if (absent > g.maxAbsent) continue;
        stages.absent++;
        if (sibDays.has(day)) continue;
        if (settings.maxDailyMin && usedBase[day] + d > settings.maxDailyMin) continue;
        let clash = false;
        for (const f of fixed) {
          if (f.day === day && !gapOK(start, end, f.start, f.end, buf)) { clash = true; break; }
        }
        if (clash) continue;
        stages.fixed++;
        let cost = absent * 6;
        if (g.pref !== 'any' && bandOf(start) !== g.pref) cost += 8;
        for (const f of fixedSibs) cost += pairPenalty(g.perWeek, dayPos(day), dayPos(f.day));
        out.push({ day, start, end, key: dayPos(day) * 1440 + start, cost });
      }
    }
  }
  out.sort((a, b) => a.cost - b.cost || a.key - b.key);
  return { cands: out, stages };
}

function explainEmpty(g, stages) {
  const d = g.duration;
  if (stages.avail === 0) return `لا توجد نافذة متاحة عند الشيخ تتسع لحصة مدتها ${d} دقيقة.`;
  if (stages.window === 0) return 'النوافذ الزمنية المسموحة لمجموعة «' + g.name + '» لا تتقاطع مع أوقات الشيخ المتاحة.';
  if (stages.absent === 0) return 'في كل الأوقات الممكنة يتجاوز عدد الطلاب المنشغلين الحدّ المسموح لمجموعة «' + g.name + '».';
  return 'الحصص الثابتة الأخرى أو الحدّ اليومي يشغلان كل الأوقات الممكنة لمجموعة «' + g.name + '».';
}

/* ---------- البحث ---------- */
function solve(problem) {
  const t0 = Date.now();
  const P = prepare(problem);
  const limits = Object.assign({ timeMs: 2500, improveMs: 1500, nodeLimit: 400000, optimize: true }, problem.limits || {});
  const { settings, dayPos } = P;
  const buf = settings.bufferMin;

  // 1) المتغيّرات
  const vars = [];
  const reasons = [];
  const cache = new Map();
  for (const g of P.groups) {
    const have = P.fixed.filter((f) => f.groupId === g.id).length;
    const need = g.perWeek - have;
    if (g.perWeek > 7) reasons.push({ groupId: g.id, text: `«${g.name}»: لا يمكن أكثر من 7 حصص أسبوعياً (حصة واحدة في اليوم).` });
    if (need <= 0) continue;
    const key = g.id;
    if (!cache.has(key)) cache.set(key, candidatesFor(P, g));
    const { cands, stages } = cache.get(key);
    if (!cands.length) {
      reasons.push({ groupId: g.id, text: explainEmpty(g, stages) });
      continue;
    }
    const days = new Set(cands.map((c) => c.day));
    if (days.size < need) {
      reasons.push({ groupId: g.id, text: `«${g.name}» تحتاج ${need} حصص في أيام مختلفة، لكن الأيام الممكنة ${days.size} فقط.` });
      continue;
    }
    for (let k = 0; k < need; k++) vars.push({ gid: g.id, g, k, d: g.duration, cands });
  }
  const finish = (status, extra) => Object.assign({
    status, assignments: [], cost: null, reasons,
    stats: { nodes: 0, ms: Date.now() - t0, variables: vars.length },
  }, extra || {});

  if (reasons.length) return finish('infeasible');

  // سعة إجمالية
  const needMin = vars.reduce((s, v) => s + v.d, 0);
  let freeMin = 0;
  for (let d = 0; d < 7; d++) {
    const fixedMin = P.usedBase[d];
    const dayFree = P.free[d].reduce((s, w) => s + (w.to - w.from), 0) - fixedMin;
    freeMin += settings.maxDailyMin ? Math.min(Math.max(0, dayFree), Math.max(0, settings.maxDailyMin - fixedMin)) : Math.max(0, dayFree);
  }
  if (needMin > freeMin) {
    reasons.push({ text: `إجمالي الحصص المطلوبة ${needMin} دقيقة أسبوعياً بينما الوقت المتاح ${Math.max(0, freeMin)} دقيقة فقط.` });
    return finish('infeasible');
  }
  if (!vars.length) return finish('optimal', { cost: 0 });

  const n = vars.length;
  const siblings = vars.map((v, i) => vars.reduce((a, w, j) => (j !== i && w.gid === v.gid ? (a.push(j), a) : a), []));
  const assigned = new Array(n).fill(null);
  let best = null, nodes = 0, budgetHit = false, finished = false;
  let deadline = t0 + limits.timeMs;

  function filterDom(dom, sIdx, c, tIdx, usedDay) {
    const t = vars[tIdx], s = vars[sIdx];
    const same = t.gid === s.gid;
    let out = null;
    for (let k = 0; k < dom.length; k++) {
      const x = dom[k];
      let bad = false;
      if (x.day === c.day) {
        if (same || !gapOK(x.start, x.end, c.start, c.end, buf)) bad = true;
        else if (settings.maxDailyMin && usedDay[c.day] + t.d > settings.maxDailyMin) bad = true;
      }
      if (!bad && same) bad = t.k < s.k ? x.key >= c.key : x.key <= c.key;
      if (bad) { if (!out) out = dom.slice(0, k); } else if (out) out.push(x);
    }
    return out || dom;
  }

  function dfs(doms, nAssigned, cost, used) {
    if (finished || budgetHit) return;
    if ((++nodes & 255) === 0 && (Date.now() > deadline || nodes > limits.nodeLimit)) { budgetHit = true; return; }
    if (nAssigned === n) {
      if (!best || cost < best.cost - 1e-9) {
        best = { cost, picks: assigned.slice() };
        if (!limits.optimize || cost <= 1e-9) { finished = true; return; }
        deadline = Math.min(deadline, Date.now() + limits.improveMs);
      }
      return;
    }
    let pick = -1, lb = cost;
    for (let i = 0; i < n; i++) {
      const dm = doms[i];
      if (!dm) continue;
      lb += dm[0].cost;
      if (pick < 0 || dm.length < doms[pick].length || (dm.length === doms[pick].length && vars[i].d > vars[pick].d)) pick = i;
    }
    if (best && lb >= best.cost - 1e-9) return;

    const dom = doms[pick];
    for (let ci = 0; ci < dom.length; ci++) {
      const c = dom[ci];
      let add = c.cost;
      for (const j of siblings[pick]) {
        const a = assigned[j];
        if (a) add += pairPenalty(vars[pick].g.perWeek, dayPos(c.day), dayPos(a.day));
      }
      const newCost = cost + add;
      if (best && newCost >= best.cost - 1e-9) continue;
      used[c.day] += vars[pick].d;
      const nd = doms.slice();
      nd[pick] = null;
      let ok = true;
      for (let t = 0; t < n; t++) {
        if (!nd[t]) continue;
        const f = filterDom(nd[t], pick, c, t, used);
        if (!f.length) { ok = false; break; }
        nd[t] = f;
      }
      if (ok) {
        assigned[pick] = c;
        dfs(nd, nAssigned + 1, newCost, used);
        assigned[pick] = null;
      }
      used[c.day] -= vars[pick].d;
      if (finished || budgetHit) return;
    }
  }

  const doms0 = vars.map((v) => v.cands);
  dfs(doms0, 0, 0, P.usedBase.slice());

  const stats = { nodes, ms: Date.now() - t0, variables: n };
  if (best) {
    const assignments = best.picks.map((c, i) => ({
      groupId: vars[i].gid, day: c.day, start: c.start, end: c.end, duration: vars[i].d,
    })).sort((a, b) => dayPos(a.day) - dayPos(b.day) || a.start - b.start);
    const proven = !budgetHit && (finished ? best.cost <= 1e-9 || !limits.optimize ? best.cost <= 1e-9 : true : true);
    return { status: proven ? 'optimal' : 'feasible', assignments, cost: best.cost, reasons, stats };
  }
  if (budgetHit) {
    reasons.push({ text: 'انتهت مهلة البحث دون الوصول إلى نتيجة قاطعة. زِد المهلة أو خفّف القيود.' });
    return Object.assign(finish('unknown'), { stats });
  }
  reasons.push({ text: 'جرى فحص كل التوزيعات الممكنة ولا يوجد توزيع يحقق جميع القيود معاً.' });
  return Object.assign(finish('infeasible'), { stats });
}

/** حلّ + تشخيص: عند الفشل يجرّب تخفيفات منفردة ويقول أيّها يجعل الجدول ممكناً. */
function solveWithDiagnosis(problem) {
  const res = solve(problem);
  if (res.status !== 'infeasible' && res.status !== 'unknown') return res;
  const overall = Date.now() + 4000;
  const quick = { timeMs: 250, improveMs: 0, optimize: false, nodeLimit: 60000 };
  const works = (p) => {
    if (Date.now() > overall) return false;
    const r = solve(Object.assign({}, p, { limits: quick }));
    return r.status === 'feasible' || r.status === 'optimal';
  };
  const relax = [];
  const groups = problem.groups || [];
  for (const g of groups) {
    if (!(g.sessionsPerWeek > 0)) continue;
    const rest = groups.filter((x) => x.id !== g.id);
    if (works(Object.assign({}, problem, { groups: rest }))) relax.push({ type: 'remove_group', groupId: g.id, text: `لو أُخرجت مجموعة «${g.name || g.id}» من هذه الجدولة لأصبح الجدول ممكناً.` });
  }
  if ((problem.settings.bufferMin | 0) > 0 && works(Object.assign({}, problem, { settings: Object.assign({}, problem.settings, { bufferMin: 0 }) }))) {
    relax.push({ type: 'no_buffer', text: 'إلغاء فاصل الراحة بين الحصص يجعل الجدول ممكناً.' });
  }
  if ((problem.settings.maxDailyMin | 0) > 0 && works(Object.assign({}, problem, { settings: Object.assign({}, problem.settings, { maxDailyMin: 0 }) }))) {
    relax.push({ type: 'no_daily_limit', text: 'رفع الحدّ الأقصى لدقائق اليوم يجعل الجدول ممكناً.' });
  }
  if (works(Object.assign({}, problem, { extraAbsent: 1 }))) relax.push({ type: 'allow_absent', text: 'السماح بغياب طالب واحد إضافي عن كل حصة جماعية يجعل الجدول ممكناً.' });
  if (groups.some((g) => g.allowedWindows && g.allowedWindows.length) && works(Object.assign({}, problem, { ignoreWindows: true }))) {
    relax.push({ type: 'ignore_windows', text: 'توسيع النوافذ الزمنية المسموحة للمجموعات يجعل الجدول ممكناً.' });
  }
  res.relaxations = relax;
  return res;
}

/**
 * فحص موضع حصة واحدة (للإضافة اليدوية وللتحقق قبل الحفظ).
 * ctx: {settings, group, busy:{sid:[intervals]}}، others: حصص أخرى {groupId,day,start,duration}
 * يعيد: [{code, hard, text}]
 */
function validatePlacement(ctx, p, others) {
  const P = prepare({ settings: ctx.settings, groups: [], busy: ctx.busy, fixed: [] });
  const g = ctx.group;
  const start = p.start, end = p.start + p.duration, day = p.day, buf = P.settings.bufferMin;
  const out = [];
  if (!(p.duration >= 5) || !(start >= 0) || end > 1440) return [{ code: 'BAD', hard: true, text: 'وقت الحصة غير صالح.' }];
  const av = mergeDay(normIntervals(P.settings.availability).filter((x) => x.day === day));
  const bl = mergeDay(normIntervals(P.settings.blocked).filter((x) => x.day === day));
  if (overlaps(bl, start, end)) out.push({ code: 'BLOCKED', hard: false, text: 'الحصة تتقاطع مع وقت استراحة/وقت محجوب للشيخ.' });
  else if (!inside(av, start, end)) out.push({ code: 'OUTSIDE', hard: false, text: 'الحصة خارج أوقات الشيخ المتاحة في ' + DAY_NAMES[day] + '.' });
  for (const o of others) {
    if (o.day !== day) continue;
    const oEnd = o.start + o.duration;
    if (start < oEnd && o.start < end) out.push({ code: 'OVERLAP', hard: true, text: 'تتعارض مع حصة أخرى في الوقت نفسه (' + fmt(o.start) + '–' + fmt(oEnd) + ').' });
    else if (!gapOK(start, end, o.start, oEnd, buf)) out.push({ code: 'BUFFER', hard: false, text: 'الفاصل بينها وبين حصة مجاورة أقل من ' + buf + ' دقيقة.' });
    if (g && o.groupId === g.id) out.push({ code: 'SAME_DAY', hard: false, text: 'للمجموعة نفسها حصة أخرى في هذا اليوم.' });
  }
  if (g) {
    if (g.allowedWindows && g.allowedWindows.length) {
      const gw = perDay(g.allowedWindows)[day];
      if (!inside(gw, start, end)) out.push({ code: 'GROUP_WINDOW', hard: false, text: 'خارج النوافذ المسموحة للمجموعة.' });
    }
    let absent = 0;
    for (const m of g.memberIds || []) {
      const b = ctx.busy && ctx.busy[m] ? perDay(ctx.busy[m])[day] : [];
      if (overlaps(b, start, end)) absent++;
    }
    if (absent > (g.maxAbsent | 0)) out.push({ code: 'ABSENT', hard: false, text: 'يتعارض مع انشغال ' + absent + ' من طلاب المجموعة.' });
  }
  if (P.settings.maxDailyMin) {
    const used = others.filter((o) => o.day === day).reduce((s, o) => s + o.duration, 0);
    if (used + p.duration > P.settings.maxDailyMin) out.push({ code: 'DAILY', hard: false, text: 'يتجاوز الحدّ الأقصى لدقائق اليوم.' });
  }
  return out;
}

module.exports = { solve, solveWithDiagnosis, validatePlacement, freeWindows, toMin, fmt, DAY_NAMES, normIntervals };
