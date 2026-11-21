'use strict';
const VER = 'tibyan-v1';
const SHELL = ['/app', '/app.css', '/core.js', '/shared.js', '/sheikh.js', '/family.js', '/boot.js', '/quran-data.js', '/icons/mark.png', '/icons/icon-192.png', '/manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VER).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VER).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.pathname.startsWith('/api/')) return;
  if (u.origin !== location.origin) {
    // الخطوط: خزّنها عند أول استخدام
    if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) e.respondWith(caches.open(VER).then((c) => c.match(r).then((m) => m || fetch(r).then((n) => { c.put(r, n.clone()); return n; }))));
    return;
  }
  // الشبكة أولاً ثم الكاش (تحديث فوري عند الاتصال، وتعمل دون إنترنت)
  e.respondWith(fetch(r).then((n) => { if (n.ok) { const cp = n.clone(); caches.open(VER).then((c) => c.put(r, cp)); } return n; }).catch(() => caches.match(r).then((m) => m || caches.match('/app'))));
});
