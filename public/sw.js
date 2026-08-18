/* Asky offline-first service worker.
 * Strategy:
 * - App shell + static assets (JS/CSS/fonts/images): cache-first with versioned cache.
 * - Everything else (navigation, API calls): network-first, fall back to cached shell.
 */
const CACHE_NAME = "asky-shell-v1";
const SHELL_URLS = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  // Precache the app shell immediately, then activate.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only same-origin GET requests.
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);
  const isStatic = /\.(js|css|png|ico|webp|woff2?|json)$/.test(url.pathname) || url.pathname.startsWith("/assets/");
  const isNavigation = request.mode === "navigate";

  if (isStatic) {
    // Cache-first for static assets.
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            // Stash a copy in the cache in the background.
            const copy = res.clone();
            if (copy.ok) caches.open(CACHE_NAME).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  if (isNavigation || !isStatic) {
    // Network-first for navigation and API calls.
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Cache a copy of successful navigation/app-shell responses.
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request.url, copy));
          }
          return res;
        })
        .catch(() =>
          // Network failed: serve whatever shell/API response we have cached.
          caches.match(request.url).then((cached) => cached || caches.match("/")),
        ),
    );
  }
});
