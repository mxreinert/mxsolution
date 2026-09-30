/* mxreinert Coaching – Service Worker
 * - App files: served instantly from cache, refreshed in the background (stale-while-revalidate).
 *   A new deploy changes CACHE (apps/app/tools/update_assets.py) -> old cache is dropped.
 * - HTML pages: network first (fresh version), cache as offline fallback.
 * - Supabase/API requests are never cached.
 * - Push notifications.
 */
const CACHE = 'mx-app-eb34fe3106';
const PRECACHE = [
  '/client/analysis.js',
  '/client/checkin.js',
  '/client/log.js',
  '/client/onboarding.js',
  '/client/profile.js',
  '/client/screens.js',
  '/client/today.js',
  '/client/training.js',
  '/coach.html',
  '/coach/account.js',
  '/coach/anamnesis.js',
  '/coach/checkins.js',
  '/coach/client.js',
  '/coach/clients.js',
  '/coach/concept.js',
  '/coach/data.js',
  '/coach/exercises.js',
  '/coach/home.js',
  '/coach/modform.js',
  '/coach/modules-page.js',
  '/coach/modules-tab.js',
  '/coach/screens.js',
  '/coach/settings.js',
  '/core/ampel.js',
  '/core/app.css',
  '/core/app.js',
  '/core/auth.js',
  '/core/chart.js',
  '/core/config.js',
  '/core/dates.js',
  '/core/db.js',
  '/core/goals.js',
  '/core/icons.js',
  '/core/metric.js',
  '/core/metrics.js',
  '/core/modcfg.js',
  '/core/modules.js',
  '/core/pages/coach-login.js',
  '/core/pages/login.js',
  '/core/pages/mfa.js',
  '/core/pages/notfound.js',
  '/core/pages/password.js',
  '/core/push.js',
  '/core/rings.js',
  '/core/router.js',
  '/core/settings.js',
  '/core/shell.js',
  '/core/theme.css',
  '/core/theme.js',
  '/core/ui.js',
  '/home.html',
  '/icon.svg',
  '/index.html',
  '/manifest.webmanifest',
  '/mfa.html',
  '/modules/achievements/index.js',
  '/modules/achievements/lion.js',
  '/modules/activity/index.js',
  '/modules/ai/index.js',
  '/modules/billing/index.js',
  '/modules/cardio/index.js',
  '/modules/cycle/index.js',
  '/modules/hevy/index.js',
  '/modules/mood/index.js',
  '/modules/nutrition/calc.js',
  '/modules/nutrition/index.js',
  '/modules/parent-report/index.js',
  '/modules/progress/index.js',
  '/modules/pt/index.js',
  '/modules/sleep/index.js',
  '/modules/strength/data.js',
  '/modules/strength/index.js',
  '/modules/strength/logger.js',
  '/modules/strength/picker.js',
  '/modules/strength/plans.js',
  '/modules/supplements/index.js',
  '/modules/watch/index.js',
  '/modules/weight/index.js',
  '/password.html',
  '/vendor/supabase-2.117.2.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('mx-app-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

const isAsset = (p) => /\.(js|css|svg|webmanifest|png|woff2?)$/.test(p);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;              // Supabase etc.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;
  if (url.pathname.startsWith('/modules/cardio/pacer/')) return; // pacer has its own worker

  if (isAsset(url.pathname)) {
    // stale-while-revalidate
    event.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      if (hit) { event.waitUntil(net); return hit; }
      return (await net) || Response.error();
    }));
    return;
  }

  // pages: network first, cached copy offline
  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('/home.html')))
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'mxreinert', body: 'Es gibt etwas Neues.', url: '/home.html#/heute' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (e) { /* ignore */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: '/icon.svg', badge: '/icon.svg', data: { url: data.url }, tag: data.tag || undefined
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/home.html#/heute';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if ('focus' in c) { c.navigate?.(target); return c.focus(); }
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
  }));
});
