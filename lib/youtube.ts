export function isYouTubeLink(link?: string | null): boolean {
  if (!link) return false;
  return link.includes("youtube.com") || link.includes("youtu.be");
}

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
