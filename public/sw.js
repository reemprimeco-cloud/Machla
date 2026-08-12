// HomeList service worker — Phase 9 (offline-friendly behaviour).
//
// Replaces the Phase 1 placeholder, which cached "/" and fell back to the
// cache on any failure. That was enough to make the app installable and
// nothing more.
//
// The strategy here is shaped by who uses this: a worker on a cheap
// Android phone, on supermarket wifi or a weak mobile signal, mid-shop.
// What matters is that the app OPENS and says something truthful, not
// that it works fully offline — the list lives in Postgres, and pretending
// a queued write succeeded would be worse than saying "no connection".
//
//   navigations   → network first, fall back to cache, then to /offline
//   static assets → cache first (fonts, icons, flags, build output)
//   everything else (Supabase, Server Actions, POSTs) → network only
//
// That last line is the important one. Authenticated API responses are
// never cached: they are per-user, they go stale the moment anyone else
// touches the list, and a cached one could show household A's data to a
// household B session on a shared device.

const VERSION = "v2";
const SHELL_CACHE = `homelist-shell-${VERSION}`;
const ASSET_CACHE = `homelist-assets-${VERSION}`;
const OFFLINE_URL = "/offline";

// Only what is safe to precache: the offline page and the icons. Not "/",
// which redirects based on session and locale and would poison the cache
// with one user's landing place.
const PRECACHE = [OFFLINE_URL, "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one 404 does not abort the whole install and
      // leave the worker permanently un-activated.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Build output and static assets: content-hashed or rarely changing, so
 * serving a cached copy immediately is both safe and the whole point. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/flags/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/apple-icon.png"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never touch anything that changes server state.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin (Supabase above all) is left entirely alone: its
  // responses are authenticated and per-user.
  if (url.origin !== self.location.origin) return;

  // Server Actions and route handlers — same reasoning.
  if (url.pathname.startsWith("/api/")) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationWithOfflineFallback(request));
  }

  // Everything else (RSC payloads, data requests) falls through to the
  // network untouched. Caching them would risk showing one household's
  // data inside another's session.
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(ASSET_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // A missing asset offline is survivable — the page still renders,
    // just without that font or flag.
    return Response.error();
  }
}

async function navigationWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    // Deliberately NOT cached: an authenticated page cached here would be
    // served to whoever opens the app next on a shared phone.
    return response;
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;

    // Last resort, if even the precache failed. Kept minimal and
    // untranslated on purpose — reaching this means the app has never
    // successfully loaded, so there is no locale preference to honour.
    return new Response(
      "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>" +
        "<title>Offline</title><p style='font:16px system-ui;padding:2rem;text-align:center'>📡</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

// ============================================================
// Push notifications
// ============================================================
//
// The payload is built server-side (lib/push/send.ts) already translated
// into the recipient's own preferred_language — this file never has a
// locale to work with, since it runs with no page open at all. Every
// field it reads is assumed present; a malformed payload just shows a
// generic system notification rather than throwing, since a push that
// silently disappears is worse than a vague one.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Not JSON — fall through to the defaults below.
  }

  const title = payload.title || "Machla";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // Two notifications of the same type replace each other rather than
    // stacking — "list sent" twice before either is read should read as
    // one updated alert, not two.
    tag: payload.tag || "machla-notification",
    data: { url: payload.url || "/notifications" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  if (!url) return;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Focus an already-open tab rather than opening a second one, the
      // way every native app's notification tap behaves.
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) return client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
