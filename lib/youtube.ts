export function isYouTubeLink(link?: string | null): boolean {
  if (!link) return false;
  return link.includes("youtube.com") || link.includes("youtu.be");
}

const YOUTUBE_ANDROID_PACKAGE = "com.google.android.youtube";

export type YouTubeOpenTarget = {
  url: string;
  useCurrentTab: boolean;
};

type YouTubeOpenTargetOptions = {
  userAgent?: string | null;
};

export function extractYouTubeVideoId(url?: string | null): string | null {
  if (!url) return null;

  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      const v = u.searchParams.get("v");
      if (v) return v;

      const shorts = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{6,})/);
      if (shorts) return shorts[1] ?? null;
    }

    if (host === "youtu.be") {
      return u.pathname.split("/").filter(Boolean)[0] || null;
    }
  } catch {
    return null;
  }

  return null;
}

export function buildYouTubeWatchVideosUrl(videoIds: string[]): string | null {
  if (videoIds.length === 0) return null;
  const ids = videoIds.slice(0, 50);
  return `https://www.youtube.com/watch_videos?video_ids=${ids.join(",")}`;
}

function getUserAgent(userAgent?: string | null): string {
  if (userAgent !== undefined && userAgent !== null) {
    return userAgent;
  }
  if (typeof navigator === "undefined") {
    return "";
  }
  return navigator.userAgent;
}

function isAndroidUserAgent(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

function isAppleMobileUserAgent(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent);
}

export function buildAndroidIntentUrl(
  url: string,
  packageName = YOUTUBE_ANDROID_PACKAGE,
): string | null {
  try {
    const parsedUrl = new URL(url);
    const scheme = parsedUrl.protocol.replace(/:$/, "");
    if (scheme !== "https" && scheme !== "http") {
      return null;
    }

    return `intent://${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}#Intent;scheme=${scheme};package=${packageName};S.browser_fallback_url=${encodeURIComponent(url)};end`;
  } catch {
    return null;
  }
}

export function getYouTubeOpenTarget(
  url: string,
  options: YouTubeOpenTargetOptions = {},
): YouTubeOpenTarget {
  const userAgent = getUserAgent(options.userAgent);

  if (!isYouTubeLink(url)) {
    return { url, useCurrentTab: false };
  }

  if (isAndroidUserAgent(userAgent)) {
    return {
      url: buildAndroidIntentUrl(url) ?? url,
      useCurrentTab: true,
    };
  }

  if (isAppleMobileUserAgent(userAgent)) {
    return { url, useCurrentTab: true };
  }

  return { url, useCurrentTab: false };
}
