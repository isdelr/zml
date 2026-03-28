export interface Env {
  MEDIA_ACCESS_SECRET: string;
  ORIGIN_BASE_URL: string;
}

type MediaAssetKind = "audio" | "art";

type MediaTokenPayload = {
  v: 1;
  submissionId: string;
  assetKind: MediaAssetKind;
  storageKey: string;
  scope: "public" | "user";
  userId?: string;
  expiresAt: number;
};

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function sign(encodedPayload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload),
  );

  return encodeBase64Url(new Uint8Array(signature));
}

async function verifyToken(
  token: string,
  env: Env,
): Promise<MediaTokenPayload | null> {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = await sign(encodedPayload, env.MEDIA_ACCESS_SECRET);
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encodedPayload)),
    ) as MediaTokenPayload;

    if (payload.v !== 1 || payload.expiresAt <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const mediaToken = url.searchParams.get("mediaToken");
    if (!mediaToken) {
      return new Response("Missing media token.", { status: 403 });
    }

    const payload = await verifyToken(mediaToken, env);
    if (!payload) {
      return new Response("Invalid or expired media token.", { status: 403 });
    }

    const originUrl = new URL(url.pathname, env.ORIGIN_BASE_URL);
    originUrl.search = url.search;

    const cacheUrl = new URL(originUrl.toString());
    cacheUrl.search = "";
    const cacheKey = new Request(cacheUrl.toString(), {
      method: request.method,
      headers: request.headers,
    });

    const cache = await caches.open("media-delivery");
    if (request.method === "GET" || request.method === "HEAD") {
      const cached = await cache.match(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const originResponse = await fetch(originUrl.toString(), {
      method: request.method,
      headers: request.headers,
    });

    if (
      originResponse.ok &&
      request.method === "GET" &&
      !request.headers.has("range")
    ) {
      await cache.put(cacheKey, originResponse.clone());
    }

    return originResponse;
  },
};
