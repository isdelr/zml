/* eslint-disable no-restricted-globals */
// A careful, auth-safe PWA service worker for ZML

const VERSION = "v4";
const STATIC_CACHE = `zml-static-${VERSION}`;
const HTML_CACHE = `zml-html-${VERSION}`;
const OFFLINE_URL = "/offline.html";

// Static assets we always want available offline
const STATIC_ASSETS = [
  OFFLINE_URL,
  "/icons/web-app-manifest-192x192.png",
  "/icons/web-app-manifest-512x512.png",
  "/icons/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if ("navigationPreload" in self.registration) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {}
      }
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, HTML_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

const isHTMLNavigation = (request) =>
  request.mode === "navigate" ||
  (request.method === "GET" &&
    request.headers.get("accept") &&
    request.headers.get("accept").includes("text/html"));

const isAuthOrApi = (url) => {
  // Never cache auth or API endpoints (prevents stale auth states)
  if (url.origin.includes("convex.cloud")) return true;
  if (url.pathname.startsWith("/api/")) return true;
  return false;
};

const isStaticAsset = (url) =>
  url.pathname.startsWith("/icons/") ||
  url.pathname.endsWith(".png") ||
  url.pathname.endsWith(".jpg") ||
  url.pathname.endsWith(".jpeg") ||
  url.pathname.endsWith(".svg") ||
  url.pathname.endsWith(".ico") ||
  url.pathname.endsWith(".css") ||
  url.pathname.endsWith(".js") ||
  url.pathname.endsWith(".woff") ||
  url.pathname.endsWith(".woff2");

async function handleHTMLNavigation(event) {
  const cache = await caches.open(HTML_CACHE);

  try {
    const preload = await event.preloadResponse;
    if (preload) {
      cache.put(event.request, preload.clone());
      return preload;
    }

    const network = await fetch(event.request, { credentials: "include" });
    if (network && network.ok) {
      cache.put(event.request, network.clone());
    }
    return network;
  } catch {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return (
      offline ||
      new Response("Offline", { status: 503, statusText: "Offline" })
    );
  }
}

async function handleStaticAsset(event) {
  const cached = await caches.match(event.request);
  if (cached) return cached;
  try {
    const res = await fetch(event.request);
    if (res && res.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(event.request, res.clone());
    }
    return res;
  } catch {
    return cached || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") {
    return;
  }

  if (isAuthOrApi(url)) {
    return;
  }

  if (isHTMLNavigation(event.request)) {
    event.respondWith(handleHTMLNavigation(event));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(event));
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      try {
        const res = await fetch(event.request);
        if (res && res.ok) {
          cache.put(event.request, res.clone());
        }
        return res;
      } catch {
        const cached = await cache.match(event.request);
        return cached || Response.error();
      }
    })()
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || "/icons/web-app-manifest-192x192.png",
      badge: data.badge || "/icons/web-app-manifest-192x192.png",
      vibrate: [100, 50, 100],
      requireInteraction: true,
      tag: "zml-notification",
      data: {
        url: data.data?.url || "/",
      },
      actions: [
        { action: "open", title: "Open", icon: "/icons/web-app-manifest-192x192.png" },
        { action: "close", title: "Close" },
      ],
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[SW] Push parse error:", e);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "close") return;
  const urlToOpen = event.notification.data?.url || "/";
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientsArr = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      let client = clientsArr.find((c) => c.url === fullUrl);
      if (client) return client.focus();
      client = clientsArr.find(
        (c) => new URL(c.url).origin === self.location.origin
      );
      if (client) {
        await client.navigate(fullUrl);
        return client.focus();
      }
      return self.clients.openWindow(fullUrl);
    })()
  );
});
