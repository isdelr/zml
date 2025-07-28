// public/sw.js
const CACHE_NAME = "zml-cache-v1";
const OFFLINE_URL = "/offline.html"; // We will need to create this page

self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: data.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
      },
    }
    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})

self.addEventListener('notificationclick', function (event) {
  console.log('Notification click received.')
  event.notification.close()
  // IMPORTANT: Update this URL to your production website URL
  event.waitUntil(clients.openWindow('https://zml.app'))
})

const STATIC_ASSETS = [
  OFFLINE_URL,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching offline page and static assets.");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Enable navigation preloading if it's supported.
      if ("navigationPreload" in self.registration) {
        await self.registration.navigationPreload.enable();
      }
      // Clean up old caches.
      const cacheNames = await caches.keys();
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })()
  );
  self.clients.claim();
});

// Stale-while-revalidate for Convex API calls
const handleApiRequest = async (event) => {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(event.request);

  const networkResponsePromise = fetch(event.request).then((networkResponse) => {
    // If the fetch is successful, clone it, cache it, and return it.
    if (networkResponse.ok) {
      cache.put(event.request, networkResponse.clone());
    }
    return networkResponse;
  });

  // Return the cached response immediately if available, otherwise wait for the network.
  return cachedResponse || networkResponsePromise;
};

// Cache-first for static assets
const handleStaticAssetRequest = async (event) => {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(event.request);
  if (cachedResponse) {
    return cachedResponse;
  }
  return fetch(event.request);
};


self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Handle Convex API calls with stale-while-revalidate
  if (url.origin.includes("convex.cloud")) {
    event.respondWith(handleApiRequest(event));
    return;
  }
  
  // Handle static assets with cache-first
  if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset))) {
    event.respondWith(handleStaticAssetRequest(event));
    return;
  }

  // Handle navigation requests
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            return preloadResponse;
          }

          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          console.log("[Service Worker] Fetch failed; returning offline page.", error);

          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(OFFLINE_URL);
          return cachedResponse;
        }
      })()
    );
  }
});