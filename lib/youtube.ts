export function isYouTubeLink(link?: string | null): boolean {
  if (!link) return false;
  return link.includes("youtube.com") || link.includes("youtu.be");
}

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

export function extractYouTubePlaylistVideoIds(url?: string | null): string[] {
  if (!url) return [];

  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, "");

    if (
      host !== "youtube.com" &&
      host !== "m.youtube.com" &&
      host !== "music.youtube.com"
    ) {
      return [];
    }

    if (parsedUrl.pathname === "/watch_videos") {
      const rawIds = parsedUrl.searchParams.get("video_ids");
      if (!rawIds) return [];
      return rawIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 50);
    }

    if (parsedUrl.pathname === "/watch") {
      const firstId = parsedUrl.searchParams.get("v")?.trim();
      const playlistIds =
        parsedUrl.searchParams
          .get("playlist")
          ?.split(",")
          .map((id) => id.trim())
          .filter(Boolean) ?? [];

      return [firstId, ...playlistIds].filter(
        (id): id is string => Boolean(id),
      );
    }
  } catch {
    return [];
  }

  return [];
}

export function buildYouTubeAppWatchUrl(videoIds: string[]): string | null {
  if (videoIds.length === 0) return null;
  const ids = videoIds.slice(0, 50);
  const [firstId, ...remainingIds] = ids;
  if (!firstId) return null;

  const params = new URLSearchParams({ v: firstId });
  if (remainingIds.length > 0) {
    params.set("playlist", remainingIds.join(","));
  }

  return `https://www.youtube.com/watch?${params.toString()}`;
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

function isAppleMobileUserAgent(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent);
}

function isAndroidUserAgent(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

export function getYouTubeOpenTarget(
  url: string,
  options: YouTubeOpenTargetOptions = {},
): YouTubeOpenTarget {
  const userAgent = getUserAgent(options.userAgent);

  if (!isYouTubeLink(url)) {
    return { url, useCurrentTab: false };
  }

  if (isAndroidUserAgent(userAgent) || isAppleMobileUserAgent(userAgent)) {
    const appWatchUrl = buildYouTubeAppWatchUrl(extractYouTubePlaylistVideoIds(url));
    return {
      url: appWatchUrl ?? url,
      useCurrentTab: true,
    };
  }

  return { url, useCurrentTab: false };
}
