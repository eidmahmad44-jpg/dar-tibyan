'use strict';
(async () => {
  const S = TB.S;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  try { S.info = await TB.api('GET', '/api/public/info'); } catch { S.info = { center: { name: 'دار تبيان لعلوم القرآن' }, setupNeeded: false }; }
  if (S.token) {
    await TB.reload(false);
    if (!S.data) {
      const c = TB.store.get('tb_cache');
      if (c && S.offline) { try { S.data = JSON.parse(c); } catch { /* ignore */ } }
      else if (!S.token) { /* logged out by 401 */ }
    }
    if (S.data) TB.connectStream();
  }
  if (!S.token) { if (!/^#\/(login|register|setup|admin)/.test(location.hash)) history.replaceState(null, '', S.info.setupNeeded ? '#/setup' : '#/login'); }
  TB.render();
})();
