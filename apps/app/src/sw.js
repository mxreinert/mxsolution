/* mxreinert Coaching – Service Worker
 * - Push notifications (reminders, feedback, appointments)
 * - Offline: app files network-first with cache fallback (so the workout logger opens in the gym basement).
 *   Supabase/API requests are never cached.
 */
const CACHE = 'mx-app-v1';
const CORE = [
  '/home.html', '/index.html', '/core/theme.css', '/core/app.css', '/core/theme.js',
  '/vendor/supabase-2.117.2.js', '/manifest.webmanifest', '/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('mx-app-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // Supabase etc.: never cached
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;
  if (url.pathname.startsWith('/modules/cardio/pacer/')) return; // pacer has its own worker

  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html') || url.pathname.endsWith('.svg') || url.pathname === '/')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('/home.html') : Response.error())))
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
