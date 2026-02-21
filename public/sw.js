const CACHE_NAME = 'torn-calculator-icons-v1';
const ICON_PATH = '/item-icons/';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('torn-calculator-icons-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.pathname.startsWith(ICON_PATH)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const network = await fetch(request);
        if (network && network.ok) {
          cache.put(request, network.clone());
        }
        return network;
      } catch (_) {
        if (cached) return cached;
        throw _;
      }
    })(),
  );
});
