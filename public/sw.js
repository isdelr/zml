// public/sw.js
const CACHE_NAME = "zml-cache-v1";
const OFFLINE_URL = "/offline.html";
const STATIC_ASSETS = [
  OFFLINE_URL,
  // You can add other critical assets here if needed, like a logo
  // '/icons/icon-192x192.png', 
];

// Add installation event for debugging
self.addEventListener('install', function() {
  console.log('[SW] Service Worker installing');
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
});

// Enhanced push event handler with better error handling and debugging
self.addEventListener('push', function (event) {
  console.log('[SW] Push event received');
  
  if (!event.data) {
    console.log('[SW] No data in push event');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[SW] Push data:', data);
    
    const options = {
      body: data.body,
      icon: data.icon || '/icons/web-app-manifest-192x192.png',
      badge: data.badge || '/icons/web-app-manifest-192x192.png',
      vibrate: [100, 50, 100],
      requireInteraction: true, // Keep notification visible until user interacts
      tag: 'zml-notification', // Prevent duplicate notifications
      // Store the URL from the payload into the notification's data
      data: {
        url: data.data?.url || "/",
      },
      // Add action buttons for better engagement
      actions: [
        {
          action: 'open',
          title: 'Open',
          icon: '/icons/web-app-manifest-192x192.png'
        },
        {
          action: 'close',
          title: 'Close'
        }
      ]
    };
    
    console.log('[SW] Showing notification with options:', options);
    
    const notificationPromise = self.registration.showNotification(data.title, options)
      .then(() => {
        console.log('[SW] Notification shown successfully');
      })
      .catch(error => {
        console.error('[SW] Error showing notification:', error);
      });
    
    event.waitUntil(notificationPromise);
  } catch (error) {
    console.error('[SW] Error parsing push data:', error);
  }
});

// Enhanced notification click handler
self.addEventListener('notificationclick', function (event) {
  console.log('[SW] Notification click received, action:', event.action);
  event.notification.close();

  if (event.action === 'close') {
    return; // Just close the notification
  }

  // Get the URL from the notification's data property
  const urlToOpen = event.notification.data?.url || '/';
  const fullUrl = new URL(urlToOpen, self.location.origin).href;
  
  console.log('[SW] Opening URL:', fullUrl);

  const promiseChain = self.clients
    .matchAll({
      type: "window",
      includeUncontrolled: true,
    })
    .then((clientList) => {
      console.log('[SW] Found clients:', clientList.length);
      
      // Try to find an existing client with the same URL
      let client = clientList.find(c => c.url === fullUrl);
      
      if (client) {
        console.log('[SW] Focusing existing client');
        return client.focus();
      }
      
      // Try to find any client from the same origin and navigate it
      client = clientList.find(c => new URL(c.url).origin === self.location.origin);
      
      if (client) {
        console.log('[SW] Navigating existing client to new URL');
        return client.navigate(fullUrl).then(() => client.focus());
      }
      
      console.log('[SW] Opening new window');
      return self.clients.openWindow(fullUrl);
    })
    .catch(error => {
      console.error('[SW] Error handling notification click:', error);
    });

  event.waitUntil(promiseChain);
});

self.addEventListener("activate", (event) => {
  console.log('[SW] Service Worker activating');
  
  event.waitUntil(
    (async () => {
      // Enable navigation preloading if it's supported
      if ("navigationPreload" in self.registration) {
        await self.registration.navigationPreload.enable();
      }
      
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      
      // Take control of all pages immediately
      await self.clients.claim();
      console.log('[SW] Service Worker activated and claimed clients');
    })()
  );
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
          console.log("[SW] Fetch failed; returning offline page.", error);

          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(OFFLINE_URL);
          return cachedResponse;
        }
      })()
    );
  }
});