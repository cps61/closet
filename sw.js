// Makes the app open offline once it has been loaded.
// App files: network first (so updates show up right away), cache as fallback.
// Library code from esm.sh: cache first (versioned URLs never change).
// The background-removal model caches itself.

const SHELL_CACHE = 'closet-shell-v4';
const LIBRARY_CACHE = 'closet-lib-v1';
const LIBRARY_HOSTS = ['esm.sh', 'cdn.jsdelivr.net'];

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/add-item.js',
  './js/background-removal.js',
  './js/categories.js',
  './js/closet.js',
  './js/clothing-ai.js',
  './js/db.js',
  './js/images.js',
  './js/labels.js',
  './js/pieces.js',
  './js/prefs.js',
  './js/settings.js',
  './js/ui.js',
  './models/label-embeddings.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, LIBRARY_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (LIBRARY_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    // Always revalidate app files with the server so an update never mixes
    // old and new files. Navigations keep their original request.
    const response = request.mode === 'navigate' ? await fetch(request) : await fetch(request.url, { cache: 'no-cache' });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) ?? (await cache.match('./index.html'));
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(LIBRARY_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
