// Minimal PWA service worker — Phase 1 foundation only.
//
// Caches the app shell so the manifest's installability checks pass and a
// repeat visit has something to serve while offline. This is deliberately
// not a full offline-first strategy: Phase 9 ("UX / Visual Polish") is
// where real offline-friendly behavior for the worker/household flows is
// designed and tested.

const CACHE_NAME = "homelist-shell-v1";
const SHELL_URLS = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});
