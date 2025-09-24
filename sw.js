// Offline cache for static assets
const CACHE_NAME = 'rpg-quotidien-cache-v1';
const ASSETS = ['./','./index.html','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE_NAME && caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).catch(()=>cached))
  );
});
