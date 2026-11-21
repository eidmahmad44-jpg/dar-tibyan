'use strict';
/* دار تبيان — النواة: الحالة، الاتصال بالخادم، التوجيه، النوافذ، الأدوات */
window.TB = (() => {
  const TB = { views: { sheikh: {}, parent: {}, student: {} }, actions: {}, forms: {}, S: { token: null, data: null, chatOpen: null } };
  const S = TB.S;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };
  TB.store = store;
  S.token = store.get('tb_token');

  /* ---------- ثوابت ---------- */
  TB.L = {
    stage: { primary: 'ابتدائي', prep: 'إعدادي', secondary: 'ثانوي' },
    gender: { boys: 'بنين', girls: 'بنات' },
    days: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    dayOrder: [6, 0, 1, 2, 3, 4, 5],
    slot: { hifz: 'حفظ', review: 'مراجعة', tajweed: 'تلاوة وتجويد', educational: 'درس تربوي', kuttab: 'الكتّاب', other: 'حصة' },
    event: { exam: 'اختبار', kuttab: 'الكتّاب', educational: 'درس تربوي', trip: 'رحلة', meeting: 'اجتماع', other: 'موعد' },
    att: { present: 'حاضر', late: 'متأخر', absent: 'غائب', excused: 'بعذر' },
    pref: { any: 'أي وقت', morning: 'صباحاً', afternoon: 'عصراً', evening: 'مساءً' },
    memo: { new: 'حفظ جديد', review: 'مراجعة', exam: 'اختبار' },
  };
  const L = TB.L;

  /* ---------- أدوات ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  TB.$ = $; TB.$$ = $$;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  TB.esc = esc;
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14c2.7 0 4.5 1.8 4.5 4.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    chat: '<path d="M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1H10l-5 4v-4H4a1 1 0 01-1-1V6a1 1 0 011-1z"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', edit: '<path d="M4 20h4l11-11-4-4L4 16z"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', book: '<path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14"/>',
    star: '<path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.9 6.4 20l1.3-6.2L3 9.5l6.3-.7z"/>', bell: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 21h4"/>',
    logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>', download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>', wand: '<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    clip: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>', more: '<circle cx="5" cy="12" r="1.6" class="f"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    flag: '<path d="M5 21V4M5 5h13l-2 4 2 4H5"/>', send: '<path d="M21 4L10 14M21 4l-7 17-4-7-7-4z"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
    wa: '<path d="M4 20l1.3-4.2A8 8 0 1112 20a8 8 0 01-3.6-.9z"/><path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 .7c-1-.5-1.8-1.300-2.200-2.200l.7-1-1-2z"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>', alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.200v.1"/>',
  };
  TB.icon = (n, c = '') => `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const pad = (n) => String(n).padStart(2, '0');
  TB.fmtTime = (m) => { const h = Math.floor(m / 60) % 24, mm = m % 60; return `${h % 12 || 12}:${pad(mm)} ${h >= 12 ? 'م' : 'ص'}`; };
  TB.toInput = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  TB.fromInput = (v) => { const [h, m] = String(v || '').split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : NaN; };
  TB.fmtDur = (m) => (m < 60 ? `${m} د` : `${Math.floor(m / 60)} س${m % 60 ? ' و' + (m % 60) + ' د' : ''}`);
  TB.addDays = (ds, n) => { const [y, m, d] = ds.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  TB.weekday = (ds) => { const [y, m, d] = ds.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  TB.fmtDate = (ds, withYear) => new Date(ds + 'T12:00:00').toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) });
  TB.fmtShort = (ds) => new Date(ds + 'T12:00:00').toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' });
  TB.ts = (ds, min) => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d, Math.floor(min / 60), min % 60).getTime(); };
  TB.stars = (n) => { const r = Math.round(n || 0); return `<span class="stars" title="${n || 0}/5"><b>${'★'.repeat(r)}</b>${'★'.repeat(5 - r)}</span>`; };
  TB.initial = (name) => esc(String(name || '؟').trim().charAt(0));
  TB.surah = (n) => (window.SURAHS[n - 1] ? window.SURAHS[n - 1][0] : '—');
  TB.surahOpts = (sel) => window.SURAHS.map((s, i) => `<option value="${i + 1}"${+sel === i + 1 ? ' selected' : ''}>${i + 1}. ${s[0]}</option>`).join('');
  TB.stageByAge = (a) => (a <= 11 ? 'primary' : a <= 14 ? 'prep' : 'secondary');
  TB.ring = (pct, size = 84, label = 'من القرآن') => {
    const r = size / 2 - 7, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct || 0));
    return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#ecebd0" stroke-width="8"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#2c6a47" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(c * p) / 100} ${c}"/></svg><div class="v"><b>${p % 1 ? p.toFixed(1) : p}%</b><small>${label}</small></div></div>`;
  };
  TB.waLink = (phone) => {
    const c = (S.data && S.data.center && S.data.center.countryCode) || '20';
    let d = String(phone || '').replace(/\D/g, '');
    if (d.startsWith('0')) d = c + d.slice(1);
    return `https://wa.me/${d}`;
  };
  TB.empty = (icon, text) => `<div class="empty">${TB.icon(icon)}<div>${text}</div></div>`;
  TB.groupName = (id) => { const g = S.data.groups.find((x) => x.id === id); return g ? g.name : '—'; };
  TB.group = (id) => S.data.groups.find((x) => x.id === id);
  TB.student = (id) => S.data.students.find((x) => x.id === id);

  /* ---------- الاتصال ---------- */
  TB.api = async (method, url, body) => {
    let r;
    try {
      r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch { const e = new Error('لا يوجد اتصال بالخادم. تحقق من الإنترنت.'); e.offline = true; throw e; }
    let j = null; try { j = await r.json(); } catch { /* ignore */ }
    if (r.status === 401 && S.token) { TB.logout(true); }
    if (!r.ok) { const e = new Error((j && j.error) || 'حدث خطأ'); e.data = j; e.status = r.status; throw e; }
    return j;
  };
  TB.toast = (msg, bad) => {
    const el = document.createElement('div'); el.className = 'toast' + (bad ? ' bad' : ''); el.textContent = msg;
    $('#toast-root').appendChild(el); setTimeout(() => el.remove(), bad ? 4500 : 2600);
  };
  TB.errToast = (e) => TB.toast(e.message || 'حدث خطأ', true);

  /* ---------- النوافذ ---------- */
  TB.modal = (title, body, opts = {}) => {
    TB.closeModal(true);
    const ov = document.createElement('div'); ov.className = 'ov';
    ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-h"><h2>${esc(title)}</h2><button class="icon-btn" data-act="closeModal" aria-label="إغلاق">${TB.icon('x')}</button></div><div class="modal-b">${body}</div></div>`;
    ov.addEventListener('mousedown', (e) => { if (e.target === ov && !opts.sticky) TB.closeModal(); });
    $('#modal-root').appendChild(ov);
    const first = $('input:not([type=hidden]):not([type=checkbox]),select,textarea', ov); if (first && !opts.noFocus && innerWidth > 900) first.focus();
    return ov;
  };
  TB.closeModal = (quiet) => {
    $('#modal-root').innerHTML = '';
    if (!quiet && S.stale) { S.stale = false; TB.reload(); }
  };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modal-root .ov')) TB.closeModal(); });
  TB.confirm = (msg, okLabel = 'تأكيد', danger = true) => new Promise((res) => {
    const ov = TB.modal('تأكيد', `<p>${esc(msg)}</p><div class="modal-f"><button class="btn ${danger ? 'danger' : ''}" data-cf="1">${esc(okLabel)}</button><button class="btn ghost" data-cf="0">تراجع</button></div>`, { noFocus: true });
    ov.addEventListener('click', (e) => { const b = e.target.closest('[data-cf]'); if (b) { TB.closeModal(true); res(b.dataset.cf === '1'); } });
    $('[data-act=closeModal]', ov).addEventListener('click', () => res(false));
  });

  /* ---------- محرّر الفترات الزمنية ---------- */
  TB.ivRow = (iv = {}, withLabel = false) => `<div class="iv-row${withLabel ? ' lab' : ''}"><select data-k="day" aria-label="اليوم">${L.dayOrder.map((d) => `<option value="${d}"${iv.day === d ? ' selected' : ''}>${L.days[d]}</option>`).join('')}</select><input type="time" data-k="from" value="${TB.toInput(iv.from != null ? iv.from : 960)}" aria-label="من"><input type="time" data-k="to" value="${TB.toInput(iv.to != null ? iv.to : 1020)}" aria-label="إلى">${withLabel ? `<input type="text" class="lab-in" data-k="label" maxlength="40" placeholder="سبب (اختياري)" value="${esc(iv.label || '')}">` : ''}<button type="button" class="icon-btn" data-act="ivDel" aria-label="حذف">${TB.icon('trash', 'sm')}</button></div>`;
  TB.ivEditor = (name, list, withLabel = false) => `<div class="iv" data-name="${name}" data-label="${withLabel ? 1 : 0}"><div class="iv-list">${(list || []).map((x) => TB.ivRow(x, withLabel)).join('')}</div><button type="button" class="btn soft sm" data-act="ivAdd">${TB.icon('plus', 'sm')} إضافة فترة</button></div>`;
  TB.readIv = (root, name) => {
    const box = $(`.iv[data-name="${name}"]`, root); if (!box) return [];
    return $$('.iv-row', box).map((r) => {
      const o = { day: +$('[data-k=day]', r).value, from: TB.fromInput($('[data-k=from]', r).value), to: TB.fromInput($('[data-k=to]', r).value) };
      const l = $('[data-k=label]', r); if (l) o.label = l.value;
      return o;
    }).filter((x) => x.to > x.from);
  };
  TB.actions.ivAdd = (el) => { const box = el.closest('.iv'); const w = box.dataset.label === '1'; box.querySelector('.iv-list').insertAdjacentHTML('beforeend', TB.ivRow({ day: 6 }, w)); };
  TB.actions.ivDel = (el) => el.closest('.iv-row').remove();
  TB.actions.closeModal = () => TB.closeModal();

  /* ---------- التوجيه والقالب ---------- */
  TB.parseHash = () => { const h = location.hash.replace(/^#\/?/, ''); const [name, ...args] = h.split('/'); return { name: name || '', args: args.map(decodeURIComponent) }; };
  TB.go = (h) => { if (location.hash === '#' + h) TB.render(); else location.hash = h; };
  TB.defView = (role, name, title, render, mount) => { TB.views[role][name] = { title, render, mount }; };
  const NAV = {
    sheikh: [['home', 'الرئيسية', 'home', 1], ['students', 'الطلاب', 'users', 1], ['groups', 'المجموعات', 'book', 0], ['schedule', 'الجدول', 'calendar', 1], ['record', 'تسجيل الحصة', 'clip', 0], ['events', 'المواعيد والاختبارات', 'flag', 0], ['chat', 'غرف التواصل', 'chat', 1], ['settings', 'الإعدادات', 'settings', 0], ['more', 'المزيد', 'more', 'm']],
    parent: [['home', 'الرئيسية', 'home', 1], ['schedule', 'المواعيد', 'calendar', 1], ['chat', 'التواصل', 'chat', 1], ['me', 'حسابي', 'user', 1]],
    student: [['home', 'الرئيسية', 'home', 1], ['schedule', 'جدولي', 'calendar', 1], ['chat', 'التواصل', 'chat', 1], ['me', 'حسابي', 'user', 1]],
  };
  TB.activeTab = (role, name) => {
    const map = { student: 'students', child: 'home', group: 'groups' };
    let n = map[name] || name;
    if (role === 'sheikh' && !['home', 'students', 'schedule', 'chat'].includes(n) && window.innerWidth <= 900) n = 'more';
    return n;
  };
  const unreadTotal = () => Object.values(S.data.unread || {}).reduce((a, b) => a + b, 0);
  TB.updateBadges = () => {
    const n = unreadTotal();
    $$('[data-badge=chat]').forEach((b) => { b.textContent = n > 99 ? '99+' : n; b.classList.toggle('hidden', !n); });
  };
  function shell(role, name) {
    const u = S.data.user, nav = NAV[role], active = TB.activeTab(role, name);
    const link = (n, tab) => `<a href="#/${n[0]}" class="${tab ? '' : 'nl '}${n[0] === active ? 'on' : ''}">${TB.icon(n[2])}<span>${n[1]}</span>${n[0] === 'chat' ? `<span class="badge hidden" data-badge="chat"></span>` : ''}</a>`;
    return `<div class="app">
      <aside class="side"><a class="brand" href="#/home"><span class="logo-bg"><img src="/icons/mark.png" alt=""></span><b>${esc(S.data.center.name)}</b></a>
        ${nav.filter((n) => n[3] !== 'm').map((n) => link(n)).join('')}
        <div class="who"><div class="bold">${esc(u.name)}</div><div class="small" style="opacity:.75">${{ sheikh: 'الشيخ', parent: 'ولي أمر', student: 'طالب' }[role]}</div><button class="btn sm gold mt-s" data-act="logout">${TB.icon('logout', 'sm')} خروج</button></div></aside>
      <div class="main"><header class="topbar"><a class="brand-m" href="#/home"><img src="/icons/mark.png" alt=""></a><div class="t" id="page-title"></div><span id="offline" class="pill hidden">${TB.icon('alert', 'sm')} غير متصل</span><button class="btn sm soft hidden" id="install-btn" data-act="install">${TB.icon('download', 'sm')} ثبّت التطبيق</button></header>
        <main id="view" tabindex="-1"></main></div>
      <nav class="tabbar" aria-label="التنقل الرئيسي">${nav.filter((n) => n[3]).map((n) => link(n, true)).join('')}</nav></div>`;
  }
  let shellKey = '';
  TB.render = () => {
    if (!S.token || !S.data) return renderAuth();
    const role = S.data.user.role, r = TB.parseHash();
    const views = TB.views[role]; const name = views[r.name] ? r.name : 'home';
    if (!r.name || !views[r.name]) { if (r.name && !views[r.name]) history.replaceState(null, '', '#/home'); }
    const key = role + ':' + TB.activeTab(role, name) + ':' + innerWidth;
    const rootEl = $('#root');
    if (shellKey !== key || !$('#view')) { rootEl.innerHTML = shell(role, name); shellKey = key; }
    S.chatOpen = null;
    const v = views[name];
    $('#page-title').textContent = typeof v.title === 'function' ? v.title(...r.args) : v.title;
    const view = $('#view');
    const keepScroll = S.keepScroll; S.keepScroll = false;
    const y = window.scrollY;
    view.innerHTML = v.render(...r.args);
    $('#offline').classList.toggle('hidden', !S.offline);
    $('#install-btn').classList.toggle('hidden', !TB.installEvt);
    TB.updateBadges();
    if (v.mount) v.mount(...r.args);
    if (keepScroll) window.scrollTo(0, y); else if (S.lastRouteKey !== location.hash) window.scrollTo(0, 0);
    S.lastRouteKey = location.hash;
    TB.armReminders && TB.armReminders();
    if (S.data.user.mustChange && !$('#modal-root .ov')) TB.forcePw();
  };
  window.addEventListener('hashchange', () => { TB.closeModal(true); TB.render(); });
  window.addEventListener('resize', () => { clearTimeout(TB._rz); TB._rz = setTimeout(() => { if (S.data && $('#view') && !$('#modal-root .ov')) { shellKey = ''; TB.render(); } }, 250); });

  /* ---------- الأحداث العامة ---------- */
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const fn = TB.actions[el.dataset.act]; if (!fn) return;
    if (el.tagName === 'A') e.preventDefault();
    try { await fn(el, e); } catch (err) { TB.errToast(err); }
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    const fn = TB.forms[f.dataset.form]; if (!fn) return;
    const btn = $('button[type=submit]', f); const msg = $('.err', f);
    if (msg) msg.textContent = '';
    if (btn) btn.disabled = true;
    try { await fn(f); } catch (err) { if (msg) msg.textContent = err.message; else TB.errToast(err); }
    if (btn) btn.disabled = false;
  });
  TB.val = (f, n) => (f.elements[n] ? f.elements[n].value : '');
  TB.checked = (f, n) => $$(`input[name="${n}"]:checked`, f).map((x) => x.value);

  /* ---------- البيانات ---------- */
  TB.reload = async (render = true) => {
    if (!S.token) return;
    try {
      S.data = await TB.api('GET', '/api/bootstrap'); S.offline = false;
      store.set('tb_cache', JSON.stringify(S.data));
    } catch (e) { if (e.offline) S.offline = true; else if (e.status !== 401) TB.errToast(e); }
    if (render) { S.keepScroll = true; TB.render(); }
  };
  let rt = null;
  TB.scheduleReload = () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const a = document.activeElement;
      if ($('#modal-root .ov') || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || S.chatOpen) { S.stale = !S.chatOpen; if (S.chatOpen) TB.reload(false).then(() => TB.updateBadges()); return; }
      TB.reload();
    }, 400);
  };
  TB.connectStream = async () => {
    if (S.es) { S.es.close(); S.es = null; }
    if (!S.token || !window.EventSource) return;
    let ticket; try { ticket = (await TB.api('POST', '/api/stream-ticket', {})).ticket; } catch { return setTimeout(TB.connectStream, 8000); }
    const es = (S.es = new EventSource('/api/stream?ticket=' + ticket));
    es.addEventListener('refresh', (ev) => { let j = 0; try { j = JSON.parse(ev.data).j; } catch { /* */ } if (j) setTimeout(TB.scheduleReload, Math.random() * 4000); else TB.scheduleReload(); });
    es.addEventListener('delete', (ev) => { try { const { id } = JSON.parse(ev.data); const el = document.querySelector(`[data-mid="${id}"]`); if (el) el.remove(); } catch { /* ignore */ } });
    es.addEventListener('message', (ev) => { try { TB.onChatMessage(JSON.parse(ev.data)); } catch { /* ignore */ } });
    es.addEventListener('hello', () => { S.offline = false; const o = $('#offline'); if (o) o.classList.add('hidden'); });
    es.onerror = () => { es.close(); if (S.es === es && S.token) setTimeout(TB.connectStream, 3000 + Math.random() * 4000); };
  };
  TB.onChatMessage = (m) => {
    if (m.userId === S.data.user.id) { if (TB.chatAppend) TB.chatAppend(m); return; }
    if (S.chatOpen === m.groupId && TB.chatAppend) { TB.chatAppend(m); TB.api('POST', `/api/chat/${m.groupId}/read`, {}).catch(() => {}); return; }
    S.data.unread[m.groupId] = (S.data.unread[m.groupId] || 0) + 1; TB.updateBadges();
    if (TB.refreshChatList) TB.refreshChatList();
    TB.toast(`${m.name}: ${m.text.slice(0, 50)}`);
  };
  TB.setSession = async (token) => {
    S.token = token; store.set('tb_token', token);
    await TB.reload(false);
    TB.connectStream();
    if (!location.hash || /^#\/(login|register|setup|admin)/.test(location.hash)) history.replaceState(null, '', '#/home');
    shellKey = ''; TB.render();
  };
  TB.logout = (silent) => {
    if (!silent && S.token) TB.api('POST', '/api/auth/logout', {}).catch(() => {});
    if (S.es) S.es.close();
    S.token = null; S.data = null; store.del('tb_token'); store.del('tb_cache'); shellKey = '';
    history.replaceState(null, '', '#/login'); TB.render();
  };
  TB.actions.logout = () => TB.logout();
  TB.actions.install = async () => { const p = TB.installEvt; if (!p) return; p.prompt(); await p.userChoice; TB.installEvt = null; const b = $('#install-btn'); if (b) b.classList.add('hidden'); };
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); TB.installEvt = e; const b = $('#install-btn'); if (b) b.classList.remove('hidden'); });
  window.addEventListener('online', () => TB.reload());
  window.addEventListener('offline', () => { S.offline = true; const o = $('#offline'); if (o) o.classList.remove('hidden'); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.token) TB.scheduleReload(); });

  /* ---------- شاشات الدخول والتسجيل ---------- */
  const ROS = '<svg class="orn" viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><circle cx="100" cy="100" r="96"/><circle cx="100" cy="100" r="70"/><rect x="44" y="44" width="112" height="112"/><rect x="44" y="44" width="112" height="112" transform="rotate(45 100 100)"/><circle cx="100" cy="100" r="30"/><path d="M100 4v192M4 100h192M32 32l136 136M168 32L32 168"/></svg>';
  function authShell(inner, foot) {
    return `<div class="auth"><div class="orn-wrap o1">${ROS}</div><div class="orn-wrap o2">${ROS}</div><div class="orn-wrap o3">${ROS}</div><div class="auth-band" aria-hidden="true"></div>
      <div class="auth-box"><div class="auth-head"><div class="arch"><img src="/icons/mark.png" alt=""></div><h1>${esc((S.info && S.info.center.name) || 'دار تبيان لعلوم القرآن')}</h1><p class="verse">﴿وَنَزَّلْنَا عَلَيْكَ الْكِتَابَ تِبْيَانًا لِّكُلِّ شَيْءٍ﴾</p></div>
      <div class="auth-card">${inner}</div><div class="auth-foot">${foot || ''}<a href="/">الصفحة الرئيسية</a></div></div></div>`;
  }
  const inp = (icon, html) => `<div class="inp">${TB.icon(icon)}${html}</div>`;
  const pwInput = (name, auto, ph) => `<div class="inp">${TB.icon('lock')}<input name="${name}" type="password" autocomplete="${auto}" placeholder="${ph}" required><button type="button" class="eye" data-act="togglePw" aria-label="إظهار كلمة المرور">${TB.icon('eye', 'sm')}</button></div>`;
  TB.actions.togglePw = (el) => { const i = el.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; };
  const COMMON = ['12345678', '123456789', '1234567890', 'password', 'qwertyui', '11111111', '00000000', 'abc12345', 'iloveyou', 'admin123', '987654321', '1q2w3e4r'];
  TB.pwScore = (pw) => {
    if (!pw) return { n: 0, t: '' };
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
    let n = Math.min(4, Math.floor(pw.length / 4)) + classes - 1;
    if (COMMON.includes(pw.toLowerCase()) || new Set(pw).size <= 2 || pw.length < 8) n = Math.min(n, 1);
    n = Math.max(1, Math.min(5, n));
    return { n, t: ['', 'ضعيفة', 'ضعيفة', 'متوسطة', 'قوية', 'ممتازة'][n] };
  };
  function wireMeter(root) {
    const i = $('input[data-meter]', root); if (!i) return;
    const bar = $('.meter i', root), t = $('.meter-t', root);
    i.addEventListener('input', () => { const r = TB.pwScore(i.value); bar.style.width = r.n * 20 + '%'; bar.className = 'm' + r.n; t.textContent = r.t; });
  }
  const METER = '<div class="meter"><i></i></div><div class="hint"><span class="meter-t"></span> · 8 أحرف على الأقل، اخلط حروفاً وأرقاماً ولا تستخدم رقم هاتفك.</div>';
  function renderAuth() {
    const r = TB.parseHash(); let name = r.name;
    const root = $('#root'); shellKey = '';
    if (S.info && S.info.setupNeeded && name !== 'setup') name = 'setup';
    if (!['login', 'register', 'setup', 'admin'].includes(name)) name = 'login';
    if (name === 'setup') {
      root.innerHTML = authShell(`<h2 class="c">إعداد الدار لأول مرة</h2><p class="muted small c">أنشئ حساب الشيخ. رمز الإعداد يظهر في نافذة تشغيل الخادم وفي الملف <b dir="ltr">data/SETUP_CODE.txt</b></p>
      <form data-form="setup" class="mt"><div class="field"><label>رمز الإعداد</label>${inp('lock', '<input type="text" name="setupCode" inputmode="numeric" autocomplete="off" required>')}</div>
      <div class="field"><label>اسم الشيخ</label>${inp('user', '<input type="text" name="name" required maxlength="60">')}</div>
      <div class="field"><label>اسم المستخدم (إنجليزي)</label>${inp('user', '<input type="text" name="username" dir="ltr" autocomplete="username" autocapitalize="none" spellcheck="false" required pattern="[a-z0-9_.\\-]{3,30}" placeholder="abdullah.ashraf" data-slug>')}<span class="hint">أحرف إنجليزية صغيرة وأرقام فقط، بلا مسافات.</span></div>
      <div class="field"><label>كلمة المرور (10 أحرف على الأقل)</label>${pwInput('password', 'new-password', 'كلمة مرور قوية').replace('required>', 'required minlength="10" data-meter>')}${METER}</div>
      <div class="err"></div><button class="btn gold block lg" type="submit">إنشاء الحساب والبدء</button></form>`);
      wireMeter(root); return;
    }
    if (name === 'register') {
      root.innerHTML = authShell(`<h2 class="c">تسجيل طالب جديد</h2><p class="muted small c">سجّل بصفتك ولي الأمر. بعد المراجعة يضع الشيخ ابنك في المجموعة المناسبة.</p>
      <form data-form="register" class="mt">
        <div class="field"><label>رقم هاتفك (الأب أو الأم)</label>${inp('phone', '<input type="tel" name="phone" inputmode="tel" dir="ltr" autocomplete="tel" required placeholder="01xxxxxxxxx">')}<span class="hint">رقمك يراه الشيخ فقط، ولا يظهر لأي مستخدم آخر.</span></div>
        <div class="field"><label>اسمك كما تحب أن يظهر</label>${inp('user', '<input type="text" name="parentName" maxlength="60" autocomplete="name" required placeholder="مثال: أبو يوسف">')}<span class="hint">يظهر للشيخ فوق رقم هاتفك، وفي غرفة تواصل المجموعة.</span></div>
        <div class="field"><label>كلمة المرور</label>${pwInput('password', 'new-password', 'اختر كلمة مرور قوية').replace('required>', 'required minlength="8" data-meter>')}${METER}</div>
        <div class="sep"><span>بيانات الطالب</span></div>
        <div class="field"><label>اسم الطالب</label>${inp('user', '<input type="text" name="childName" maxlength="60" required>')}</div>
        <div class="two keep"><div class="field"><label>السن</label><input type="number" name="age" min="4" max="70" inputmode="numeric" required data-age></div>
        <div class="field"><label>النوع</label><select name="gender"><option value="boys">ذكر (بنين)</option><option value="girls">أنثى (بنات)</option></select></div></div>
        <div class="two"><div class="field"><label>المرحلة</label><select name="stage"><option value="primary">ابتدائي</option><option value="prep">إعدادي</option><option value="secondary">ثانوي</option></select></div>
        <div class="field"><label>السورة التي يحفظها الآن</label><select name="surah">${TB.surahOpts(78)}</select></div></div>
        <div class="err"></div><button class="btn gold block lg" type="submit">إرسال طلب التسجيل</button></form>`, '<a href="#/login">لديّ حساب</a>');
      const age = $('[data-age]'); age.addEventListener('input', () => { const a = +age.value; if (a) $('select[name=stage]', root).value = TB.stageByAge(a); });
      wireMeter(root); return;
    }
    if (name === 'admin') {
      root.innerHTML = authShell(`<h2 class="c">دخول الإدارة</h2><form data-form="admin" class="mt"><div class="field"><label>اسم المستخدم</label>${inp('user', '<input type="text" name="username" dir="ltr" autocomplete="username" autocapitalize="none" spellcheck="false" required data-slug>')}</div><div class="field"><label>كلمة المرور</label>${pwInput('password', 'current-password', 'كلمة المرور')}</div><div class="err"></div><button class="btn block lg" type="submit">دخول</button></form>`, '<a href="#/login">‹ رجوع</a>');
      return;
    }
    root.innerHTML = authShell(`<div class="tabs" role="tablist"><button type="button" class="on" data-tab="p">ولي أمر</button><button type="button" data-tab="s">طالب</button></div>
      <form data-form="login" id="f-p"><div class="field"><label>رقم الهاتف</label>${inp('phone', '<input type="tel" name="phone" inputmode="tel" dir="ltr" autocomplete="tel" required placeholder="01xxxxxxxxx">')}</div><div class="field"><label>كلمة المرور</label>${pwInput('password', 'current-password', 'كلمة المرور')}</div><div class="err"></div><button class="btn block lg" type="submit">دخول</button></form>
      <form data-form="loginCode" id="f-s" class="hidden"><div class="field"><label>رمز الطالب (8 خانات)</label>${inp('lock', '<input type="text" name="code" dir="ltr" autocomplete="off" required maxlength="12" style="letter-spacing:3px;text-transform:uppercase;font-weight:700" placeholder="XXXX-XXXX">')}<span class="hint">يجده ولي الأمر في صفحة ابنه، أو يعطيه لك الشيخ.</span></div><div class="err"></div><button class="btn block lg" type="submit">دخول</button></form>
      <div class="sep"><span>أو</span></div><a class="btn gold block" href="#/register">تسجيل طالب جديد</a>`, '<a href="#/admin" class="faint">دخول الإدارة</a>');
    $$('.tabs button', root).forEach((b) => b.addEventListener('click', () => {
      $$('.tabs button', root).forEach((x) => x.classList.toggle('on', x === b));
      $('#f-p').classList.toggle('hidden', b.dataset.tab !== 'p'); $('#f-s').classList.toggle('hidden', b.dataset.tab !== 's');
    }));
  }
  document.addEventListener('input', (e) => { const t = e.target; if (t.matches && t.matches('[data-slug]')) { const v = t.value.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9_.-]/g, ''); if (v !== t.value) t.value = v; } });
  TB.forms.setup = async (f) => { const r = await TB.api('POST', '/api/auth/setup', { setupCode: TB.val(f, 'setupCode'), name: TB.val(f, 'name'), username: TB.val(f, 'username'), password: TB.val(f, 'password') }); S.info.setupNeeded = false; await TB.setSession(r.token); };
  TB.forms.login = async (f) => { const r = await TB.api('POST', '/api/auth/login', { phone: TB.val(f, 'phone'), password: TB.val(f, 'password') }); await TB.setSession(r.token); };
  TB.forms.admin = async (f) => { const r = await TB.api('POST', '/api/auth/admin-login', { username: TB.val(f, 'username'), password: TB.val(f, 'password') }); await TB.setSession(r.token); };
  TB.forms.loginCode = async (f) => { const r = await TB.api('POST', '/api/auth/code-login', { code: TB.val(f, 'code') }); await TB.setSession(r.token); };
  TB.forms.register = async (f) => {
    const r = await TB.api('POST', '/api/auth/register', { phone: TB.val(f, 'phone'), parentName: TB.val(f, 'parentName'), password: TB.val(f, 'password'), child: { name: TB.val(f, 'childName'), age: TB.val(f, 'age'), gender: TB.val(f, 'gender'), stage: TB.val(f, 'stage'), surah: TB.val(f, 'surah') } });
    await TB.setSession(r.token); TB.toast('تم إرسال الطلب. سيراجعه الشيخ قريباً.');
  };
  /* تغيير كلمة المرور المؤقتة إجبارياً */
  TB.forcePw = () => TB.modal('غيّر كلمة المرور', `<p class="small muted">كلمة مرورك الحالية مؤقتة. اختر كلمة مرور خاصة بك لمتابعة الاستخدام.</p><form data-form="pwForce"><div class="field"><label>الكلمة المؤقتة</label>${pwInput('old', 'current-password', '')}</div><div class="field"><label>كلمة المرور الجديدة</label>${pwInput('password', 'new-password', '').replace('required>', 'required minlength="8" data-meter>')}${METER}</div><div class="err"></div><button class="btn block" type="submit">حفظ ومتابعة</button></form>`, { sticky: true, noFocus: true });
  TB.forms.pwForce = async (f) => { await TB.api('POST', '/api/auth/password', { old: TB.val(f, 'old'), password: TB.val(f, 'password') }); TB.closeModal(true); TB.toast('تم تغيير كلمة المرور'); await TB.reload(); };
  document.addEventListener('focusin', (e) => { const m = e.target.closest && e.target.closest('#modal-root'); if (m && !m.dataset.meter) { const f = m.querySelector('input[data-meter]'); if (f) { m.dataset.meter = 1; wireMeter(m); } } });
  return TB;
})();
