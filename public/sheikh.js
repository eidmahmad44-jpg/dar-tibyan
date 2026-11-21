'use strict';
/* واجهة الشيخ */
(() => {
  const { S, L, esc, icon, $, $$ } = TB;
  const V = (name, title, render, mount) => TB.defView('sheikh', name, title, render, mount);
  S.ui = S.ui || { q: '', stage: '', gender: '', group: '', status: '' };
  const D = () => S.data;
  const active = () => D().students.filter((s) => s.status === 'active');
  const opt = (v, label, sel) => `<option value="${v}"${String(sel) === String(v) ? ' selected' : ''}>${label}</option>`;
  const stageOpts = (sel) => Object.entries(L.stage).map(([k, v]) => opt(k, v, sel)).join('');
  const genderOpts = (sel) => Object.entries(L.gender).map(([k, v]) => opt(k, v, sel)).join('');
  const slotTypeOpts = (sel) => Object.entries(L.slot).map(([k, v]) => opt(k, v, sel)).join('');
  const dayOpts = (sel) => L.dayOrder.map((d) => opt(d, L.days[d], sel)).join('');
  const groupOpts = (sel, all) => (all ? opt('', all, sel) : '') + D().groups.map((g) => opt(g.id, esc(g.name), sel)).join('');
  const statusChip = (s) => ({ pending: '<span class="chip orange">قيد المراجعة</span>', paused: '<span class="chip gray">موقوف</span>', rejected: '<span class="chip red">مرفوض</span>' }[s.status] || '');
  const avatar = (s, big) => `<span class="avatar ${s.gender === 'girls' ? 'girl' : ''}" ${big ? 'style="width:60px;height:60px;font-size:26px"' : ''}>${TB.initial(s.name)}</span>`;
  const btns = (...a) => `<div class="modal-f">${a.join('')}</div>`;
  const cancel = '<button type="button" class="btn ghost" data-act="closeModal">إلغاء</button>';

  /* ================= الرئيسية ================= */
  V('home', 'الرئيسية', () => {
    const d = D(), wd = TB.weekday(d.today), act = active();
    const rates = act.map((s) => s.stats.attendanceRate).filter((x) => x != null);
    const avg = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;
    const today = d.slots.filter((s) => s.day === wd).sort((a, b) => a.start - b.start);
    const warn = act.filter((s) => s.stats.absentStreak >= 2 || (s.stats.behavior && s.stats.behavior < 3));
    const ev = TB.upcoming(10).filter((x) => x.kind === 'event').slice(0, 4);
    let h = `<div class="card hero-card"><h2>السلام عليكم ورحمة الله</h2><p class="muted" style="margin:4px 0 0">${TB.fmtDate(d.today, true)} · ${today.length ? `لديك اليوم ${today.length} حصة` : 'لا توجد حصص اليوم'}</p>
      <div class="row wrap mt"><button class="btn gold" data-act="goRecord">${icon('clip', 'sm')} تسجيل حصة</button><button class="btn" style="background:rgba(255,255,255,.15)" data-act="addStudent">${icon('plus', 'sm')} طالب</button><button class="btn" style="background:rgba(255,255,255,.15)" data-act="smart">${icon('wand', 'sm')} التوزيع الذكي</button></div></div>`;
    if (d.pending) h += `<a class="banner warn mt" style="text-decoration:none" href="#/students"><span>${icon('bell')}</span><div><b>${d.pending} طلب تسجيل جديد بانتظار مراجعتك</b><div class="small">اضغط للمراجعة وتحديد المجموعة.</div></div></a>`;
    h += `<div class="grid g4 mt"><div class="stat"><b>${act.length}</b><span>طالب</span></div><div class="stat"><b>${d.groups.length}</b><span>مجموعة</span></div><div class="stat"><b>${d.slots.length}</b><span>حصة أسبوعية</span></div><div class="stat"><b>${avg == null ? '—' : avg + '%'}</b><span>متوسط الحضور (30 يوماً)</span></div></div>`;
    h += `<div class="sec-h"><h2>حصص اليوم</h2></div>`;
    h += today.length ? today.map((s) => { const g = TB.group(s.groupId) || {}; return `<div class="slot" style="border-inline-start-color:${g.color}"><div class="tm">${TB.fmtTime(s.start)}<div class="tiny muted">${TB.fmtDur(s.duration)}</div></div><div class="grow"><div class="bold">${esc(g.name)}</div><div class="small muted">${g.members || 0} طالب</div></div><button class="btn sm" data-act="recordSlot" data-id="${s.id}">تسجيل</button></div>`; }).join('') : `<div class="card flat">${TB.empty('calendar', 'يوم بلا حصص')}</div>`;
    if (warn.length) h += `<div class="sec-h"><h2>يحتاجون متابعة</h2></div><div class="card list">${warn.slice(0, 6).map((s) => `<a class="item" href="#/student/${s.id}">${avatar(s)}<div class="grow"><div class="bold">${esc(s.name)}</div><div class="small muted">${s.stats.absentStreak >= 2 ? `غاب ${s.stats.absentStreak} حصص متتالية` : ''}${s.stats.behavior && s.stats.behavior < 3 ? ` سلوك ${s.stats.behavior}/5` : ''}</div></div>${TB.icon('alert')}</a>`).join('')}</div>`;
    if (ev.length) h += `<div class="sec-h"><h2>مواعيد قادمة</h2></div>${ev.map((x) => TB.itemHtml(x)).join('')}`;
    if (!d.groups.length) h += `<div class="banner info mt"><span>${icon('book')}</span><div><b>ابدأ من هنا</b><ol class="small" style="margin:6px 0 0;padding-inline-start:18px"><li>أنشئ المجموعات (حسب المرحلة والنوع).</li><li>راجع طلبات التسجيل وأضف الطلاب إلى مجموعاتهم.</li><li>اضبط أوقاتك من الإعدادات ثم اضغط «التوزيع الذكي».</li></ol><a class="btn sm mt-s" href="#/groups">إنشاء أول مجموعة</a></div></div>`;
    return h;
  });
  TB.actions.goRecord = () => { S.recPre = null; TB.go('/record'); };
  TB.actions.recordSlot = (el) => { const s = D().slots.find((x) => x.id === el.dataset.id); S.recPre = { groupId: s.groupId, date: D().today }; TB.go('/record'); };

  /* ================= الطلاب ================= */
  const filtered = () => {
    const u = S.ui, q = u.q.trim();
    return D().students.filter((s) => (!q || s.name.includes(q) || (s.parent && s.parent.phone.includes(q))) && (!u.stage || s.stage === u.stage) && (!u.gender || s.gender === u.gender) && (!u.group || s.groupIds.includes(u.group)) && (!u.status || s.status === u.status));
  };
  const studentList = () => {
    const all = filtered().sort((a, b) => a.name.localeCompare(b.name, 'ar')), lim = S.ui.limit || 100, list = all.slice(0, lim);
    if (!list.length) return TB.empty('users', D().students.length ? 'لا نتائج مطابقة' : 'لا يوجد طلاب بعد. اضغط «طالب» للإضافة، أو انتظر تسجيل أولياء الأمور.');
    return `<div class="card list">${list.map((s) => `<a class="item" href="#/student/${s.id}">${avatar(s)}<div class="grow"><div class="bold">${esc(s.name)} ${statusChip(s)}</div><div class="small muted">${L.stage[s.stage]} · ${L.gender[s.gender]} · ${s.age} سنة · سورة ${TB.surah(s.surah)}</div><div class="tiny muted">${s.groupIds.map((g) => esc(TB.groupName(g))).join('، ') || 'بلا مجموعة'}</div></div><div class="c small">${s.stats.attendanceRate == null ? '' : `<b>${s.stats.attendanceRate}%</b><div class="tiny muted">حضور</div>`}</div></a>`).join('')}</div>${all.length > lim ? `<div class="c mt"><button class="btn ghost" data-act="moreStudents">عرض المزيد (${all.length - lim})</button></div>` : ''}<div class="c small muted mt-s">${all.length} طالب</div>`;
  };
  TB.actions.moreStudents = () => { S.ui.limit = (S.ui.limit || 100) + 100; $('#slist').innerHTML = studentList(); };
  V('students', 'الطلاب', () => {
    const d = D(), pend = d.students.filter((s) => s.status === 'pending');
    let h = '';
    if (pend.length) h += `<div class="card gold"><h3>${icon('bell')} طلبات التسجيل (${pend.length})</h3><div class="list mt-s">${pend.map((s) => `<div class="item" style="cursor:default">${avatar(s)}<div class="grow"><div class="bold">${esc(s.name)}</div><div class="small muted">${s.age} سنة · ${L.stage[s.stage]} · ${L.gender[s.gender]} · سورة ${TB.surah(s.surah)}</div><div class="small"><b>${esc(s.parent.name)}</b> · <a href="tel:${esc(s.parent.phone)}" dir="ltr">${esc(s.parent.phone)}</a></div></div><button class="btn sm" data-act="approve" data-id="${s.id}">قبول</button><button class="btn sm danger ghost" data-act="reject" data-id="${s.id}">رفض</button></div>`).join('')}</div></div><div class="mt"></div>`;
    h += `<div class="row wrap mb"><div class="grow" style="min-width:200px"><input type="search" id="q" placeholder="ابحث بالاسم أو رقم الهاتف" value="${esc(S.ui.q)}" aria-label="بحث"></div><button class="btn" data-act="addStudent">${icon('plus', 'sm')} طالب</button></div>
      <div class="row wrap mb" style="gap:8px"><select data-flt="stage" style="width:auto">${opt('', 'كل المراحل', S.ui.stage)}${stageOpts(S.ui.stage)}</select><select data-flt="gender" style="width:auto">${opt('', 'بنين وبنات', S.ui.gender)}${genderOpts(S.ui.gender)}</select><select data-flt="group" style="width:auto">${groupOpts(S.ui.group, 'كل المجموعات')}</select><select data-flt="status" style="width:auto">${opt('', 'كل الحالات', S.ui.status)}${opt('active', 'مقبول', S.ui.status)}${opt('pending', 'قيد المراجعة', S.ui.status)}${opt('paused', 'موقوف', S.ui.status)}</select></div><div id="slist">${studentList()}</div>`;
    return h;
  }, () => {
    const upd = () => { S.ui.limit = 100; $('#slist').innerHTML = studentList(); };
    $('#q').addEventListener('input', (e) => { S.ui.q = e.target.value; upd(); });
    $$('[data-flt]').forEach((x) => x.addEventListener('change', () => { S.ui[x.dataset.flt] = x.value; upd(); }));
  });

  const groupChecks = (s, name = 'groups') => `<div class="card flat" style="max-height:200px;overflow:auto;padding:8px 12px">${D().groups.length ? D().groups.map((g) => { const fit = s && g.stage === s.stage && g.gender === s.gender; return `<label class="check"><input type="checkbox" name="${name}" value="${g.id}" ${s && s.groupIds.includes(g.id) ? 'checked' : ''}><span class="dot" style="background:${esc(g.color)}"></span><span class="grow">${esc(g.name)}</span><span class="tiny ${fit ? '' : 'muted'}">${L.stage[g.stage]} · ${L.gender[g.gender]}${fit ? ' ✓' : ''}</span></label>`; }).join('') : '<div class="small muted">لا توجد مجموعات بعد.</div>'}</div>`;
  const studentForm = (s) => {
    const add = !s;
    return `<form data-form="student" data-id="${s ? s.id : ''}">
      <div class="field"><label>اسم الطالب</label><input name="name" required maxlength="60" value="${esc(s ? s.name : '')}"></div>
      <div class="two keep"><div class="field"><label>السن</label><input name="age" type="number" min="4" max="70" required value="${s ? s.age : ''}" data-age></div><div class="field"><label>النوع</label><select name="gender">${genderOpts(s ? s.gender : 'boys')}</select></div></div>
      <div class="two"><div class="field"><label>المرحلة</label><select name="stage">${stageOpts(s ? s.stage : 'primary')}</select></div><div class="field"><label>السورة الحالية</label><select name="surah">${TB.surahOpts(s ? s.surah : 78)}</select></div></div>
      <div class="two keep"><div class="field"><label>آية الوقوف</label><input name="ayah" type="number" min="0" max="300" value="${s ? s.ayah || 0 : 0}"></div><div class="field"><label>أجزاء محفوظة قبل الالتحاق</label><input name="baseJuz" type="number" min="0" max="30" value="${s ? s.baseJuz || 0 : 0}"></div></div>
      ${add ? `<div class="two"><div class="field"><label>هاتف ولي الأمر</label><input name="parentPhone" type="tel" dir="ltr" required></div><div class="field"><label>اسم ولي الأمر (اختياري)</label><input name="parentName" maxlength="60"></div></div>` : `<div class="field"><label>الحالة</label><select name="status">${opt('active', 'مقبول', s.status)}${opt('pending', 'قيد المراجعة', s.status)}${opt('paused', 'موقوف', s.status)}${opt('rejected', 'مرفوض', s.status)}</select></div>`}
      <div class="field"><label>المجموعات</label>${groupChecks(s)}</div>
      <div class="field"><label>ملاحظة ظاهرة لولي الأمر</label><input name="note" maxlength="300" value="${esc(s ? s.note : '')}"></div>
      <div class="field"><label>ملاحظة خاصة بك (لا يراها أحد)</label><input name="privateNote" maxlength="500" value="${esc(s ? s.privateNote : '')}"></div>
      <div class="err"></div>${btns('<button class="btn" type="submit">حفظ</button>', cancel)}</form>`;
  };
  const wireAge = (ov) => { const a = $('[data-age]', ov); if (a) a.addEventListener('input', () => { const n = +a.value; if (n) $('select[name=stage]', ov).value = TB.stageByAge(n); }); };
  TB.actions.addStudent = () => wireAge(TB.modal('إضافة طالب', studentForm(null)));
  TB.actions.editStudent = (el) => wireAge(TB.modal('تعديل بيانات الطالب', studentForm(TB.student(el.dataset.id))));
  TB.forms.student = async (f) => {
    const id = f.dataset.id;
    const body = { name: TB.val(f, 'name'), age: TB.val(f, 'age'), gender: TB.val(f, 'gender'), stage: TB.val(f, 'stage'), surah: TB.val(f, 'surah'), ayah: TB.val(f, 'ayah'), baseJuz: TB.val(f, 'baseJuz'), note: TB.val(f, 'note'), privateNote: TB.val(f, 'privateNote'), groupIds: TB.checked(f, 'groups') };
    if (id) { body.status = TB.val(f, 'status'); await TB.api('PUT', `/api/students/${id}`, body); TB.closeModal(true); TB.toast('تم الحفظ'); await TB.reload(); return; }
    body.parentPhone = TB.val(f, 'parentPhone'); body.parentName = TB.val(f, 'parentName');
    const r = await TB.api('POST', '/api/students', body);
    await TB.reload(false);
    TB.modal('تمت إضافة الطالب', `<div class="banner ok"><span>${icon('check')}</span><div>سلّم هذه البيانات لولي الأمر:</div></div><div class="card flat"><div>رقم الدخول (الهاتف): <b dir="ltr">${esc(body.parentPhone)}</b></div>${r.parentTempPassword ? `<div class="mt-s">كلمة المرور المؤقتة: <span class="kbd">${r.parentTempPassword}</span> <div class="tiny muted">تُعرض مرة واحدة، ويُطلب من ولي الأمر تغييرها عند أول دخول.</div></div>` : '<div class="mt-s small muted">الهاتف مسجّل مسبقاً، فأُضيف الطالب إلى الحساب نفسه.</div>'}<div class="mt-s">رمز دخول الطالب: <span class="kbd">${r.code.slice(0, 4)}-${r.code.slice(4)}</span></div></div>${btns('<button class="btn" data-act="closeModal">تم</button>')}`);
    TB.render();
  };
  TB.actions.approve = (el) => {
    const s = TB.student(el.dataset.id);
    TB.modal(`قبول ${s.name}`, `<p class="small muted">اختر المجموعة المناسبة (المطابقة للمرحلة والنوع معلَّمة بـ ✓).</p><form data-form="approve" data-id="${s.id}">${groupChecks(s)}<div class="err"></div>${btns('<button class="btn" type="submit">قبول</button>', cancel)}</form>`);
  };
  TB.forms.approve = async (f) => { await TB.api('PUT', `/api/students/${f.dataset.id}`, { status: 'active', groupIds: TB.checked(f, 'groups') }); TB.closeModal(true); TB.toast('تم قبول الطالب'); await TB.reload(); };
  TB.actions.reject = async (el) => { if (!(await TB.confirm('رفض هذا الطلب وحذف بياناته؟', 'رفض وحذف'))) return; await TB.api('DELETE', `/api/students/${el.dataset.id}`); TB.toast('تم الرفض'); await TB.reload(); };

  /* ----- تفاصيل الطالب ----- */
  V('student', 'بيانات الطالب', (id) => {
    const s = TB.student(id); if (!s) return TB.empty('users', 'الطالب غير موجود');
    const wa = s.parent ? TB.waLink(s.parent.phone) : '#';
    return `<a class="btn ghost sm mb" href="#/students">‹ الطلاب</a>
      <div class="card"><div class="row" style="gap:14px">${avatar(s, 1)}<div class="grow"><h2>${esc(s.name)}</h2><div class="row wrap gap-s mt-s"><span class="chip">${L.stage[s.stage]}</span><span class="chip gold">${L.gender[s.gender]}</span><span class="chip gray">${s.age} سنة</span>${statusChip(s)}</div></div></div>
      <div class="row wrap mt"><button class="btn sm" data-act="editStudent" data-id="${s.id}">${icon('edit', 'sm')} تعديل</button><button class="btn sm ghost danger" data-act="delStudent" data-id="${s.id}">${icon('trash', 'sm')} حذف</button></div></div>
      ${TB.progressCard(s)}
      <div class="grid g2 mt"><div class="card"><h3>ولي الأمر</h3>${s.parent ? `<p style="margin:6px 0">${esc(s.parent.name)} · <span dir="ltr">${esc(s.parent.phone)}</span></p><div class="row wrap"><a class="btn sm" href="tel:${esc(s.parent.phone)}">${icon('phone', 'sm')} اتصال</a><a class="btn sm soft" href="${wa}" target="_blank" rel="noopener">${icon('wa', 'sm')} واتساب</a><button class="btn sm ghost" data-act="resetParentPw" data-id="${s.parentId}">إعادة كلمة المرور</button></div>` : ''}</div>
      <div class="card"><h3>رمز دخول الطالب</h3><p style="margin:6px 0"><span class="kbd">${s.code.slice(0, 4)}-${s.code.slice(4)}</span></p><button class="btn sm ghost" data-act="resetCode" data-id="${s.id}">رمز جديد</button></div></div>
      <div class="grid g2 mt"><div class="card"><h3>المجموعات</h3><div class="mt-s">${s.groupIds.map((g) => `<a class="chip" href="#/group/${g}" style="margin:2px">${esc(TB.groupName(g))}</a>`).join('') || '<span class="muted small">بلا مجموعة</span>'}</div></div>
      <div class="card"><h3>أوقات الانشغال</h3><div class="mt-s">${TB.busyHtml(s)}</div></div></div>
      ${s.note || s.privateNote ? `<div class="card mt">${s.note ? `<div class="small"><b>ملاحظة لولي الأمر:</b> ${esc(s.note)}</div>` : ''}${s.privateNote ? `<div class="small mt-s"><b>ملاحظتك الخاصة:</b> ${esc(s.privateNote)}</div>` : ''}</div>` : ''}
      <div class="sec-h"><h2>سجلّ المتابعة</h2></div><div class="card" id="logs" data-sid="${s.id}">جارٍ التحميل…</div>`;
  }, (id) => { const b = $('#logs'); if (b) TB.loadLogs(id, b, true); });
  TB.views.sheikh.student.title = (id) => (TB.student(id) || {}).name || 'الطالب';
  TB.actions.delStudent = async (el) => { if (!(await TB.confirm('حذف الطالب وكل سجلّاته نهائياً؟', 'حذف نهائي'))) return; await TB.api('DELETE', `/api/students/${el.dataset.id}`); TB.toast('تم الحذف'); TB.go('/students'); await TB.reload(false); };
  TB.actions.resetCode = async (el) => { if (!(await TB.confirm('إنشاء رمز جديد؟ سيتوقف الرمز القديم.', 'إنشاء', false))) return; await TB.api('POST', `/api/students/${el.dataset.id}/reset-code`, {}); TB.toast('تم إنشاء رمز جديد'); await TB.reload(); };
  TB.actions.resetParentPw = async (el) => { if (!(await TB.confirm('إعادة تعيين كلمة مرور ولي الأمر؟', 'إعادة', false))) return; const r = await TB.api('POST', `/api/parents/${el.dataset.id}/reset-password`, {}); TB.modal('كلمة مرور مؤقتة', `<p>سلّمها لولي الأمر:</p><p class="c"><span class="kbd">${r.password}</span></p>${btns('<button class="btn" data-act="closeModal">تم</button>')}`); };

  /* ================= المجموعات ================= */
  const colors = ['#19432d', '#2c6a47', '#b98100', '#1f5f8b', '#7a3b69', '#a1452d', '#3b6f78', '#6b6b1f'];
  const groupForm = (g) => `<form data-form="group" data-id="${g ? g.id : ''}">
    <div class="field"><label>اسم المجموعة</label><input name="name" required maxlength="60" value="${esc(g ? g.name : '')}" placeholder="مثال: ابتدائي بنين — حلقة النور"></div>
    <div class="two"><div class="field"><label>المرحلة</label><select name="stage">${stageOpts(g ? g.stage : 'primary')}</select></div><div class="field"><label>النوع</label><select name="gender">${genderOpts(g ? g.gender : 'boys')}</select></div></div>
    <div class="two"><div class="field"><label>المستوى / الوصف</label><input name="level" maxlength="60" value="${esc(g ? g.level : '')}" placeholder="مثال: جزء عمّ"></div><div class="field"><label>نوع الحصة</label><select name="sessionType">${slotTypeOpts(g ? g.sessionType : 'hifz')}</select></div></div>
    <div class="two keep"><div class="field"><label>حصص أسبوعياً</label><input type="number" name="sessionsPerWeek" min="0" max="7" value="${g ? g.sessionsPerWeek : 2}"></div><div class="field"><label>مدة الحصة (دقيقة)</label><input type="number" name="durationMin" min="15" max="240" step="5" value="${g ? g.durationMin : 45}"></div></div>
    <div class="two"><div class="field"><label>الوقت المفضّل</label><select name="preferredTime">${Object.entries(L.pref).map(([k, v]) => opt(k, v, g ? g.preferredTime : 'any')).join('')}</select></div><div class="field"><label>أقصى عدد غياب مسموح بسبب الانشغال</label><input type="number" name="maxAbsent" min="0" max="20" value="${g ? g.maxAbsent : 0}"><span class="hint">0 = لا تُعقد الحصة إلا والجميع متاح (الأدق).</span></div></div>
    <div class="two"><div class="field"><label>المكان</label><input name="place" maxlength="100" value="${esc(g ? g.place : '')}" placeholder="القاعة / رابط الاجتماع"></div><div class="field"><label>السعة</label><input type="number" name="capacity" min="1" max="100" value="${g ? g.capacity : 12}"></div></div>
    <div class="field"><label>لون المجموعة</label><div class="row wrap">${colors.map((c) => `<label style="cursor:pointer"><input type="radio" name="color" value="${c}" ${(g ? g.color : colors[0]) === c ? 'checked' : ''} style="position:absolute;opacity:0"><span class="dot" style="width:30px;height:30px;background:${c};outline:3px solid transparent"></span></label>`).join('')}</div></div>
    <div class="field"><label>نوافذ زمنية خاصة بهذه المجموعة (اختياري)</label><span class="hint">إن تُركت فارغة تُستخدم نافذة المرحلة من الإعدادات.</span>${TB.ivEditor('win', g ? g.allowedWindows : [])}</div>
    <label class="check"><input type="checkbox" name="allowStudentChat" ${!g || g.allowStudentChat !== false ? 'checked' : ''}><span>يشارك الطلاب أنفسهم في غرفة التواصل <span class="hint">(مغلق افتراضياً لمجموعات البنات: الغرفة لأولياء الأمور)</span></span></label>
    <label class="check"><input type="checkbox" name="chatLocked" ${g && g.chatLocked ? 'checked' : ''}><span>الكتابة في الغرفة للشيخ فقط (إعلانات)</span></label>
    <div class="err"></div>${btns('<button class="btn" type="submit">حفظ</button>', cancel)}</form>`;
  const colorPick = (ov) => { $$('input[name=color]', ov).forEach((r) => { const sync = () => $$('input[name=color]', ov).forEach((x) => { x.nextElementSibling.style.outlineColor = x.checked ? '#13301e' : 'transparent'; }); r.addEventListener('change', sync); sync(); }); const g = $('select[name=gender]', ov); const c = $('input[name=allowStudentChat]', ov); if (g && c && !g.form.dataset.id) g.addEventListener('change', () => { c.checked = g.value === 'boys'; }); };
  TB.actions.addGroup = () => colorPick(TB.modal('مجموعة جديدة', groupForm(null)));
  TB.actions.editGroup = (el) => colorPick(TB.modal('تعديل المجموعة', groupForm(TB.group(el.dataset.id))));
  TB.forms.group = async (f) => {
    const id = f.dataset.id, c = $('input[name=color]:checked', f);
    const body = { name: TB.val(f, 'name'), stage: TB.val(f, 'stage'), gender: TB.val(f, 'gender'), level: TB.val(f, 'level'), sessionType: TB.val(f, 'sessionType'), sessionsPerWeek: TB.val(f, 'sessionsPerWeek'), durationMin: TB.val(f, 'durationMin'), preferredTime: TB.val(f, 'preferredTime'), maxAbsent: TB.val(f, 'maxAbsent'), place: TB.val(f, 'place'), capacity: TB.val(f, 'capacity'), color: c ? c.value : undefined, allowedWindows: TB.readIv(f, 'win'), allowStudentChat: f.elements.allowStudentChat.checked, chatLocked: f.elements.chatLocked.checked };
    await TB.api(id ? 'PUT' : 'POST', id ? `/api/groups/${id}` : '/api/groups', body);
    TB.closeModal(true); TB.toast('تم الحفظ'); await TB.reload();
  };
  V('groups', 'المجموعات', () => {
    const d = D();
    return `<div class="sec-h"><h2>المجموعات (${d.groups.length})</h2><button class="btn" data-act="addGroup">${icon('plus', 'sm')} مجموعة</button></div>
      ${d.groups.length ? `<div class="grid ga">${d.groups.map((g) => { const n = d.slots.filter((s) => s.groupId === g.id).length; return `<a class="card" style="text-decoration:none;color:inherit;border-top:5px solid ${esc(g.color)}" href="#/group/${g.id}"><div class="row"><h3 class="grow">${esc(g.name)}</h3>${S.data.unread[g.id] ? `<span class="badge">${S.data.unread[g.id]}</span>` : ''}</div><div class="row wrap gap-s mt-s"><span class="chip">${L.stage[g.stage]}</span><span class="chip gold">${L.gender[g.gender]}</span></div><div class="small muted mt-s">${g.members}/${g.capacity} طالب · ${n}/${g.sessionsPerWeek} حصص أسبوعياً × ${TB.fmtDur(g.durationMin)}</div>${n < g.sessionsPerWeek ? '<div class="tiny" style="color:var(--orange)">لم تُجدوَل كل حصصها بعد</div>' : ''}</a>`; }).join('')}</div>` : `<div class="card">${TB.empty('book', 'أنشئ مجموعاتك: لكل مرحلة ولكل نوع (بنين/بنات) مجموعة أو أكثر.')}</div>`}`;
  });
  V('group', 'المجموعة', (id) => {
    const g = TB.group(id); if (!g) return TB.empty('book', 'المجموعة غير موجودة');
    const mem = D().students.filter((s) => s.groupIds.includes(id)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const slots = D().slots.filter((s) => s.groupId === id).sort((a, b) => L.dayOrder.indexOf(a.day) - L.dayOrder.indexOf(b.day) || a.start - b.start);
    return `<a class="btn ghost sm mb" href="#/groups">‹ المجموعات</a>
      <div class="card" style="border-top:5px solid ${esc(g.color)}"><h2>${esc(g.name)}</h2><div class="row wrap gap-s mt-s"><span class="chip">${L.stage[g.stage]}</span><span class="chip gold">${L.gender[g.gender]}</span><span class="chip gray">${L.slot[g.sessionType]}</span>${g.level ? `<span class="chip blue">${esc(g.level)}</span>` : ''}</div>
      <p class="small muted">${g.sessionsPerWeek} حصص أسبوعياً × ${TB.fmtDur(g.durationMin)} · وقت مفضّل: ${L.pref[g.preferredTime]} · غياب مسموح: ${g.maxAbsent}</p>
      <div class="row wrap"><a class="btn sm gold" href="#/chat/${g.id}">${icon('chat', 'sm')} غرفة التواصل</a><button class="btn sm" data-act="smart" data-id="${g.id}">${icon('wand', 'sm')} جدولة المجموعة</button><button class="btn sm soft" data-act="editGroup" data-id="${g.id}">${icon('edit', 'sm')} تعديل</button><button class="btn sm ghost danger" data-act="delGroup" data-id="${g.id}">${icon('trash', 'sm')} حذف</button></div></div>
      <div class="sec-h"><h2>الطلاب (${mem.length}/${g.capacity})</h2><button class="btn sm" data-act="members" data-id="${g.id}">${icon('users', 'sm')} إدارة الطلاب</button></div>
      ${mem.length ? `<div class="card list">${mem.map((s) => `<a class="item" href="#/student/${s.id}">${avatar(s)}<div class="grow"><div class="bold">${esc(s.name)}</div><div class="small muted">سورة ${TB.surah(s.surah)} · ${s.age} سنة</div></div>${s.busy.length ? `<span class="chip gray">${s.busy.length} انشغال</span>` : ''}</a>`).join('')}</div>` : `<div class="card">${TB.empty('users', 'لا طلاب في هذه المجموعة بعد')}</div>`}
      <div class="sec-h"><h2>الحصص الأسبوعية</h2><button class="btn sm" data-act="addSlot" data-gid="${g.id}">${icon('plus', 'sm')} حصة</button></div>
      ${slots.length ? slots.map((s) => `<div class="slot edit" style="border-inline-start-color:${esc(g.color)}" data-act="editSlot" data-id="${s.id}"><div class="tm">${L.days[s.day]}</div><div class="grow">${TB.fmtTime(s.start)} – ${TB.fmtTime(s.start + s.duration)}</div><span class="chip">${L.slot[s.type]}</span></div>`).join('') : `<div class="card">${TB.empty('calendar', 'لا حصص بعد')}</div>`}`;
  });
  TB.views.sheikh.group.title = (id) => (TB.group(id) || {}).name || 'المجموعة';
  TB.actions.delGroup = async (el) => { if (!(await TB.confirm('حذف المجموعة وحصصها وغرفة تواصلها ورسائلها؟', 'حذف نهائي'))) return; await TB.api('DELETE', `/api/groups/${el.dataset.id}`); TB.go('/groups'); await TB.reload(); };
  TB.actions.members = (el) => {
    const g = TB.group(el.dataset.id);
    const list = D().students.filter((s) => s.status !== 'rejected').sort((a, b) => (b.stage === g.stage && b.gender === g.gender) - (a.stage === g.stage && a.gender === g.gender) || a.name.localeCompare(b.name, 'ar'));
    TB.modal(`طلاب ${g.name}`, `<form data-form="members" data-id="${g.id}"><div style="max-height:55vh;overflow:auto">${list.map((s) => { const fit = s.stage === g.stage && s.gender === g.gender; return `<label class="check"><input type="checkbox" name="sid" value="${s.id}" ${s.groupIds.includes(g.id) ? 'checked' : ''}><span class="grow">${esc(s.name)} ${s.status === 'pending' ? '<span class="chip orange">جديد</span>' : ''}</span><span class="tiny ${fit ? '' : 'muted'}">${L.stage[s.stage]} · ${L.gender[s.gender]}${fit ? ' ✓' : ''}</span></label>`; }).join('') || '<p class="muted">لا طلاب بعد.</p>'}</div><div class="err"></div>${btns('<button class="btn" type="submit">حفظ</button>', cancel)}</form>`);
  };
  TB.forms.members = async (f) => { await TB.api('PUT', `/api/groups/${f.dataset.id}/members`, { studentIds: TB.checked(f, 'sid') }); TB.closeModal(true); TB.toast('تم الحفظ'); await TB.reload(); };

  /* ================= الجدول والحصص ================= */
  V('schedule', 'الجدول الأسبوعي', () => `<div class="row wrap mb"><button class="btn gold" data-act="smart">${icon('wand', 'sm')} التوزيع الذكي</button><button class="btn" data-act="addSlot">${icon('plus', 'sm')} حصة يدوية</button><button class="btn soft" data-act="addEvent">${icon('flag', 'sm')} موعد / اختبار</button></div>${TB.scheduleHtml(true)}<div class="mt">${TB.calBlock()}</div>`);
  const slotForm = (s, gid) => `<form data-form="slot" data-id="${s ? s.id : ''}">
    <div class="field"><label>المجموعة</label><select name="groupId" ${s ? 'disabled' : ''} required>${D().groups.map((g) => opt(g.id, esc(g.name), s ? s.groupId : gid)).join('')}</select></div>
    <div class="two"><div class="field"><label>اليوم</label><select name="day">${dayOpts(s ? s.day : 6)}</select></div><div class="field"><label>الوقت</label><input type="time" name="start" required value="${TB.toInput(s ? s.start : 1020)}"></div></div>
    <div class="two"><div class="field"><label>المدة (دقيقة)</label><input type="number" name="duration" min="5" max="480" step="5" value="${s ? s.duration : (TB.group(gid) || {}).durationMin || 45}"></div><div class="field"><label>النوع</label><select name="type">${slotTypeOpts(s ? s.type : (TB.group(gid) || {}).sessionType)}</select></div></div>
    <div class="field"><label>المكان</label><input name="place" maxlength="100" value="${esc(s ? s.place : '')}"></div><div class="field"><label>رابط (اختياري، للحصص عن بُعد)</label><input name="link" type="url" dir="ltr" value="${esc(s ? s.link : '')}" placeholder="https://"></div>
    <label class="check"><input type="checkbox" name="pinned" ${s && s.pinned ? 'checked' : ''}><span>تثبيت: لا يغيّرها التوزيع الذكي</span></label>
    <div class="err"></div>${btns('<button class="btn" type="submit">حفظ</button>', s ? `<button type="button" class="btn danger ghost" data-act="delSlot" data-id="${s.id}">حذف</button>` : '', cancel)}</form>`;
  TB.actions.addSlot = (el) => { if (!D().groups.length) return TB.toast('أنشئ مجموعة أولاً', true); TB.modal('حصة أسبوعية', slotForm(null, el.dataset.gid || D().groups[0].id)); };
  TB.actions.editSlot = (el) => TB.modal('تعديل الحصة', slotForm(D().slots.find((x) => x.id === el.dataset.id)));
  TB.actions.delSlot = async (el) => { await TB.api('DELETE', `/api/slots/${el.dataset.id}`); TB.closeModal(true); TB.toast('تم الحذف'); await TB.reload(); };
  TB.forms.slot = async (f, force) => {
    const id = f.dataset.id;
    const body = { groupId: id ? undefined : TB.val(f, 'groupId'), day: TB.val(f, 'day'), start: TB.fromInput(TB.val(f, 'start')), duration: TB.val(f, 'duration'), type: TB.val(f, 'type'), place: TB.val(f, 'place'), link: TB.val(f, 'link'), pinned: f.elements.pinned.checked, force: !!force };
    try { await TB.api(id ? 'PUT' : 'POST', id ? `/api/slots/${id}` : '/api/slots', body); }
    catch (e) {
      if (e.status === 409 && e.data && e.data.issues && !e.data.hard) {
        if (await TB.confirm('ملاحظات على هذا الموعد:\n• ' + e.data.issues.map((i) => i.text).join('\n• ') + '\n\nهل تريد حفظه رغم ذلك؟', 'احفظ رغم ذلك', false)) return TB.forms.slot(f, true);
        return;
      }
      throw e;
    }
    TB.closeModal(true); TB.toast('تم الحفظ'); await TB.reload();
  };

  /* ----- التوزيع الذكي ----- */
  const smartBody = (pre) => {
    const gs = D().groups.filter((g) => g.sessionsPerWeek > 0);
    if (!gs.length) return `<p>أنشئ مجموعات بعدد حصص أسبوعي أكبر من صفر أولاً.</p>`;
    return `<p class="small muted">يبحث المحرّك في <b>كل</b> التوزيعات الممكنة عن جدول يحقق كل القيود معاً: أوقاتك المتاحة، الاستراحات، فاصل الراحة، انشغال كل طالب، نافذة كل مرحلة. إن لم يوجد جدول ممكن فعلاً يخبرك بذلك ويشرح السبب بدل أن يقدّم تقريباً غير واقعي.</p>
      <form data-form="smart"><div class="field"><label>المجموعات المراد جدولتها</label>${gs.map((g) => `<label class="check"><input type="checkbox" name="g" value="${g.id}" ${!pre || pre === g.id ? 'checked' : ''}><span class="dot" style="background:${esc(g.color)}"></span><span class="grow">${esc(g.name)}</span><span class="tiny muted">${g.sessionsPerWeek}×${g.durationMin}د · ${g.members} طالب</span></label>`).join('')}</div>
      <label class="check"><input type="checkbox" name="opt" checked><span>حسّن الجدول (أيام متباعدة، وقت مفضّل، أقل تعارضاً)</span></label>
      <div class="field"><label>مهلة البحث</label><select name="t">${opt(3000, '3 ثوانٍ (سريع)', 3000)}${opt(8000, '8 ثوانٍ (أعمق)', 3000)}</select></div>
      <div class="err"></div><button class="btn gold block" type="submit">${icon('wand', 'sm')} ابحث عن جدول</button></form>`;
  };
  TB.actions.smart = (el) => TB.modal('التوزيع الذكي للمواعيد', smartBody(el && el.dataset && el.dataset.id));
  let lastSolve = null;
  TB.forms.smart = async (f) => {
    const ids = TB.checked(f, 'g'); if (!ids.length) throw new Error('اختر مجموعة واحدة على الأقل');
    const optimize = f.elements.opt.checked, timeMs = +TB.val(f, 't');
    const box = f.closest('.modal-b'); box.innerHTML = `<div class="empty"><div class="boot-spin">${icon('wand')}</div>جارٍ البحث في التوزيعات الممكنة…</div>`;
    await new Promise((r) => setTimeout(r, 30));
    let res;
    try { res = await TB.api('POST', '/api/schedule/solve', { groupIds: ids, options: { optimize, timeMs } }); } catch (e) { box.innerHTML = smartBody(); throw e; }
    lastSolve = { ids, res };
    const ok = res.status === 'optimal' || res.status === 'feasible';
    let h = '';
    if (ok) {
      h += `<div class="banner ok"><span>${icon('check')}</span><div><b>${res.status === 'optimal' ? 'وُجد جدول يحقق كل القيود' : 'وُجد جدول يحقق كل القيود (لم يكتمل التحسين ضمن المهلة)'}</b><div class="small">${res.assignments.length} حصة · فُحص ${res.stats.nodes.toLocaleString('en')} احتمال في ${res.stats.ms}ms</div></div></div>`;
      for (const day of L.dayOrder) {
        const list = res.assignments.filter((a) => a.day === day); if (!list.length) continue;
        h += `<div class="day-h">${L.days[day]}</div>${list.map((a) => { const g = TB.group(a.groupId); return `<div class="slot" style="border-inline-start-color:${esc(g.color)}"><div class="tm">${TB.fmtTime(a.start)}<div class="tiny muted">إلى ${TB.fmtTime(a.end)}</div></div><div class="grow bold">${esc(g.name)}</div></div>`; }).join('')}`;
      }
      if (res.warnings && res.warnings.length) h += `<div class="banner info"><div class="small">${res.warnings.map(esc).join('<br>')}</div></div>`;
      h += `<p class="small muted mt">سيستبدل التطبيق الحصص الحالية للمجموعات المختارة (عدا المثبّتة) بهذا الجدول.</p>${btns('<button class="btn gold" data-act="applySolve">اعتماد الجدول</button>', '<button class="btn ghost" data-act="smart">بحث جديد</button>')}`;
    } else {
      h += `<div class="banner ${res.status === 'unknown' ? 'warn' : 'bad'}"><span>${icon('alert')}</span><div><b>${res.status === 'unknown' ? 'لم يصل البحث إلى نتيجة قاطعة في المهلة' : 'لا يوجد جدول ممكن بهذه القيود'}</b><ul class="small">${res.reasons.map((r) => `<li>${esc(r.text)}</li>`).join('')}</ul></div></div>`;
      if (res.relaxations && res.relaxations.length) h += `<div class="banner info"><span>${icon('wand')}</span><div><b>ما الذي يجعله ممكناً؟</b><ul class="small">${res.relaxations.map((r) => `<li>${esc(r.text)}</li>`).join('')}</ul></div></div>`;
      h += `<p class="small muted">لا نقدّم «أقرب جدول» لأنه سيتضمن تعارضاً حقيقياً. عدّل أحد الشروط أعلاه ثم أعد المحاولة.</p>${btns('<a class="btn" href="#/settings">أوقات الشيخ</a>', '<button class="btn ghost" data-act="smart">رجوع</button>')}`;
    }
    box.innerHTML = h;
  };
  TB.actions.applySolve = async (el) => {
    if (!lastSolve) return; el.disabled = true;
    try { const r = await TB.api('POST', '/api/schedule/apply', { groupIds: lastSolve.ids, assignments: lastSolve.res.assignments }); TB.closeModal(true); TB.toast(`تم اعتماد ${r.created} حصة`); TB.go('/schedule'); await TB.reload(); }
    catch (e) { el.disabled = false; throw e; }
  };

  /* ================= المواعيد والاختبارات ================= */
  const eventForm = (e) => `<form data-form="event" data-id="${e ? e.id : ''}">
    <div class="field"><label>العنوان</label><input name="title" required maxlength="80" value="${esc(e ? e.title : '')}" placeholder="مثال: اختبار جزء عمّ"></div>
    <div class="two"><div class="field"><label>النوع</label><select name="type">${Object.entries(L.event).map(([k, v]) => opt(k, v, e ? e.type : 'exam')).join('')}</select></div><div class="field"><label>التاريخ</label><input type="date" name="date" required value="${e ? e.date : D().today}"></div></div>
    <label class="check"><input type="checkbox" name="allday" ${!e || e.start == null ? 'checked' : ''}><span>طوال اليوم (بلا وقت محدد)</span></label>
    <div class="two keep"><div class="field"><label>الوقت</label><input type="time" name="start" value="${TB.toInput(e && e.start != null ? e.start : 1020)}"></div><div class="field"><label>المدة (دقيقة)</label><input type="number" name="duration" min="5" max="600" value="${e ? e.duration : 60}"></div></div>
    <div class="field"><label>لمن؟</label><select name="groupId">${groupOpts(e ? e.groupId : '', 'كل الطلاب')}</select></div>
    <div class="field"><label>ملاحظة</label><input name="note" maxlength="300" value="${esc(e ? e.note : '')}"></div><div class="field"><label>المكان</label><input name="place" maxlength="100" value="${esc(e ? e.place : '')}"></div>
    <div class="err"></div>${btns('<button class="btn" type="submit">حفظ</button>', e ? `<button type="button" class="btn danger ghost" data-act="delEvent" data-id="${e.id}">حذف</button>` : '', cancel)}</form>`;
  TB.actions.addEvent = () => TB.modal('موعد جديد', eventForm(null));
  TB.actions.editEvent = (el) => TB.modal('تعديل الموعد', eventForm(D().events.find((x) => x.id === el.dataset.id)));
  TB.actions.delEvent = async (el) => { await TB.api('DELETE', `/api/events/${el.dataset.id}`); TB.closeModal(true); TB.toast('تم الحذف'); await TB.reload(); };
  TB.forms.event = async (f) => {
    const id = f.dataset.id, body = { title: TB.val(f, 'title'), type: TB.val(f, 'type'), date: TB.val(f, 'date'), start: f.elements.allday.checked ? null : TB.fromInput(TB.val(f, 'start')), duration: TB.val(f, 'duration'), groupId: TB.val(f, 'groupId') || null, note: TB.val(f, 'note'), place: TB.val(f, 'place') };
    await TB.api(id ? 'PUT' : 'POST', id ? `/api/events/${id}` : '/api/events', body); TB.closeModal(true); TB.toast('تم الحفظ'); await TB.reload();
  };
  V('events', 'المواعيد والاختبارات', () => {
    const all = D().events.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    return `<div class="sec-h"><h2>كل المواعيد</h2><button class="btn" data-act="addEvent">${icon('plus', 'sm')} موعد</button></div>${all.length ? all.map((e) => `<div class="slot edit" style="opacity:${e.date < D().today ? '.6' : 1};border-inline-start-color:${e.type === 'exam' ? '#b3261e' : '#f2b409'}" data-act="editEvent" data-id="${e.id}"><div class="tm"><div class="tiny muted">${TB.fmtShort(e.date)}</div>${e.start == null ? 'طوال اليوم' : TB.fmtTime(e.start)}</div><div class="grow"><div class="bold">${esc(e.title)}</div><div class="small muted">${e.groupId ? esc(TB.groupName(e.groupId)) : 'كل الطلاب'}</div></div><span class="chip ${e.type === 'exam' ? 'red' : 'gold'}">${L.event[e.type]}</span></div>`).join('') : `<div class="card">${TB.empty('flag', 'لا مواعيد. أضف اختباراً أو درساً تربوياً أو رحلة.')}</div>`}`;
  });

  /* ================= تسجيل الحصة ================= */
  const R = () => S.rec;
  const starPick = (sid, f, v) => `<span class="star-pick" data-f="${f}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="${n <= v ? 'on' : ''}" data-act="recStar" data-sid="${sid}" data-f="${f}" data-v="${n}" aria-label="${n}">★</button>`).join('')}</span>`;
  const recRow = (s) => {
    const e = R().entries[s.id] || {}, pres = e.attendance === 'present' || e.attendance === 'late', m = e.memo;
    return `<div class="rec-row ${e.attendance ? 's-' + e.attendance : ''}" data-row="${s.id}"><div class="row wrap"><b class="grow">${esc(s.name)}</b><span class="seg att">${Object.entries(L.att).map(([k, v]) => `<button type="button" data-act="recAtt" data-sid="${s.id}" data-v="${k}" class="${e.attendance === k ? 'on' : ''}">${v}</button>`).join('')}</span></div>
      ${pres ? `<div class="grid g2 mt-s"><div><span class="small muted">السلوك</span><br>${starPick(s.id, 'behavior', e.behavior || 0)}</div><div><span class="small muted">الاجتهاد</span><br>${starPick(s.id, 'commitment', e.commitment || 0)}</div></div>
      ${m ? `<div class="card flat mt-s" style="background:var(--green-t)"><div class="two keep"><select data-rf="memo.kind" aria-label="النوع">${Object.entries(L.memo).map(([k, v]) => opt(k, v, m.kind)).join('')}</select><select data-rf="memo.surah" aria-label="السورة">${TB.surahOpts(m.surah)}</select></div><div class="two keep mt-s"><input type="number" min="1" data-rf="memo.from" value="${m.from}" aria-label="من آية" placeholder="من آية"><input type="number" min="1" data-rf="memo.to" value="${m.to}" aria-label="إلى آية" placeholder="إلى آية"></div><div class="row mt-s"><span class="small muted">الإتقان</span>${starPick(s.id, 'memo.rating', m.rating || 0)}<button type="button" class="btn sm ghost danger" style="margin-inline-start:auto" data-act="recMemoOff" data-sid="${s.id}">إزالة</button></div></div>` : `<button type="button" class="btn sm soft mt-s" data-act="recMemoOn" data-sid="${s.id}">${icon('book', 'sm')} تسجيل حفظ / مراجعة</button>`}` : ''}
      ${e.attendance ? `<input class="mt-s" type="text" data-rf="note" maxlength="300" placeholder="ملاحظة (اختياري)" value="${esc(e.note || '')}" aria-label="ملاحظة">` : ''}</div>`;
  };
  const recBody = () => {
    const r = R(), g = TB.group(r.groupId), mem = r.members;
    if (!g) return '';
    return `${mem.length ? `<div class="row wrap mb"><button class="btn sm soft" data-act="recAll">${icon('check', 'sm')} الكل حاضر</button><span class="small muted">${mem.length} طالب</span></div>${mem.map(recRow).join('')}<div class="savebar"><button class="btn gold block lg" data-act="recSave">${icon('check', 'sm')} حفظ الحصة</button></div>` : TB.empty('users', 'لا طلاب مقبولون في هذه المجموعة.')}`;
  };
  V('record', 'تسجيل الحصة', () => {
    const gs = D().groups; if (!gs.length) return `<div class="card">${TB.empty('book', 'أنشئ مجموعة أولاً')}</div>`;
    const pre = S.recPre || {}; S.recPre = null;
    S.rec = { groupId: pre.groupId || (S.rec && S.rec.groupId) || gs[0].id, date: pre.date || D().today, entries: {}, members: [] };
    return `<div class="card"><div class="two"><div class="field" style="margin:0"><label>المجموعة</label><select id="rec-g">${groupOpts(R().groupId)}</select></div><div class="field" style="margin:0"><label>التاريخ</label><input type="date" id="rec-d" max="${D().today}" value="${R().date}"></div></div></div><div class="mt" id="rec-body"></div>`;
  }, async () => {
    if (!S.rec) return;
    const load = async () => {
      const r = R(); r.groupId = $('#rec-g').value; r.date = $('#rec-d').value || D().today;
      r.members = D().students.filter((s) => s.status === 'active' && s.groupIds.includes(r.groupId)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      r.entries = {};
      try {
        const logs = await TB.api('GET', `/api/logs/day?date=${r.date}&groupId=${r.groupId}`);
        for (const l of logs) r.entries[l.studentId] = { attendance: l.attendance, behavior: l.behavior, commitment: l.commitment, note: l.note, memo: l.memo ? { ...l.memo } : null };
        if (logs.length) TB.toast('تم تحميل تقييم هذا اليوم المسجّل سابقاً');
      } catch (e) { TB.errToast(e); }
      $('#rec-body').innerHTML = recBody();
    };
    $('#rec-g').addEventListener('change', load); $('#rec-d').addEventListener('change', load);
    const body = $('#rec-body');
    body.addEventListener('input', (e) => rf(e)); body.addEventListener('change', (e) => rf(e));
    await load();
  });
  function rf(e) {
    const t = e.target, f = t.dataset && t.dataset.rf; if (!f) return;
    const sid = t.closest('[data-row]').dataset.row, en = R().entries[sid]; if (!en) return;
    if (f === 'note') en.note = t.value;
    else if (f.startsWith('memo.')) { en.memo[f.slice(5)] = t.type === 'number' || f === 'memo.surah' ? +t.value : t.value; if (f === 'memo.surah' && e.type === 'change') { en.memo.from = 1; en.memo.to = Math.min(10, window.SURAHS[en.memo.surah - 1][1]); redraw(sid); } }
  }
  const redraw = (sid) => { const row = $(`[data-row="${sid}"]`); if (row) row.outerHTML = recRow(TB.student(sid)); };
  TB.actions.recAtt = (el) => { const sid = el.dataset.sid, en = (R().entries[sid] = R().entries[sid] || {}); en.attendance = el.dataset.v; if (en.attendance === 'absent' || en.attendance === 'excused') { en.behavior = 0; en.commitment = 0; en.memo = null; } redraw(sid); };
  TB.actions.recStar = (el) => { const sid = el.dataset.sid, en = R().entries[sid], f = el.dataset.f, v = +el.dataset.v; if (f.startsWith('memo.')) en.memo.rating = en.memo.rating === v ? 0 : v; else en[f] = en[f] === v ? 0 : v; redraw(sid); };
  TB.actions.recMemoOn = (el) => { const sid = el.dataset.sid, s = TB.student(sid); const n = s.surah || 78; R().entries[sid].memo = { kind: 'new', surah: n, from: Math.max(1, s.ayah || 1), to: Math.max(1, s.ayah || 1), rating: 0 }; redraw(sid); };
  TB.actions.recMemoOff = (el) => { R().entries[el.dataset.sid].memo = null; redraw(el.dataset.sid); };
  TB.actions.recAll = () => { for (const s of R().members) { const en = (R().entries[s.id] = R().entries[s.id] || {}); if (!en.attendance) en.attendance = 'present'; } $('#rec-body').innerHTML = recBody(); };
  TB.actions.recSave = async (el) => {
    const r = R(), entries = r.members.filter((s) => r.entries[s.id] && r.entries[s.id].attendance).map((s) => ({ studentId: s.id, ...r.entries[s.id] }));
    if (!entries.length) throw new Error('حدّد حضور طالب واحد على الأقل');
    const unmarked = r.members.length - entries.length;
    if (unmarked && !(await TB.confirm(`لم تحدّد حال ${unmarked} طالب. حفظ من حُدّدوا فقط؟`, 'حفظ', false))) return;
    el.disabled = true;
    try {
      const slot = D().slots.find((s) => s.groupId === r.groupId && s.day === TB.weekday(r.date));
      const out = await TB.api('POST', '/api/logs/batch', { date: r.date, groupId: r.groupId, slotId: slot ? slot.id : '', entries });
      TB.toast(`تم حفظ ${out.saved} تقييم`); await TB.reload(false);
    } finally { el.disabled = false; }
  };

  /* ================= الإعدادات ================= */
  V('settings', 'الإعدادات', () => {
    const c = D().center, sc = D().settings.schedule, sw = D().settings.stageWindows;
    const link = `${location.origin}/app#/register`, local = /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname) || location.protocol !== 'https:';
    const msg = `السلام عليكم ورحمة الله 🌿\nيسعدنا تسجيل ابنكم في ${D().center.name}.\nسجّلوا من هنا (بيانات الطالب ورقمكم فقط):\n${link}`;
    return `<div class="card gold"><h3>${icon('send')} رابط التسجيل للأسر</h3>${local ? `<div class="banner warn mt-s"><span>${icon('alert')}</span><div class="small">هذا الرابط يعمل على جهازك فقط، ولا يفتحه غيرك. لإرساله للأسر يجب نشر التطبيق على الإنترنت بـ HTTPS (الخطوات في ملف DEPLOY.md).</div></div>` : ''}<p class="small muted">أرسل الرابط في مجموعات واتساب. كل ولي أمر يسجّل بنفسه، وتصل الطلبات إليك (أو تُقبل تلقائياً إن فعّلت ذلك).</p><div class="kbd" style="direction:ltr;word-break:break-all;display:block">${esc(link)}</div><div class="row wrap mt-s"><button class="btn sm" data-act="copy" data-text="${esc(link)}">نسخ الرابط</button><a class="btn sm gold" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">${icon('wa', 'sm')} مشاركة عبر واتساب</a></div></div>
    <div class="card"><h3>تسجيل الطلاب</h3><label class="check"><input type="checkbox" data-act="autoApprove" ${D().settings.autoApprove ? 'checked' : ''}><span>قبول التسجيل تلقائياً ووضع الطالب في المجموعة المناسبة لمرحلته ونوعه <span class="hint">(إن لم توجد مجموعة مناسبة بها مكان يبقى الطلب بانتظارك)</span></span></label></div>\n    <form class="card" data-form="center"><h3>بيانات الدار</h3><p class="small muted">تظهر في الصفحة الرئيسية للتطبيق وللأسر.</p>
      <div class="field"><label>اسم الدار</label><input name="name" value="${esc(c.name)}" maxlength="80"></div>
      <div class="two"><div class="field"><label>هاتف الدار</label><input name="phone" type="tel" dir="ltr" value="${esc(c.phone)}"></div><div class="field"><label>واتساب (للتواصل)</label><input name="whatsapp" type="tel" dir="ltr" value="${esc(c.whatsapp)}"></div></div>
      <div class="two"><div class="field"><label>العنوان</label><input name="address" value="${esc(c.address)}" maxlength="200"></div><div class="field"><label>مفتاح الدولة (مصر 20)</label><input name="countryCode" value="${esc(c.countryCode)}" dir="ltr" maxlength="4"></div></div>
      <div class="field"><label>نبذة عن الدار</label><textarea name="about" maxlength="600">${esc(c.about)}</textarea></div><div class="err"></div><button class="btn" type="submit">حفظ</button></form>
    <form class="card" data-form="schedule"><h3>أوقات الشيخ (يعتمد عليها التوزيع الذكي)</h3>
      <div class="field"><label>الأوقات المتاحة للتدريس</label><span class="hint">أضف فترة لكل يوم تكون فيه متاحاً.</span>${TB.ivEditor('av', sc.availability)}</div>
      <div class="field"><label>أوقات محجوبة (صلاة، راحة، التزامات)</label><span class="hint">لا تُوضع فيها حصص حتى لو كانت ضمن المتاح.</span>${TB.ivEditor('bl', sc.blocked, true)}</div>
      <div class="two keep"><div class="field"><label>فاصل بين الحصص (دقيقة)</label><input type="number" name="buffer" min="0" max="60" value="${sc.bufferMin}"></div><div class="field"><label>حدّ أقصى لدقائق التدريس يومياً</label><input type="number" name="maxDaily" min="0" max="1440" value="${sc.maxDailyMin}"><span class="hint">0 = بلا حدّ</span></div></div>
      <div class="field"><label>دقّة الجدولة</label><select name="gran">${[5, 10, 15, 20, 30].map((n) => opt(n, `كل ${n} دقيقة`, sc.granularityMin)).join('')}</select></div>
      <h3 class="mt">النوافذ المناسبة لكل مرحلة</h3><p class="small muted">الأوقات التي يناسب فيها حضور طلاب المرحلة (بعد المدرسة وقبل النوم).</p>
      ${['primary', 'prep', 'secondary'].map((k) => `<div class="two keep"><div class="field"><label>${L.stage[k]} — من</label><input type="time" name="sw_${k}_f" value="${TB.toInput(sw[k].from)}"></div><div class="field"><label>إلى</label><input type="time" name="sw_${k}_t" value="${TB.toInput(sw[k].to)}"></div></div>`).join('')}
      <div class="err"></div><button class="btn" type="submit">حفظ الأوقات</button></form>
    <div class="card"><h3>الحساب والنسخ الاحتياطي</h3><div class="row wrap mt-s"><button class="btn soft" data-act="backup">${icon('download', 'sm')} تنزيل نسخة احتياطية</button><button class="btn ghost danger" data-act="logout">${icon('logout', 'sm')} تسجيل الخروج</button></div><p class="tiny muted">يحتفظ الخادم تلقائياً بنسخة يومية في المجلد data/backups (آخر 14 يوماً).</p></div>
    <div class="card"><h3>${icon('lock')} السجل الأمني (آخر الأحداث)</h3><div id="audit" class="small mt-s">جارٍ التحميل…</div></div>
    <form class="card" data-form="pw"><h3>تغيير كلمة المرور</h3><div class="two"><div class="field"><label>الحالية</label><input type="password" name="old" autocomplete="current-password" required></div><div class="field"><label>الجديدة (10 أحرف)</label><input type="password" name="password" minlength="10" autocomplete="new-password" required></div></div><div class="err"></div><button class="btn" type="submit">تغيير</button></form>`;
  });
  const AUD = { login_ok: 'دخول ناجح', login_fail: 'محاولة دخول فاشلة', login_locked: 'محاولة أثناء القفل المؤقت', code_ok: 'دخول طالب', code_fail: 'رمز طالب خاطئ', register: 'تسجيل جديد', password_change: 'تغيير كلمة مرور', reset_password: 'إعادة تعيين كلمة مرور', reset_code: 'رمز طالب جديد', student_delete: 'حذف طالب', backup: 'نسخة احتياطية', setup_ok: 'إعداد الدار', setup_fail: 'محاولة إعداد فاشلة' };
  TB.views.sheikh.settings.mount = () => { const b = $('#audit'); if (b) TB.api('GET', '/api/audit').then((l) => { b.innerHTML = l.length ? `<table class="t">${l.slice(0, 30).map((x) => `<tr><td class="tiny">${new Date(x.t).toLocaleString('ar-EG-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' })}</td><td>${AUD[x.ev] || esc(x.ev)}</td><td dir="ltr" class="tiny">${esc(x.who)}</td></tr>`).join('')}</table>` : '<span class="muted">لا أحداث بعد.</span>'; }).catch(() => {}); };
  TB.actions.autoApprove = async (el) => { await TB.api('PUT', '/api/settings', { autoApprove: el.checked }); TB.toast(el.checked ? 'فُعّل القبول التلقائي' : 'أُوقف القبول التلقائي'); await TB.reload(false); };
  TB.forms.center = async (f) => { await TB.api('PUT', '/api/settings', { center: { name: TB.val(f, 'name'), phone: TB.val(f, 'phone'), whatsapp: TB.val(f, 'whatsapp'), address: TB.val(f, 'address'), countryCode: TB.val(f, 'countryCode'), about: TB.val(f, 'about') } }); TB.toast('تم الحفظ'); await TB.reload(); };
  TB.forms.schedule = async (f) => {
    const sw = {}; for (const k of ['primary', 'prep', 'secondary']) sw[k] = { from: TB.fromInput(TB.val(f, `sw_${k}_f`)), to: TB.fromInput(TB.val(f, `sw_${k}_t`)) };
    await TB.api('PUT', '/api/settings', { schedule: { availability: TB.readIv(f, 'av'), blocked: TB.readIv(f, 'bl'), bufferMin: TB.val(f, 'buffer'), maxDailyMin: TB.val(f, 'maxDaily'), granularityMin: TB.val(f, 'gran') }, stageWindows: sw });
    TB.toast('تم حفظ الأوقات'); await TB.reload();
  };
  TB.actions.backup = async () => {
    const r = await fetch('/api/backup', { headers: { Authorization: 'Bearer ' + S.token } }); if (!r.ok) throw new Error('تعذّر التنزيل');
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = `tibyan-backup-${D().today}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  /* ================= المزيد (للهاتف) ================= */
  V('more', 'المزيد', () => `<div class="card list">${[['groups', 'المجموعات', 'book'], ['record', 'تسجيل الحصة', 'clip'], ['events', 'المواعيد والاختبارات', 'flag'], ['settings', 'الإعدادات', 'settings']].map(([n, l, i]) => `<a class="item" href="#/${n}"><span class="avatar" style="background:var(--green-t);color:var(--green)">${icon(i)}</span><div class="grow bold">${l}</div></a>`).join('')}</div><button class="btn danger ghost block mt" data-act="logout">${icon('logout', 'sm')} تسجيل الخروج</button>`);
  TB.forms.pw = TB.forms.pw || (async () => {});
})();
