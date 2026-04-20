const CACHE_NAME = 'calc-emp-v1';
const ASSETS = [
  '/recipeness/',
  '/recipeness/index.html',
  '/recipeness/css/app.css',
  '/recipeness/js/app.js',
  '/recipeness/js/db.js',
  '/recipeness/js/backup.js',
  '/recipeness/manifest.json',
  '/recipeness/icons/icon-192.svg',
  '/recipeness/icons/icon-512.svg',
  'https://unpkg.com/dexie@3.2.4/dist/dexie.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
