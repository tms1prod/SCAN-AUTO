const CACHE_NAME = 'auto-scan-shell-v2';
const SHELL_FILES = [
  './ind.html',
  './style.css',
  './script.js',
  './manifest.webmanifest',
  './auto-scan.svg',
  './icons/icon-192.webp',
  './icons/icon-512.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('auto-scan-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (!response.ok) return response;
      return caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).then(() => response);
    }).catch(async () => (await caches.match(request)) || caches.match('./ind.html')));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => {
    const update = fetch(request).then((response) => {
      if (!response.ok) return response;
      return caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).then(() => response);
    });
    return cached || update;
  }));
});