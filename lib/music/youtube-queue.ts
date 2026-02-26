type QueueTrackLike = {
  submissionType?: string | null;
  songLink?: string | null;
};

export function getQueueYouTubeVideoIds(
  queue: QueueTrackLike[],
  extractVideoId: (url: string | null | undefined) => string | null,
  maxIds = 50,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const track of queue) {
    if (track?.submissionType !== "youtube") continue;

    const id = extractVideoId(track.songLink);
    if (!id || seen.has(id)) continue;

    seen.add(id);
    ids.push(id);

    if (ids.length >= maxIds) break;
  }

  return ids;
}

export function markRoundYouTubePlaylistOpened(
  roundId?: string | null,
  storage?: Pick<Storage, "setItem"> | null,
) {
  if (!roundId) return;
  const targetStorage =
    storage ?? (typeof window !== "undefined" ? window.sessionStorage : null);
  if (!targetStorage) return;
  try {
    const sessionKey = `ytPlaylist:${roundId}`;
    const sessionOpenedKey = `${sessionKey}:opened`;
    targetStorage.setItem(sessionOpenedKey, "1");
  } catch {}
}
