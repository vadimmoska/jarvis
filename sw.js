/* JARVIS service worker — makes the PWA work with ZERO connection (planes, Bali dead zones).
   Strategy: NETWORK-FIRST with a short timeout, cache as the fallback.
   Online  → you always get the newest deck and code, no double-open dance.
   Offline → the cached copy answers instantly.
   Bump CACHE on every deploy. */
const CACHE = 'jarvis-v4-2026-08-14c';
const ASSETS = ['./', './index.html', './jarvis-data.js', './manifest.json', './icon-180.png', './icon-512.png'];
const NET_TIMEOUT = 3500;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const net = await Promise.race([
        fetch(e.request),
        new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), NET_TIMEOUT))
      ]);
      if (net && net.status === 200 && net.type === 'basic') {
        cache.put(e.request, net.clone()).catch(() => {});
      }
      return net;
    } catch (err) {
      const hit = await cache.match(e.request);
      if (hit) return hit;
      if (e.request.mode === 'navigate') {
        const idx = await cache.match('./index.html');
        if (idx) return idx;
      }
      throw err;
    }
  })());
});
