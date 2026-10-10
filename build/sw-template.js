// Streakwise service worker (PWA-2, PWA-3). build/service-worker.ts fills in the two placeholders
// below on every production build, so each deploy gets a new worker and a fresh cache.
//
// It caches the app shell only: the HTML page and the built files (scripts, styles, fonts, icons).
// Requests to /api, /mcp, /auth, and /.well-known are never touched, so data is always live and
// never stored on the device.

const VERSION = '__SW_VERSION__';
const PRECACHE_URLS = __PRECACHE_URLS__;
const CACHE = `streakwise-shell-${VERSION}`;
const SHELL_URL = '/index.html';
const NEVER_CACHED = ['/api/', '/mcp/', '/auth/', '/.well-known/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('streakwise-shell-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHED.some((prefix) => url.pathname.startsWith(prefix))) return;

  // Pages: always try the network first, so a new release shows at once; offline, use the shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(SHELL_URL).then((cached) => cached || Response.error()),
      ),
    );
    return;
  }

  // Built files have content hashes in their names, so a cached copy is always right.
  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then((cached) => cached || fetch(request)));
  }
});
