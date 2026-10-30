// Makes the app open offline once it has been loaded.
//
// App files (including the page itself): always revalidated with the server,
// bypassing the browser's HTTP cache, so an update can never mix an old page
// with new scripts. The offline copy is only used when the network fails.
// Library code from esm.sh / jsDelivr: cache first (versioned URLs never change).
// The AI models cache themselves.

const APP_VERSION = '5'; // keep in sync with index.html and js/app.js
const SHELL_CACHE = `closet-shell-v${APP_VERSION}`;
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
  './js/polyfills.js',
  './js/prefs.js',
  './js/settings.js',
  './js/ui.js',
  './models/label-embeddings.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(SHELL_FILES.map((file) => fetch(file, { cache: 'no-cache' }).then((r) => r.ok && cache.put(file, r)))),
    ),
  );
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

async function fetchFresh(request) {
  // A navigation Request can't be re-issued with options, so fetch its URL.
  // `no-cache` = always ask the server whether the file changed.
  const response = await fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' });
  // Safari refuses redirected responses for navigations; let the browser redo it.
  if (response.redirected && request.mode === 'navigate') return fetch(request);
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetchFresh(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const offline =
      (await cache.match(request, { ignoreSearch: true })) ??
      (request.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    return offline ?? Response.error();
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
