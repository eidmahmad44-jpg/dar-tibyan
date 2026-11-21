'use strict';
/* مكوّنات مشتركة بين الأدوار: الجدول، الدردشة، التقدّم، التذكيرات، حسابي */
(() => {
  const { S, L, esc, icon, $, $$ } = TB;

  /* ---------- القادم من الحصص والمواعيد ---------- */
  TB.kidsOf = (gid) => S.data.students.filter((s) => s.status === 'active' && s.groupIds.includes(gid));
  TB.upcoming = (days = 14) => {
    const d = S.data, out = [];
    for (let i = 0; i < days; i++) {
      const ds = TB.addDays(d.today, i), wd = TB.weekday(ds);
      for (const s of d.slots) if (s.day === wd) out.push({ kind: 'slot', id: s.id, date: ds, start: s.start, end: s.start + s.duration, title: TB.groupName(s.groupId), type: s.type, gid: s.groupId, place: s.place, link: s.link, color: (TB.group(s.groupId) || {}).color, ts: TB.ts(ds, s.start) });
      for (const e of d.events) if (e.date === ds) out.push({ kind: 'event', id: e.id, date: ds, start: e.start == null ? 0 : e.start, end: e.start == null ? 1440 : e.start + e.duration, allDay: e.start == null, title: e.title, type: e.type, gid: e.groupId, note: e.note, place: e.place, ts: TB.ts(ds, e.start == null ? 0 : e.start) });
    }
    out.sort((a, b) => a.ts - b.ts);
    const t = Date.now();
    return out.filter((x) => TB.ts(x.date, x.end >= 1440 ? 1439 : x.end) > t);
  };
  TB.untilText = (ts) => {
    const m = Math.round((ts - Date.now()) / 60000);
    if (m <= 0) return 'الآن';
    if (m < 60) return `بعد ${m} دقيقة`;
    const h = Math.floor(m / 60); if (h < 24) return `بعد ${h} ساعة${m % 60 ? ' و' + (m % 60) + ' د' : ''}`;
    const dd = Math.floor(h / 24); return dd === 1 ? 'غداً' : `بعد ${dd} أيام`;
  };
  TB.itemHtml = (x, withKids) => {
    const label = x.kind === 'slot' ? `${esc(x.title)}` : esc(x.title);
    const typ = x.kind === 'slot' ? L.slot[x.type] : L.event[x.type];
    const kids = withKids && x.gid ? TB.kidsOf(x.gid).map((k) => esc(k.name.split(' ')[0])).join('، ') : '';
    const when = x.allDay ? 'طوال اليوم' : `${TB.fmtTime(x.start)} – ${TB.fmtTime(x.end)}`;
    return `<div class="slot" style="border-inline-start-color:${x.kind === 'event' ? (x.type === 'exam' ? '#b3261e' : '#f2b409') : x.color || '#19432d'}">
      <div class="tm">${x.date ? `<div class="tiny muted">${TB.fmtShort(x.date)}</div>` : ''}${when}</div>
      <div class="grow"><div class="bold">${label}</div><div class="small muted">${kids ? 'للابن: ' + kids + ' · ' : ''}${x.place ? esc(x.place) : ''}</div></div>
      <span class="chip ${x.type === 'exam' ? 'red' : x.kind === 'event' ? 'gold' : ''}">${typ || ''}</span></div>`;
  };

  /* ---------- الجدول الأسبوعي ---------- */
  TB.scheduleHtml = (editable) => {
    const d = S.data, wd = TB.weekday(d.today);
    let h = '';
    if (!d.slots.length) h += TB.empty('calendar', editable ? 'لا توجد حصص بعد. أضف حصة، أو استخدم «التوزيع الذكي» ليبني الجدول من أوقاتك ومن أوقات الطلاب.' : 'لم يُحدَّد جدول بعد. سيظهر هنا فور أن يضعه الشيخ.');
    for (const day of L.dayOrder) {
      const list = d.slots.filter((s) => s.day === day).sort((a, b) => a.start - b.start);
      if (!list.length) continue;
      h += `<div class="day-h ${day === wd ? 'today' : ''}">${L.days[day]} ${day === wd ? '<span class="chip gold">اليوم</span>' : ''}</div>`;
      for (const s of list) {
        const g = TB.group(s.groupId) || {};
        const kids = !editable ? TB.kidsOf(s.groupId).map((k) => esc(k.name.split(' ')[0])).join('، ') : '';
        h += `<div class="slot ${editable ? 'edit' : ''}" style="border-inline-start-color:${g.color || '#19432d'}" ${editable ? `data-act="editSlot" data-id="${s.id}" tabindex="0"` : ''}>
          <div class="tm">${TB.fmtTime(s.start)}<div class="tiny muted">${TB.fmtDur(s.duration)}</div></div>
          <div class="grow"><div class="bold">${esc(g.name || '—')}</div><div class="small muted">${kids ? 'للابن: ' + kids + ' · ' : ''}${s.place ? esc(s.place) : ''}${s.pinned ? ' · مثبّتة' : ''}</div></div>
          <span class="chip">${L.slot[s.type] || 'حصة'}</span>${s.link ? `<a class="icon-btn" href="${esc(s.link)}" target="_blank" rel="noopener" aria-label="رابط الحصة">${icon('link', 'sm')}</a>` : ''}</div>`;
      }
    }
    const ev = d.events.filter((e) => e.date >= d.today).sort((a, b) => (a.date + (a.start || 0)) < (b.date + (b.start || 0)) ? -1 : 1).slice(0, 30);
    if (ev.length || editable) {
      h += `<div class="sec-h"><h2>المواعيد والاختبارات القادمة</h2>${editable ? `<button class="btn sm" data-act="addEvent">${icon('plus', 'sm')} موعد</button>` : ''}</div>`;
      h += ev.length ? ev.map((e) => `<div class="slot ${editable ? 'edit' : ''}" style="border-inline-start-color:${e.type === 'exam' ? '#b3261e' : '#f2b409'}" ${editable ? `data-act="editEvent" data-id="${e.id}" tabindex="0"` : ''}><div class="tm"><div class="tiny muted">${TB.fmtDate(e.date)}</div>${e.start == null ? 'طوال اليوم' : TB.fmtTime(e.start)}</div><div class="grow"><div class="bold">${esc(e.title)}</div><div class="small muted">${e.groupId ? esc(TB.groupName(e.groupId)) : 'للجميع'}${e.note ? ' · ' + esc(e.note) : ''}</div></div><span class="chip ${e.type === 'exam' ? 'red' : 'gold'}">${L.event[e.type]}</span></div>`).join('') : TB.empty('flag', 'لا توجد مواعيد قادمة');
    }
    return h;
  };
  const calBlock = () => {
    const u = S.data.user, https = `${location.origin}/api/calendar/${u.calToken}.ics`;
    return `<div class="card"><h3>${icon('bell')} تنبيهات على هاتفك</h3><p class="small muted">أضف جدولك إلى تقويم الهاتف مرة واحدة، فيذكّرك التقويم قبل كل حصة واختبار بنصف ساعة ويتحدّث تلقائياً.</p>
      <div class="row wrap"><a class="btn" href="${https.replace(/^https?:/, 'webcal:')}">${icon('calendar', 'sm')} أضف إلى التقويم</a><a class="btn ghost" href="${https}" download="tibyan.ics">${icon('download', 'sm')} تنزيل الملف</a><button class="btn soft" data-act="copy" data-text="${https}">نسخ الرابط</button>
      ${'Notification' in window ? `<button class="btn soft" data-act="enableNotif">${icon('bell', 'sm')} تنبيهات المتصفح</button>` : ''}</div></div>`;
  };
  TB.calBlock = calBlock;
  TB.actions.copy = async (el) => { try { await navigator.clipboard.writeText(el.dataset.text); TB.toast('تم النسخ'); } catch { prompt('انسخ الرابط:', el.dataset.text); } };
  TB.actions.enableNotif = async () => {
    const p = await Notification.requestPermission();
    TB.toast(p === 'granted' ? 'تم تفعيل التنبيهات أثناء فتح التطبيق' : 'لم يُسمح بالتنبيهات', p !== 'granted'); TB.armReminders();
  };
  let timers = [];
  TB.armReminders = () => {
    timers.forEach(clearTimeout); timers = [];
    if (!S.data || S.data.user.role === 'sheikh' || !('Notification' in window) || Notification.permission !== 'granted') return;
    for (const x of TB.upcoming(2)) {
      if (x.allDay) continue;
      for (const before of [30, 5]) {
        const delay = x.ts - before * 60000 - Date.now();
        if (delay > 0 && delay < 2 ** 31 - 1) timers.push(setTimeout(async () => {
          const title = `${x.title} — بعد ${before} دقيقة`, body = `${TB.fmtTime(x.start)}${x.place ? ' · ' + x.place : ''}`;
          try { const reg = await navigator.serviceWorker.ready; reg.showNotification(title, { body, icon: '/icons/icon-192.png', dir: 'rtl', lang: 'ar', tag: x.id + x.date + before }); } catch { new Notification(title, { body }); }
        }, delay));
      }
    }
  };

  /* ---------- التقدّم والسجل ---------- */
  TB.progressCard = (s) => {
    const st = s.stats;
    return `<div class="card"><div class="row" style="gap:16px">${TB.ring(st.percent, 92, 'من المصحف')}
      <div class="grow"><div class="small muted">يحفظ الآن</div><div class="q bold">سورة ${TB.surah(s.surah)}${s.ayah ? ' — آية ' + s.ayah : ''}</div>
      <div class="small muted mt-s">حفظ مسجّل في الدار: <b>${st.newAyahs}</b> آية${s.baseJuz ? ` · قبل الالتحاق: <b>${s.baseJuz}</b> جزء` : ''}</div></div></div>
      <div class="grid g2 mt">
        <div><div class="small muted">الحضور (آخر 30 يوماً)</div><div class="bold">${st.attendanceRate == null ? '—' : st.attendanceRate + '%'}</div>${st.attendanceRate == null ? '' : `<div class="bar mt-s"><i style="width:${st.attendanceRate}%"></i></div>`}</div>
        <div><div class="small muted">الالتزام بالمواعيد (عدم التأخر)</div><div class="bold">${st.punctuality == null ? '—' : st.punctuality + '%'}</div>${st.punctuality == null ? '' : `<div class="bar mt-s"><i style="width:${st.punctuality}%"></i></div>`}</div>
        <div><div class="small muted">السلوك</div>${st.behavior ? TB.stars(st.behavior) + ` <span class="small">${st.behavior}</span>` : '—'}</div>
        <div><div class="small muted">الاجتهاد والالتزام</div>${st.commitment ? TB.stars(st.commitment) + ` <span class="small">${st.commitment}</span>` : '—'}</div></div></div>`;
  };
  TB.logsHtml = (logs, canDelete) => {
    if (!logs.length) return TB.empty('clip', 'لا توجد تقييمات مسجّلة بعد.');
    return `<div class="tl">${logs.map((l) => {
      const m = l.memo;
      return `<div class="ev ${l.attendance}"><div class="row wrap gap-s"><b>${TB.fmtDate(l.date)}</b><span class="chip ${{ present: '', late: 'gold', absent: 'red', excused: 'blue' }[l.attendance]}">${L.att[l.attendance]}</span>${l.groupId && TB.group(l.groupId) ? `<span class="small muted">${esc(TB.groupName(l.groupId))}</span>` : ''}${canDelete ? `<button class="icon-btn" style="width:30px;height:30px;margin-inline-start:auto" data-act="delLog" data-id="${esc(l.id)}" aria-label="حذف">${icon('trash', 'sm')}</button>` : ''}</div>
        ${m ? `<div class="mt-s"><span class="chip blue">${L.memo[m.kind]}</span> <span class="q">سورة ${TB.surah(m.surah)}</span> <span class="small">من آية ${m.from} إلى ${m.to}</span> ${m.rating ? TB.stars(m.rating) : ''}</div>` : ''}
        ${l.behavior || l.commitment ? `<div class="small mt-s">${l.behavior ? 'السلوك ' + TB.stars(l.behavior) : ''} ${l.commitment ? '&nbsp; الاجتهاد ' + TB.stars(l.commitment) : ''}</div>` : ''}
        ${l.note ? `<div class="small muted mt-s">«${esc(l.note)}»</div>` : ''}</div>`;
    }).join('')}</div>`;
  };
  TB.loadLogs = async (sid, box, canDelete) => {
    try { const logs = await TB.api('GET', `/api/students/${sid}/logs`); box.innerHTML = TB.logsHtml(logs, canDelete); } catch (e) { box.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  };
  TB.busyHtml = (s) => (s.busy && s.busy.length ? s.busy.map((b) => `<div class="small">• ${L.days[b.day]}: ${TB.fmtTime(b.from)} – ${TB.fmtTime(b.to)}${b.label ? ' (' + esc(b.label) + ')' : ''}</div>`).join('') : '<div class="small muted">لم تُحدَّد أوقات انشغال.</div>');
  TB.busyModal = (s) => {
    TB.modal(`أوقات انشغال ${s.name}`, `<p class="small muted">أدخل الأوقات التي <b>لا يستطيع</b> فيها الحضور (مدرسة، دروس خصوصية، نادٍ…). يتجنّبها الشيخ عند وضع المواعيد.</p>
      <form data-form="busy" data-id="${s.id}">${TB.ivEditor('busy', s.busy, true)}<div class="err"></div><div class="modal-f"><button class="btn" type="submit">حفظ</button><button type="button" class="btn ghost" data-act="closeModal">إلغاء</button></div></form>`);
  };
  TB.forms.busy = async (f) => { await TB.api('PUT', `/api/students/${f.dataset.id}`, { busy: TB.readIv(f, 'busy') }); TB.closeModal(true); TB.toast('تم حفظ أوقات الانشغال'); await TB.reload(); };
  TB.actions.editBusy = (el) => TB.busyModal(TB.student(el.dataset.id));

  /* ---------- الدردشة ---------- */
  const timeStr = (ts) => new Date(ts).toLocaleTimeString('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit' });
  const dayStr = (ts) => new Date(ts).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
  const chatRooms = () => S.data.groups.filter((g) => g.chat);
  const roomsHtml = () => {
    const rooms = chatRooms();
    if (!rooms.length) return TB.empty('chat', S.data.user.role === 'sheikh' ? 'أنشئ مجموعة لتظهر غرفتها هنا.' : 'ستظهر غرفة مجموعتك هنا بعد أن يضيفك الشيخ إلى مجموعة.');
    return `<div class="card list">${rooms.map((g) => `<a class="item" href="#/chat/${g.id}"><span class="avatar" style="background:${esc(g.color)}">${TB.initial(g.name)}</span><div class="grow"><div class="bold">${esc(g.name)}</div><div class="small muted">${L.stage[g.stage]} · ${L.gender[g.gender]}${g.chatLocked ? ' · للقراءة فقط' : ''}</div></div>${S.data.unread[g.id] ? `<span class="badge">${S.data.unread[g.id]}</span>` : ''}</a>`).join('')}</div>`;
  };
  TB.refreshChatList = () => { const b = $('#rooms'); if (b) b.innerHTML = roomsHtml(); };
  const chatList = (role) => TB.defView(role, 'chat', 'غرف التواصل', () => `<div id="rooms">${roomsHtml()}</div>`);
  const msgHtml = (m, prev) => {
    const mine = m.userId === S.data.user.id, canDel = mine || S.data.user.role === 'sheikh';
    const sep = !prev || new Date(prev.ts).toDateString() !== new Date(m.ts).toDateString() ? `<div class="dsep">${dayStr(m.ts)}</div>` : '';
    return `${sep}<div class="m ${mine ? 'me' : ''} ${m.role === 'sheikh' ? 'sheikh' : ''}" data-mid="${m.id}" data-ts="${m.ts}">${mine ? '' : `<div class="n">${esc(m.name)}</div>`}<div class="tx">${esc(m.text)}</div><div class="tm">${timeStr(m.ts)}${canDel ? ` <button class="del" data-act="delMsg" data-id="${m.id}">حذف</button>` : ''}</div></div>`;
  };
  let lastMsg = null;
  TB.chatAppend = (m) => {
    const box = $('#msgs'); if (!box || S.chatOpen !== m.groupId || $(`[data-mid="${m.id}"]`, box)) return;
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    box.insertAdjacentHTML('beforeend', msgHtml(m, lastMsg)); lastMsg = m;
    if (near || m.userId === S.data.user.id) box.scrollTop = box.scrollHeight;
  };
  const chatRoom = (role) => TB.defView(role, 'chat', (gid) => (gid ? (TB.group(gid) || {}).name || 'غرفة' : 'غرف التواصل'), (gid) => {
    if (!gid) return `<div id="rooms">${roomsHtml()}</div>`;
    const g = TB.group(gid);
    if (!g || !g.chat) return TB.empty('lock', 'هذه الغرفة غير متاحة لك.');
    const canWrite = !g.chatLocked || role === 'sheikh';
    return `<div class="chat"><div class="chat-h"><a class="icon-btn" href="#/chat" aria-label="رجوع">${icon('chat', 'sm')}</a><span class="avatar" style="background:${esc(g.color)};width:38px;height:38px;font-size:16px">${TB.initial(g.name)}</span><div class="grow"><div class="bold">${esc(g.name)}</div><div class="tiny muted">${L.stage[g.stage]} · ${L.gender[g.gender]}${g.chatLocked ? ' · الكتابة للشيخ فقط' : ''}</div></div></div>
      <div class="msgs" id="msgs"><div class="empty">جارٍ التحميل…</div></div>
      ${canWrite ? `<form class="composer" data-form="send" data-gid="${gid}"><textarea name="text" rows="1" maxlength="1000" placeholder="اكتب رسالتك…" aria-label="رسالة"></textarea><button class="btn gold" type="submit" aria-label="إرسال">${icon('send', 'sm')}</button></form>` : `<div class="composer small muted">${icon('lock', 'sm')} الغرفة للقراءة فقط الآن.</div>`}</div>`;
  }, async (gid) => {
    if (!gid) return;
    const g = TB.group(gid); if (!g || !g.chat) return;
    S.chatOpen = gid; lastMsg = null;
    try {
      const msgs = await TB.api('GET', `/api/chat/${gid}/messages`);
      const box = $('#msgs'); if (!box || S.chatOpen !== gid) return;
      box.innerHTML = msgs.length ? msgs.map((m, i) => { const h = msgHtml(m, msgs[i - 1]); return h; }).join('') : '<div class="empty">ابدأ المحادثة بالسلام 🌿</div>';
      lastMsg = msgs[msgs.length - 1] || null; box.scrollTop = box.scrollHeight;
      S.data.unread[gid] = 0; TB.updateBadges(); TB.api('POST', `/api/chat/${gid}/read`, {}).catch(() => {});
    } catch (e) { TB.errToast(e); }
    const ta = $('.composer textarea');
    if (ta) {
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && innerWidth > 900) { e.preventDefault(); ta.form.requestSubmit(); } });
      ta.addEventListener('input', () => { ta.style.height = '44px'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
    }
  });
  TB.forms.send = async (f) => {
    const ta = f.elements.text, text = ta.value.trim(); if (!text) return;
    ta.value = ''; ta.style.height = '44px';
    try { const m = await TB.api('POST', `/api/chat/${f.dataset.gid}/messages`, { text }); TB.chatAppend(m); } catch (e) { ta.value = text; throw e; }
    ta.focus();
  };
  TB.actions.delMsg = async (el) => { if (!(await TB.confirm('حذف هذه الرسالة؟', 'حذف'))) return; await TB.api('DELETE', `/api/chat/messages/${el.dataset.id}`); const m = $(`[data-mid="${el.dataset.id}"]`); if (m) m.remove(); };
  for (const r of ['sheikh', 'parent', 'student']) { chatList(r); chatRoom(r); }

  /* ---------- الجدول للأسرة ---------- */
  for (const r of ['parent', 'student']) TB.defView(r, 'schedule', r === 'parent' ? 'مواعيد الأبناء' : 'جدولي', () => `${TB.scheduleHtml(false)}<div class="mt">${calBlock()}</div>`);

  /* ---------- حسابي ---------- */
  for (const r of ['parent', 'student']) TB.defView(r, 'me', 'حسابي', () => {
    const u = S.data.user;
    return `<div class="card"><div class="row"><span class="avatar">${TB.initial(u.name)}</span><div class="grow"><h3>${esc(u.name)}</h3><div class="small muted">${r === 'parent' ? 'ولي أمر · ' + esc(u.phone) : 'طالب'}</div></div></div></div>
      ${calBlock()}
      ${r === 'parent' ? `<div class="card"><h3>تغيير كلمة المرور</h3><form data-form="pw" class="mt"><div class="field"><label>الحالية</label><input type="password" name="old" autocomplete="current-password" required></div><div class="field"><label>الجديدة (8 أحرف، حروف وأرقام)</label><input type="password" name="password" minlength="8" autocomplete="new-password" required></div><div class="err"></div><button class="btn" type="submit">حفظ</button></form></div>` : ''}
      <div class="card"><h3>بيانات الدار</h3><p class="small muted">${esc(S.data.center.name)}${S.data.center.phone ? ' · ' + esc(S.data.center.phone) : ''}${S.data.center.address ? ' · ' + esc(S.data.center.address) : ''}</p>${S.data.center.whatsapp ? `<a class="btn soft sm" href="${TB.waLink(S.data.center.whatsapp)}" target="_blank" rel="noopener">${icon('wa', 'sm')} واتساب الدار</a>` : ''}</div>
      <button class="btn danger ghost block mt" data-act="logout">${icon('logout', 'sm')} تسجيل الخروج</button>`;
  });
  TB.forms.pw = async (f) => { await TB.api('POST', '/api/auth/password', { old: TB.val(f, 'old'), password: TB.val(f, 'password') }); f.reset(); TB.toast('تم تغيير كلمة المرور'); };
  TB.actions.delLog = async (el) => { if (!(await TB.confirm('حذف هذا التقييم؟', 'حذف'))) return; await TB.api('DELETE', `/api/logs/${encodeURIComponent(el.dataset.id)}`); TB.toast('تم الحذف'); const box = $('#logs'); if (box) TB.loadLogs(box.dataset.sid, box, true); TB.reload(false); };
})();
