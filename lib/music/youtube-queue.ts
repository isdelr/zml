type QueueTrackLike = {
  _id?: string | null;
  roundId?: string | null;
  submissionType?: string | null;
  songLink?: string | null;
  duration?: number | null;
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

export function getRoundQueueYouTubePlaylist(
  queue: QueueTrackLike[],
  roundId: string,
  extractVideoId: (url: string | null | undefined) => string | null,
  maxIds = 50,
  startSubmissionId?: string | null,
): {
  videoIds: string[];
  submissionIds: string[];
  totalDurationSec: number;
} {
  const videoIds: string[] = [];
  const submissionIds: string[] = [];
  const seenVideoIds = new Set<string>();
  let totalDurationSec = 0;
  let startVideoId: string | null = null;

  for (const track of queue) {
    if (track?.roundId !== roundId || track?.submissionType !== "youtube") {
      continue;
    }

    const videoId = extractVideoId(track.songLink);
    if (!videoId) {
      continue;
    }

    if (track._id) {
      submissionIds.push(track._id);
      if (track._id === startSubmissionId) {
        startVideoId = videoId;
      }
    }

    if (seenVideoIds.has(videoId)) {
      continue;
    }

    seenVideoIds.add(videoId);
    videoIds.push(videoId);
    totalDurationSec +=
      Number.isFinite(track.duration) && (track.duration ?? 0) > 0
        ? Math.floor(track.duration as number)
        : 180;

    if (videoIds.length >= maxIds) {
      break;
    }
  }

  if (startVideoId) {
    const startIndex = videoIds.indexOf(startVideoId);
    if (startIndex > 0) {
      const orderedVideoIds = [
        ...videoIds.slice(startIndex),
        ...videoIds.slice(0, startIndex),
      ];
      return { videoIds: orderedVideoIds, submissionIds, totalDurationSec };
    }
  }

  return { videoIds, submissionIds, totalDurationSec };
}
