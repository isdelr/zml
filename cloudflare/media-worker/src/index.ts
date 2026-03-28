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

type CloudflareRequestInit = RequestInit & {
  cf?: {
    cacheEverything?: boolean;
  };
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
  secret: string,
): Promise<MediaTokenPayload | null> {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = await sign(encodedPayload, secret);
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
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed.", { status: 405 });
    }

    const requestUrl = new URL(request.url);
    const mediaToken = requestUrl.searchParams.get("mediaToken");
    if (!mediaToken) {
      return new Response("Missing media token.", { status: 403 });
    }

    const payload = await verifyToken(mediaToken, env.MEDIA_ACCESS_SECRET);
    if (!payload) {
      return new Response("Invalid or expired media token.", { status: 403 });
    }

    const originBaseUrl = new URL(env.ORIGIN_BASE_URL);
    const originUrl = new URL(requestUrl.pathname, originBaseUrl);
    originUrl.search = requestUrl.search;

    return fetch(
      new Request(originUrl.toString(), {
        method: request.method,
        headers: request.headers,
      }),
      {
        cf: {
          cacheEverything: true,
        },
      } as CloudflareRequestInit,
    );
  },
};
