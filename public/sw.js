// public/sw.js
const CACHE_NAME = "zml-cache-v1";
const OFFLINE_URL = "/offline.html"; // We will need to create this page
const STATIC_ASSETS = [
  OFFLINE_URL,
  // You can add other critical assets here if needed, like a logo
  // '/icons/icon-192x192.png', 
];

self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/icons/web-app-manifest-192x192.png',
      badge: data.badge || '/icons/web-app-manifest-192x192.png',
      vibrate: [100, 50, 100],
      // **IMPORTANT**: Store the URL from the payload into the notification's data
      data: {
        url: data.data?.url || "/", // Default to root if no URL is provided
      },
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

// --- MODIFICATION 2: Update the 'notificationclick' event listener ---
self.addEventListener('notificationclick', function (event) {
  console.log('Notification click received.');
  event.notification.close();

  // **IMPORTANT**: Get the URL from the notification's data property
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  // This logic finds an open tab with the same URL and focuses it,
  // or opens a new tab if one isn't found.
  const promiseChain = self.clients
    .matchAll({
      type: "window",
      includeUncontrolled: true,
    })
    .then((clientList) => {
      let client = clientList.find(c => c.url === urlToOpen);

      if (client) {
        return client.focus();
      }
      return self.clients.openWindow(urlToOpen);
    });

  event.waitUntil(promiseChain);
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