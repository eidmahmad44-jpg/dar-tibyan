'use strict';
/* واجهة ولي الأمر والطالب */
(() => {
  const { S, L, esc, icon, $ } = TB;
  const cancel = '<button type="button" class="btn ghost" data-act="closeModal">إلغاء</button>';
  const sChip = (s) => ({ pending: '<span class="chip orange">قيد المراجعة</span>', paused: '<span class="chip gray">موقوف</span>' }[s.status] || '');
  const av = (s, big) => `<span class="avatar ${s.gender === 'girls' ? 'girl' : ''}" ${big ? 'style="width:60px;height:60px;font-size:26px"' : ''}>${TB.initial(s.name)}</span>`;

  /* ---------- ولي الأمر ---------- */
  TB.defView('parent', 'home', 'الرئيسية', () => {
    const d = S.data, kids = d.students, up = TB.upcoming(10).slice(0, 5);
    let h = `<div class="card hero-card"><h2>السلام عليكم ${esc(d.user.name)}</h2><p class="muted" style="margin:4px 0 0">${TB.fmtDate(d.today, true)}</p></div>`;
    h += `<div class="sec-h"><h2>الأبناء</h2><button class="btn sm" data-act="addChild">${icon('plus', 'sm')} ابن آخر</button></div>`;
    h += kids.map((s) => `<a class="card" style="display:block;text-decoration:none;color:inherit" href="#/child/${s.id}"><div class="row" style="gap:14px">${av(s)}<div class="grow"><div class="bold">${esc(s.name)} ${sChip(s)}</div><div class="small muted">${L.stage[s.stage]} · ${s.age} سنة · سورة ${TB.surah(s.surah)}</div>
      ${s.status === 'active' ? `<div class="small mt-s">حضور: <b>${s.stats.attendanceRate == null ? '—' : s.stats.attendanceRate + '%'}</b> · سلوك: ${s.stats.behavior ? TB.stars(s.stats.behavior) : '—'}</div>` : '<div class="small mt-s muted">بانتظار مراجعة الشيخ ووضعه في مجموعة.</div>'}</div>${TB.ring(s.stats.percent, 70, 'حفظ')}</div></a>`).join('') || TB.empty('users', 'لا يوجد أبناء');
    h += `<div class="sec-h"><h2>أقرب المواعيد</h2></div>${up.length ? up.map((x) => `${TB.itemHtml(x, true)}`).join('') : `<div class="card">${TB.empty('calendar', 'لا مواعيد قادمة بعد')}</div>`}`;
    return h;
  });
  TB.actions.addChild = () => TB.modal('إضافة ابن', `<form data-form="child"><div class="field"><label>اسم الطالب</label><input name="name" required maxlength="60"></div>
    <div class="two keep"><div class="field"><label>السن</label><input name="age" type="number" min="4" max="70" required data-age></div><div class="field"><label>النوع</label><select name="gender"><option value="boys">ذكر</option><option value="girls">أنثى</option></select></div></div>
    <div class="two"><div class="field"><label>المرحلة</label><select name="stage"><option value="primary">ابتدائي</option><option value="prep">إعدادي</option><option value="secondary">ثانوي</option></select></div><div class="field"><label>السورة الحالية</label><select name="surah">${TB.surahOpts(78)}</select></div></div>
    <div class="err"></div><div class="modal-f"><button class="btn" type="submit">إرسال</button>${cancel}</div></form>`);
  TB.forms.child = async (f) => { await TB.api('POST', '/api/students', { name: TB.val(f, 'name'), age: TB.val(f, 'age'), gender: TB.val(f, 'gender'), stage: TB.val(f, 'stage'), surah: TB.val(f, 'surah') }); TB.closeModal(true); TB.toast('تم إرسال الطلب للشيخ'); await TB.reload(); };
  document.addEventListener('input', (e) => { const a = e.target; if (a.matches && a.matches('[data-age]') && a.form && a.form.dataset.form === 'child' && +a.value) a.form.elements.stage.value = TB.stageByAge(+a.value); });

  TB.defView('parent', 'child', (id) => (TB.student(id) || {}).name || 'الابن', (id) => {
    const s = TB.student(id); if (!s) return TB.empty('users', 'غير موجود');
    const next = TB.upcoming(14).filter((x) => x.gid && s.groupIds.includes(x.gid)).slice(0, 4);
    return `<a class="btn ghost sm mb" href="#/home">‹ الرئيسية</a>
    <div class="card"><div class="row" style="gap:14px">${av(s, 1)}<div class="grow"><h2>${esc(s.name)}</h2><div class="row wrap gap-s mt-s"><span class="chip">${L.stage[s.stage]}</span><span class="chip gold">${L.gender[s.gender]}</span><span class="chip gray">${s.age} سنة</span>${sChip(s)}</div></div></div>
      ${s.note ? `<div class="banner info mt"><div class="small">رسالة من الشيخ: ${esc(s.note)}</div></div>` : ''}
      <div class="row wrap mt">${s.groupIds.map((g) => `<a class="btn sm soft" href="#/chat/${g}">${icon('chat', 'sm')} ${esc(TB.groupName(g))}</a>`).join('')}<button class="btn sm ghost" data-act="renameChild" data-id="${s.id}">${icon('edit', 'sm')} تعديل الاسم/السن</button>${s.status === 'pending' ? `<button class="btn sm ghost danger" data-act="delChild" data-id="${s.id}">إلغاء الطلب</button>` : ''}</div></div>
    ${s.status === 'active' ? TB.progressCard(s) : ''}
    ${next.length ? `<div class="sec-h"><h2>حصصه القادمة</h2></div>${next.map((x) => TB.itemHtml(x)).join('')}` : ''}
    <div class="grid g2 mt"><div class="card"><h3>أوقات انشغاله</h3><div class="mt-s">${TB.busyHtml(s)}</div><button class="btn sm mt" data-act="editBusy" data-id="${s.id}">${icon('clock', 'sm')} تعديل</button></div>
    <div class="card"><h3>رمز دخول الطالب</h3><p class="small muted">يدخل به ابنك إلى حسابه ليرى مواعيده.</p><span class="kbd">${s.code.slice(0, 4)}-${s.code.slice(4)}</span><div class="mt"><button class="btn sm ghost" data-act="resetCode2" data-id="${s.id}">رمز جديد</button></div></div></div>
    <div class="sec-h"><h2>سجلّ المتابعة</h2></div><div class="card" id="logs" data-sid="${s.id}">جارٍ التحميل…</div>`;
  }, (id) => { const b = $('#logs'); if (b) TB.loadLogs(id, b, false); });
  TB.actions.renameChild = (el) => { const s = TB.student(el.dataset.id); TB.modal('تعديل', `<form data-form="rename" data-id="${s.id}"><div class="field"><label>الاسم</label><input name="name" required value="${esc(s.name)}" maxlength="60"></div><div class="field"><label>السن</label><input name="age" type="number" min="4" max="70" value="${s.age}"></div><div class="err"></div><div class="modal-f"><button class="btn" type="submit">حفظ</button>${cancel}</div></form>`); };
  TB.forms.rename = async (f) => { await TB.api('PUT', `/api/students/${f.dataset.id}`, { name: TB.val(f, 'name'), age: TB.val(f, 'age') }); TB.closeModal(true); TB.toast('تم الحفظ'); await TB.reload(); };
  TB.actions.delChild = async (el) => { if (!(await TB.confirm('إلغاء طلب التسجيل؟', 'إلغاء الطلب'))) return; await TB.api('DELETE', `/api/students/${el.dataset.id}`); TB.go('/home'); await TB.reload(); };
  TB.actions.resetCode2 = async (el) => { if (!(await TB.confirm('إنشاء رمز جديد؟ سيتوقف الرمز القديم.', 'إنشاء', false))) return; await TB.api('POST', `/api/students/${el.dataset.id}/reset-code`, {}); await TB.reload(); };

  /* ---------- الطالب ---------- */
  TB.defView('student', 'home', 'الرئيسية', () => {
    const d = S.data, me = d.students[0]; if (!me) return TB.empty('user', 'لا بيانات');
    const up = TB.upcoming(14), next = up[0], today = up.filter((x) => x.date === d.today);
    let h = `<div class="card hero-card"><p class="muted" style="margin:0">أهلاً ${esc(me.name.split(' ')[0])} 🌿</p>`;
    if (me.status !== 'active') h += `<h2 class="mt-s">طلبك قيد المراجعة</h2><p class="muted">سيضعك الشيخ في مجموعتك قريباً وتظهر هنا مواعيدك.</p></div>`;
    else if (next) h += `<h3 class="mt-s">${next.kind === 'event' ? TB.L.event[next.type] : 'حصتك القادمة'}: ${esc(next.title)}</h3><div class="muted">${TB.fmtDate(next.date)} · ${next.allDay ? 'طوال اليوم' : TB.fmtTime(next.start)}${next.place ? ' · ' + esc(next.place) : ''}</div><div class="mt"><span class="count cd" data-ts="${next.ts}">${TB.untilText(next.ts)}</span></div>${next.link ? `<a class="btn gold mt" href="${esc(next.link)}" target="_blank" rel="noopener">ادخل الحصة</a>` : ''}</div>`;
    else h += `<h3 class="mt-s">لا مواعيد قادمة</h3></div>`;
    if (me.status === 'active') {
      if (today.length > 1) h += `<div class="sec-h"><h2>اليوم</h2></div>${today.map((x) => TB.itemHtml(x)).join('')}`;
      const ev = up.filter((x) => x.kind === 'event').slice(0, 4);
      if (ev.length) h += `<div class="sec-h"><h2>اختبارات ومواعيد</h2></div>${ev.map((x) => TB.itemHtml(x)).join('')}`;
      h += `<div class="sec-h"><h2>تقدّمي</h2></div>${TB.progressCard(me)}`;
      if (me.stats.presentStreak >= 3) h += `<div class="banner ok mt"><span>${icon('star')}</span><div><b>ما شاء الله!</b> حضرت ${me.stats.presentStreak} حصص متتالية. واصل.</div></div>`;
      h += `<div class="sec-h"><h2>آخر تقييم</h2></div><div class="card" id="logs" data-sid="${me.id}">…</div>`;
    }
    return h;
  }, () => { const b = $('#logs'); if (b) TB.api('GET', `/api/students/${b.dataset.sid}/logs`).then((l) => { b.innerHTML = TB.logsHtml(l.slice(0, 5), false); }).catch(() => {}); });
  setInterval(() => document.querySelectorAll('.cd').forEach((e) => { e.textContent = TB.untilText(+e.dataset.ts); }), 30000);
})();
