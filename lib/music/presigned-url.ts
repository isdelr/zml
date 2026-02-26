const DEFAULT_SAFETY_WINDOW_MS = 60_000;
const DEFAULT_FALLBACK_REFRESH_MS = 15 * 60 * 1000;

export function parsePresignedUrlExpiry(url?: string | null): number | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const expires = parsed.searchParams.get("X-Amz-Expires");
    const date = parsed.searchParams.get("X-Amz-Date");
    if (!expires || !date) return null;

    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(4, 6)) - 1;
    const day = Number(date.slice(6, 8));
    const hour = Number(date.slice(9, 11));
    const minute = Number(date.slice(11, 13));
    const second = Number(date.slice(13, 15));

    const startMs = Date.UTC(year, month, day, hour, minute, second);
    const expiresSeconds = Number(expires);

    if (Number.isNaN(startMs) || Number.isNaN(expiresSeconds)) {
      return null;
    }

    return startMs + expiresSeconds * 1000;
  } catch {
    return null;
  }
}

export function getPresignedUrlRefreshDelayMs(
  expiryMs: number | null,
  nowMs = Date.now(),
  safetyWindowMs = DEFAULT_SAFETY_WINDOW_MS,
  fallbackRefreshMs = DEFAULT_FALLBACK_REFRESH_MS,
): number {
  if (!expiryMs) return fallbackRefreshMs;
  return Math.max(0, expiryMs - safetyWindowMs - nowMs);
}

