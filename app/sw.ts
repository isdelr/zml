/// <reference lib="webworker" />

import { defaultCache } from "@serwist/turbopack/worker";
import {
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type RuntimeCaching,
} from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: Array<PrecacheEntry | string>;
};

type PushNotificationOptions = NotificationOptions & {
  vibrate?: number[];
  actions?: Array<{ action: string; title: string; icon?: string }>;
};

const toAbsolutePrecacheUrl = (url: string): string => {
  if (url.startsWith("/") || /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) {
    return url;
  }
  return `/${url.replace(/^\.?\//, "")}`;
};

const EXCLUDED_PRECACHE_PATTERNS = [
  /_clientmiddlewaremanifest\.json$/i,
  /_buildmanifest\.js$/i,
  /_ssgmanifest\.js$/i,
  /middleware-manifest\.json$/i,
];

const normalizeForMatch = (url: string): string => {
  try {
    const parsed = new URL(url, self.location.origin);
    return parsed.pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

const shouldExclude = (url: string): boolean => {
  const normalized = normalizeForMatch(url);
  return EXCLUDED_PRECACHE_PATTERNS.some((pattern) => pattern.test(normalized));
};

const precacheEntries = self.__SW_MANIFEST
  .map((entry) => {
    if (typeof entry === "string") {
      return toAbsolutePrecacheUrl(entry);
    }
    return {
      ...entry,
      url: toAbsolutePrecacheUrl(entry.url),
    };
  })
  .filter((entry) => {
    const url = typeof entry === "string" ? entry : entry.url;
    return !shouldExclude(url);
  });

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ request }) => request.headers.has("authorization"),
    method: "GET",
    handler: new NetworkOnly({ networkTimeoutSeconds: 10 }),
  },
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin && url.pathname.startsWith("/api/"),
    method: "GET",
    handler: new NetworkOnly({ networkTimeoutSeconds: 10 }),
  },
  {
    matcher: ({ url }) => {
      if (url.hostname.endsWith("convex.cloud")) {
        return true;
      }

      if (url.hostname === "convex-backend") {
        return true;
      }

      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return url.port === "3210" || url.port === "3211";
      }

      return false;
    },
    method: "GET",
    handler: new NetworkOnly({ networkTimeoutSeconds: 10 }),
  },
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries,
  precacheOptions: {
    cleanupOutdatedCaches: true,
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
});

serwist.setCatchHandler(async ({ request }) => {
  if (request.destination === "document") {
    const fallback = await serwist.matchPrecache("/offline.html");
    if (fallback) {
      return fallback;
    }
  }
  return Response.error();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json() as {
      title?: string;
      body?: string;
      icon?: string;
      badge?: string;
      data?: { url?: string };
    };

    const options: PushNotificationOptions = {
      body: data.body,
      icon: data.icon || "/icons/web-app-manifest-192x192.png",
      badge: data.badge || "/icons/web-app-manifest-192x192.png",
      vibrate: [100, 50, 100],
      requireInteraction: true,
      tag: "zml-notification",
      data: { url: data.data?.url || "/" },
      actions: [
        {
          action: "open",
          title: "Open",
          icon: "/icons/web-app-manifest-192x192.png",
        },
        { action: "close", title: "Close" },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(
        data.title || "ZML Notification",
        options,
      ),
    );
  } catch (error) {
    console.error("[SW] Push parse error:", error);
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
        (c) => new URL(c.url).origin === self.location.origin,
      );
      if (client) {
        await client.navigate(fullUrl);
        return client.focus();
      }

      return self.clients.openWindow(fullUrl);
    })(),
  );
});

// Catch unhandled rejections (e.g. bad-precaching-response from stale manifests)
// and notify clients so they can trigger recovery. Without this, SW-thread errors
// are invisible to the main-thread recovery logic in ServiceWorkerRegistrar.
self.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message =
    reason instanceof Error ? reason.message : String(reason ?? "");
  if (message.includes("bad-precaching-response")) {
    event.preventDefault();
    void self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: "SW_PRECACHE_ERROR" });
      }
    });
  }
});

serwist.addEventListeners();
