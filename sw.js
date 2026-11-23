// Service Worker – läuft im Hintergrund des Browsers.
// 1) Offline: Beim ersten Besuch werden alle App-Dateien gespeichert. Danach startet die App
//    auch ohne Internet.
// 2) Benachrichtigungen anzeigen und beim Antippen die App öffnen.
//
// WICHTIG nach Änderungen an der App: VERSION unten um 1 erhöhen.
// Dann laden alle Geräte die neuen Dateien beim nächsten Öffnen.

const VERSION = 21;
const CACHE = `daily-quests-v${VERSION}`;

const FILES = [
  './',
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/app.js',
  'js/store.js',
  'js/dates.js',
  'js/ui.js',
  'js/icons.js',
  'js/cycle.js',
  'js/reminders.js',
  'js/ics.js',
  'js/backup.js',
  'js/trackers.js',
  'js/views/calendar-part.js',
  'js/views/tracker-form.js',
  'js/report.js',
  'js/layout.js',
  'js/views/calendar-view.js',
  'js/holidays.js',
  'js/data/ferien.js',
  'js/views/placeholder.js',
  'js/views/today.js',
  'js/views/week.js',
  'js/views/cycle-view.js',
  'js/views/reminders-view.js',
  'js/views/settings.js',
  'fonts/Fredoka.woff2',
  'fonts/Nunito.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('daily-quests-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Erst im Speicher nachsehen, sonst aus dem Netz laden (und für später merken).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Seitenaufrufe (auch mit #heute usw.) → immer die gespeicherte index.html
    if (req.mode === 'navigate') {
      const page = new URL(req.url).pathname.endsWith('tests.html') ? null : await cache.match('index.html');
      if (page) return page;
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      throw err;
    }
  })());
});

// Antippen einer Benachrichtigung → App in den Vordergrund holen oder öffnen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL('./#heute', self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if ('focus' in client) { await client.focus(); return; }
    }
    await self.clients.openWindow(target);
  })());
});
