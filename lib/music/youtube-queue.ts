type QueueTrackLike<TId extends string = string> = {
  _id?: TId | null;
  roundId?: string | null;
  submissionType?: string | null;
  songLink?: string | null;
  duration?: number | null;
};

export type YouTubePlaylistEntry<TId extends string = string> = {
  submissionIds: TId[];
  videoId: string;
  durationSec: number;
};

function getNormalizedDurationSec(duration?: number | null): number {
  return Number.isFinite(duration) && (duration ?? 0) > 0
    ? Math.floor(duration as number)
    : 180;
}

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

export function getYouTubePlaylistEntries<TId extends string = string>(
  queue: QueueTrackLike<TId>[],
  extractVideoId: (url: string | null | undefined) => string | null,
  options: {
    maxIds?: number;
    roundId?: string | null;
    startSubmissionId?: TId | null;
  } = {},
): YouTubePlaylistEntry<TId>[] {
  const maxIds = options.maxIds ?? 50;
  const entries: YouTubePlaylistEntry<TId>[] = [];
  const entryByVideoId = new Map<string, YouTubePlaylistEntry<TId>>();
  let startVideoId: string | null = null;

  for (const track of queue) {
    if (options.roundId && track?.roundId !== options.roundId) {
      continue;
    }
    if (track?.submissionType !== "youtube") {
      continue;
    }

    const videoId = extractVideoId(track.songLink);
    if (!videoId) {
      continue;
    }

    if (track._id && track._id === options.startSubmissionId) {
      startVideoId = videoId;
    }

    const existing = entryByVideoId.get(videoId);
    if (existing) {
      if (track._id) {
        existing.submissionIds.push(track._id);
      }
      continue;
    }

    if (entries.length >= maxIds) {
      break;
    }

    const entry: YouTubePlaylistEntry<TId> = {
      submissionIds: track._id ? [track._id] : [],
      videoId,
      durationSec: getNormalizedDurationSec(track.duration),
    };
    entries.push(entry);
    entryByVideoId.set(videoId, entry);
  }

  if (!startVideoId) {
    return entries;
  }

  const startIndex = entries.findIndex((entry) => entry.videoId === startVideoId);
  if (startIndex <= 0) {
    return entries;
  }

  return [...entries.slice(startIndex), ...entries.slice(0, startIndex)];
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
  const entries = getYouTubePlaylistEntries(queue, extractVideoId, {
    maxIds,
    roundId,
    startSubmissionId,
  });
  const submissionIds = queue
    .filter(
      (track) =>
        track?.roundId === roundId &&
        track?.submissionType === "youtube" &&
        Boolean(extractVideoId(track.songLink)) &&
        Boolean(track._id),
    )
    .map((track) => track._id as string);

  return {
    videoIds: entries.map((entry) => entry.videoId),
    submissionIds,
    totalDurationSec: entries.reduce((sum, entry) => sum + entry.durationSec, 0),
  };
}
