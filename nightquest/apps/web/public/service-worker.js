const VERSION = 'nightquest-v1';
const APP_SHELL_CACHE = `${VERSION}-shell`;
const TILE_CACHE = `${VERSION}-tiles`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const APP_SHELL_URLS = ['/', '/index.html', '/manifest.json'];
const TILE_HOST_PATTERN = /basemaps\.cartocdn\.com/;
const FONT_HOST_PATTERN = /fonts\.(googleapis|gstatic)\.com/;
const TILE_CACHE_LIMIT = 400;
const RUNTIME_CACHE_LIMIT = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(VERSION))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  if (requests.length <= maxEntries) return;
  const surplus = requests.length - maxEntries;
  for (let i = 0; i < surplus; i += 1) {
    await cache.delete(requests[i]);
  }
}

async function staleWhileRevalidate(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).then(() => trimCache(cacheName, limit));
      }
      return response;
    })
    .catch(() => null);
  return cached ?? (await networkPromise) ?? new Response('', { status: 504 });
}

async function networkFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone()).then(() => trimCache(cacheName, limit));
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await caches.match('/index.html');
      if (shell) return shell;
    }
    return new Response('', { status: 504 });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (TILE_HOST_PATTERN.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, TILE_CACHE, TILE_CACHE_LIMIT));
    return;
  }

  if (FONT_HOST_PATTERN.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE, RUNTIME_CACHE_LIMIT));
    return;
  }

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request, APP_SHELL_CACHE, RUNTIME_CACHE_LIMIT));
      return;
    }
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE, RUNTIME_CACHE_LIMIT));
  }
});
