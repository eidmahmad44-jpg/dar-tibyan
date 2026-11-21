'use strict';
(function () {
  // بيانات التواصل من إعدادات الشيخ (إن وُجدت)
  fetch('/api/public/info').then((r) => r.json()).then((d) => {
    const c = d.center || {};
    if (c.about) document.getElementById('about').textContent = c.about;
    const box = document.getElementById('contact');
    const add = (t) => { const p = document.createElement('p'); p.style.margin = '4px 0'; p.textContent = t; box.appendChild(p); };
    if (c.phone) add('هاتف: ' + c.phone);
    if (c.address) add('العنوان: ' + c.address);
    const wa = document.getElementById('wa');
    if (c.whatsapp && wa.getAttribute('href') !== '#join') wa.hidden = false;
  }).catch(() => {});
  // زر تثبيت التطبيق
  let deferred = null;
  const btn = document.getElementById('install');
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; btn.hidden = false; });
  btn.addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; btn.hidden = true; });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
