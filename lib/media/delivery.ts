import { firstNonEmpty } from "../env";

export type MediaAssetKind = "audio" | "art";

type PublicMediaScope = {
  type: "public";
};

type UserMediaScope = {
  type: "user";
  userId: string;
};

export type MediaAccessScope = PublicMediaScope | UserMediaScope;

export type MediaAccessTokenPayload = {
  v: 1;
  submissionId: string;
  assetKind: MediaAssetKind;
  storageKey: string;
  scope: MediaAccessScope["type"];
  userId?: string;
  expiresAt: number;
};

const MEDIA_ACCESS_TOKEN_VERSION = 1;
const DEFAULT_MEDIA_ACCESS_TTL_SECONDS = 60 * 60;

function getMediaAccessSecret(): string {
  const secret = firstNonEmpty(
    process.env.MEDIA_ACCESS_SECRET,
    process.env.INSTANCE_SECRET,
  );

  if (!secret) {
    throw new Error(
      "Missing media access secret. Set MEDIA_ACCESS_SECRET or INSTANCE_SECRET.",
    );
  }

  return secret;
}

function getMediaAccessTtlMs(): number {
  const configuredSeconds = Number.parseInt(
    process.env.MEDIA_ACCESS_TTL_SECONDS ??
      `${DEFAULT_MEDIA_ACCESS_TTL_SECONDS}`,
    10,
  );

  if (!Number.isFinite(configuredSeconds) || configuredSeconds <= 0) {
    return DEFAULT_MEDIA_ACCESS_TTL_SECONDS * 1000;
  }

  return configuredSeconds * 1000;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
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

async function signPayload(
  encodedPayload: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload),
  );

  return bytesToBase64Url(new Uint8Array(signature));
}

function getMediaDeliveryBaseUrl(): string | null {
  return (
    firstNonEmpty(
      process.env.MEDIA_DELIVERY_BASE_URL,
      process.env.NEXT_PUBLIC_MEDIA_DELIVERY_BASE_URL,
      process.env.SITE_URL,
    )?.replace(
      /\/+$/u,
      "",
    ) ?? null
  );
}

export function buildSubmissionMediaPath(
  submissionId: string,
  assetKind: MediaAssetKind,
): string {
  return `/api/media/submissions/${submissionId}/${assetKind}`;
}

export function buildSubmissionAudioDownloadPath(submissionId: string): string {
  return `/api/media/submissions/${submissionId}/audio/download`;
}

export function buildRoundImageMediaPath(roundId: string): string {
  return `/api/media/rounds/${roundId}/image`;
}

export function buildUserAvatarMediaPath(userId: string): string {
  return `/api/media/users/${userId}/avatar`;
}

export async function createMediaAccessToken(input: {
  submissionId: string;
  assetKind: MediaAssetKind;
  storageKey: string;
  scope: MediaAccessScope;
  nowMs?: number;
}): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = (input.nowMs ?? Date.now()) + getMediaAccessTtlMs();
  const payload: MediaAccessTokenPayload = {
    v: MEDIA_ACCESS_TOKEN_VERSION,
    submissionId: input.submissionId,
    assetKind: input.assetKind,
    storageKey: input.storageKey,
    scope: input.scope.type,
    expiresAt,
    ...(input.scope.type === "user" ? { userId: input.scope.userId } : {}),
  };

  const encodedPayload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await signPayload(encodedPayload, getMediaAccessSecret());

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt,
  };
}

export async function verifyMediaAccessToken(
  token: string,
): Promise<MediaAccessTokenPayload | null> {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = await signPayload(
    encodedPayload,
    getMediaAccessSecret(),
  );
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(encodedPayload)),
    ) as Partial<MediaAccessTokenPayload>;

    if (
      payload.v !== MEDIA_ACCESS_TOKEN_VERSION ||
      typeof payload.submissionId !== "string" ||
      (payload.assetKind !== "audio" && payload.assetKind !== "art") ||
      typeof payload.storageKey !== "string" ||
      (payload.scope !== "public" && payload.scope !== "user") ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }

    if (payload.scope === "user" && typeof payload.userId !== "string") {
      return null;
    }

    return payload as MediaAccessTokenPayload;
  } catch {
    return null;
  }
}

export async function buildSubmissionMediaUrl(input: {
  submissionId: string;
  assetKind: MediaAssetKind;
  storageKey: string;
  scope: MediaAccessScope;
}): Promise<string> {
  return buildTokenizedMediaUrl({
    tokenSubjectId: input.submissionId,
    path: buildSubmissionMediaPath(input.submissionId, input.assetKind),
    assetKind: input.assetKind,
    storageKey: input.storageKey,
    scope: input.scope,
  });
}

export async function buildRoundImageMediaUrl(input: {
  roundId: string;
  storageKey: string;
  scope: MediaAccessScope;
}): Promise<string> {
  return buildTokenizedMediaUrl({
    tokenSubjectId: `round:${input.roundId}`,
    path: buildRoundImageMediaPath(input.roundId),
    assetKind: "art",
    storageKey: input.storageKey,
    scope: input.scope,
  });
}

export async function buildUserAvatarMediaUrl(input: {
  userId: string;
  storageKey: string;
}): Promise<string> {
  return buildTokenizedMediaUrl({
    tokenSubjectId: `avatar:${input.userId}`,
    path: buildUserAvatarMediaPath(input.userId),
    assetKind: "art",
    storageKey: input.storageKey,
    scope: { type: "public" },
  });
}

async function buildTokenizedMediaUrl(input: {
  tokenSubjectId: string;
  path: string;
  assetKind: MediaAssetKind;
  storageKey: string;
  scope: MediaAccessScope;
}): Promise<string> {
  const { token, expiresAt } = await createMediaAccessToken({
    submissionId: input.tokenSubjectId,
    assetKind: input.assetKind,
    storageKey: input.storageKey,
    scope: input.scope,
  });
  const url = new URL(
    input.path,
    getMediaDeliveryBaseUrl() ?? "http://localhost",
  );

  url.searchParams.set("mediaToken", token);
  url.searchParams.set("mediaExpires", `${expiresAt}`);

  const baseUrl = getMediaDeliveryBaseUrl();
  if (!baseUrl) {
    return `${url.pathname}${url.search}`;
  }

  return url.toString();
}
