// File: convex/submissions.ts
// convex/submissions.ts
import { makeFunctionReference, type FunctionReference } from "convex/server";
import { v } from "convex/values";
import {
  mutation,
  query,
  action,
  internalAction,
  internalQuery,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { B2Storage } from "./b2Storage";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { submissionsByUser } from "./aggregates";
import { submissionCounter } from "./counters";
import { getYouTubeVideoId } from "../lib/convex-server/submissions/youtube";
import { resolveSubmissionMediaUrls } from "../lib/convex-server/submissions/media";
import { resolveUserAvatarUrl } from "./userAvatar";
import {
  buildSubmissionSearchText,
  normalizeSubmissionArtist,
  normalizeSubmissionSongTitle,
} from "../lib/convex-server/submissions/normalize";
import { buildSubmissionLyricsFingerprint } from "../lib/convex-server/submissions/lyrics";
import { firstNonEmpty } from "../lib/env";
import {
  buildSubmissionMediaUrl,
  resolveMediaAccessScope,
  type MediaAccessScope,
} from "../lib/media/delivery";
import { formatArtistNames } from "../lib/music/submission-display";
import { getAnonymousCommentIdentity } from "../lib/comments/anonymous";
import { shouldRevealCommentIdentity } from "../lib/comments/visibility";
import { maybeAutoStartVotingAfterSubmissionCompletion } from "../lib/convex-server/rounds/auto-transition";
import { getUserSubmissionCompletionCount } from "../lib/rounds/submission-completion";

const storage = new B2Storage();
const TROLL_SUBMISSION_BAN_THRESHOLD = 2;
const TROLL_SUBMISSION_POINTS_PENALTY = 10;
const EXACT_DUPLICATE_MATCH_LIMIT = 50;
const FUZZY_DUPLICATE_MATCH_LIMIT = 30;
const DEFAULT_PENDING_AUDIO_PROCESSING_BATCH_SIZE = 10;
const MAX_PENDING_AUDIO_PROCESSING_BATCH_SIZE = 25;
const SUBMISSION_AUDIO_PROCESSING_STALE_MS = 15 * 60 * 1000;
const INTERNAL_SUBMISSION_AUDIO_ROUTE =
  "/api/internal/submissions/process-audio";
const getSubmissionMediaAccessStateRef = makeFunctionReference<
  "query",
  {
    submissionId: Id<"submissions">;
    viewerUserId: Id<"users"> | null;
  }
>(
  "submissions:getSubmissionMediaAccessState",
) as unknown as FunctionReference<
  "query",
  "internal",
  {
    submissionId: Id<"submissions">;
    viewerUserId: Id<"users"> | null;
  }
>;
const storeWaveformInternalRef = makeFunctionReference<
  "mutation",
  {
    submissionId: Id<"submissions">;
    waveformJson?: string;
  }
>(
  "submissions:storeWaveformInternal",
) as unknown as FunctionReference<
  "mutation",
  "internal",
  {
    submissionId: Id<"submissions">;
    waveformJson?: string;
  }
>;

export const submissionFileProcessingStatusValues = [
  "queued",
  "converting",
  "ready",
  "failed",
] as const;

type SubmissionFileProcessingStatus =
  (typeof submissionFileProcessingStatusValues)[number];

type PendingSubmissionAudioCandidate = {
  submissionId: Id<"submissions">;
  originalSongFileKey: string;
};

type PendingSubmissionAudioQueueRunResult = {
  requeued: number;
  attempted: number;
};

type SubmissionAudioProcessingResult = {
  key?: string;
  waveformJson?: string;
  error?: string;
  message?: string;
};

function getSubmissionFileProcessingStatus(
  submission: Pick<
    Doc<"submissions">,
    "submissionType" | "songFileKey" | "fileProcessingStatus"
  >,
): SubmissionFileProcessingStatus {
  if (submission.submissionType !== "file") {
    return "ready";
  }
  if (submission.fileProcessingStatus) {
    return submission.fileProcessingStatus;
  }
  return submission.songFileKey ? "ready" : "queued";
}

async function scheduleSubmissionAudioProcessing(
  ctx: Pick<MutationCtx, "scheduler">,
  submissionId: Id<"submissions">,
) {
  await ctx.scheduler.runAfter(
    0,
    internal.submissions.processQueuedSubmissionAudio,
    {
      submissionId,
    },
  );
}

function getSubmissionProcessingSecret() {
  const secret = process.env.SUBMISSION_PROCESSING_SECRET;
  if (!secret) {
    throw new Error(
      "SUBMISSION_PROCESSING_SECRET is required for internal audio processing.",
    );
  }

  return secret;
}

async function processSubmissionAudioFile(
  siteUrl: string,
  songFileKey: string,
): Promise<SubmissionAudioProcessingResult & { key: string }> {
  const response = await fetch(`${siteUrl}${INTERNAL_SUBMISSION_AUDIO_ROUTE}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${getSubmissionProcessingSecret()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ songFileKey }),
  });
  const responseText = await response.text();
  let payload: SubmissionAudioProcessingResult;
  try {
    payload = JSON.parse(responseText) as SubmissionAudioProcessingResult;
  } catch {
    payload = {};
  }

  if (!response.ok || !payload.key) {
    throw new Error(
      payload.message ??
        payload.error ??
        (responseText ||
          `Submission audio processing failed with status ${response.status}.`),
    );
  }

  return {
    ...payload,
    key: payload.key,
  };
}

async function scheduleSubmissionFileDeletion(
  ctx: Pick<MutationCtx, "scheduler">,
  keys: Iterable<string>,
  failureLabel: string,
) {
  const uniqueKeys = [...new Set(keys)].filter((key) => key.length > 0);
  if (uniqueKeys.length === 0) {
    return;
  }

  await ctx.scheduler.runAfter(0, internal.submissions.deleteSubmissionFiles, {
    keys: uniqueKeys,
    failureLabel,
  });
  await ctx.scheduler.runAfter(0, internal.files.markStorageUploadsDeleted, {
    keys: uniqueKeys,
  });
}

async function claimSubmissionUpload(
  ctx: Pick<MutationCtx, "runMutation">,
  input: {
    key: string;
    ownerUserId: Id<"users">;
    claimType:
      | "submission_album_art"
      | "submission_audio_original";
    claimId: string;
  },
) {
  await ctx.runMutation(internal.files.claimStorageUpload, {
    key: input.key,
    ownerUserId: input.ownerUserId,
    kind: "submission_file",
    claimType: input.claimType,
    claimId: input.claimId,
  });
}

async function canViewLeague(
  ctx: Pick<QueryCtx, "db">,
  leagueId: Id<"leagues">,
  userId: Id<"users"> | null,
) {
  const league = await ctx.db.get("leagues", leagueId);
  if (!league) {
    return { league: null, canView: false as const };
  }

  if (league.isPublic) {
    return { league, canView: true as const };
  }

  if (!userId) {
    return { league, canView: false as const };
  }

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_league_and_user", (q) =>
      q.eq("leagueId", leagueId).eq("userId", userId),
    )
    .first();

  return { league, canView: Boolean(membership) };
}

function buildMediaScope(
  allowPublic: boolean,
  viewerUserId: Id<"users"> | null,
): MediaAccessScope {
  const scope = resolveMediaAccessScope(allowPublic, viewerUserId);
  if (!scope) {
    throw new Error("Cannot build media scope for a private anonymous viewer.");
  }
  return scope;
}

async function updateSubmissionTrollPenalty(
  ctx: MutationCtx,
  submissionId: Id<"submissions">,
  applyPenalty: boolean,
) {
  const roundResult = await ctx.db
    .query("roundResults")
    .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
    .unique();
  if (!roundResult) {
    return;
  }

  if (applyPenalty) {
    if (roundResult.penaltyApplied) {
      return;
    }
    await ctx.db.patch("roundResults", roundResult._id, {
      points: roundResult.points - TROLL_SUBMISSION_POINTS_PENALTY,
      penaltyApplied: true,
    });
    return;
  }

  if (!roundResult.penaltyApplied) {
    return;
  }
  await ctx.db.patch("roundResults", roundResult._id, {
    points: roundResult.points + TROLL_SUBMISSION_POINTS_PENALTY,
    penaltyApplied: false,
  });
}

async function recalculateAndPatchTrollMembershipStatus(
  ctx: MutationCtx,
  submission: Doc<"submissions">,
) {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_league_and_user", (q) =>
      q.eq("leagueId", submission.leagueId).eq("userId", submission.userId),
    )
    .unique();
  if (!membership) {
    return;
  }

  const userLeagueSubs = await ctx.db
    .query("submissions")
    .withIndex("by_user_and_league", (q) =>
      q.eq("userId", submission.userId).eq("leagueId", submission.leagueId),
    )
    .collect();
  const trollCount = userLeagueSubs.filter((s) => s.isTrollSubmission).length;
  const isBannedNow = trollCount >= TROLL_SUBMISSION_BAN_THRESHOLD;

  await ctx.db.patch("memberships", membership._id, {
    trollSubmissionCount: trollCount,
    isBanned: isBannedNow,
    bannedAt: isBannedNow ? (membership.bannedAt ?? Date.now()) : undefined,
  });
}

export const getSongMetadataFromLink = action({
  args: { link: v.string() },
  handler: async (ctx, args) => {
    if (args.link.includes("youtube") || args.link.includes("youtu.be")) {
      const videoId = getYouTubeVideoId(args.link);
      if (!videoId) {
        throw new Error("Invalid YouTube link provided.");
      }

      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        throw new Error("YouTube API key is not set in environment variables.");
      }

      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch video data from YouTube API.");
      }
      const data = await response.json();
      if (!data.items || data.items.length === 0) {
        throw new Error("Could not find YouTube video with that link.");
      }

      const snippet = data.items[0].snippet;
      const contentDetails = data.items[0].contentDetails;

      const parseISO8601Duration = (durationString: string) => {
        const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
        const matches = durationString.match(regex);
        if (!matches) return 0;
        const hours = parseInt(matches[1] || "0", 10);
        const minutes = parseInt(matches[2] || "0", 10);
        const seconds = parseInt(matches[3] || "0", 10);
        return hours * 3600 + minutes * 60 + seconds;
      };

      return {
        songTitle: snippet.title,
        artist: snippet.channelTitle,
        albumArtUrl:
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.default?.url ||
          null,
        submissionType: "youtube" as const,
        duration: contentDetails.duration
          ? parseISO8601Duration(contentDetails.duration)
          : 0,
      };
    }

    throw new Error("Invalid link provided. Please use a YouTube link.");
  },
});

export const submitSong = mutation({
  args: {
    roundId: v.id("rounds"),
    submissionType: v.union(v.literal("file"), v.literal("youtube")),
    songTitle: v.string(),
    artist: v.string(),
    albumName: v.optional(v.string()),
    year: v.optional(v.number()),
    comment: v.optional(v.string()),
    albumArtKey: v.optional(v.string()),
    songFileKey: v.optional(v.string()),
    songLink: v.optional(v.string()),
    albumArtUrlValue: v.optional(v.string()),
    duration: v.optional(v.number()),
    // Collection/Album fields
    collectionId: v.optional(v.string()),
    collectionType: v.optional(v.union(v.literal("multi"), v.literal("album"))),
    collectionName: v.optional(v.string()),
    collectionArtist: v.optional(v.string()),
    collectionNotes: v.optional(v.string()),
    collectionReleaseYear: v.optional(v.number()),
    collectionTotalTracks: v.optional(v.number()),
    trackNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) throw new Error("Round not found.");
    if (round.status !== "scheduled" && round.status !== "submissions")
      throw new Error("Submissions are not open.");
    if (
      round.status === "submissions" &&
      round.submissionStartsAt !== undefined &&
      round.submissionStartsAt > Date.now()
    ) {
      throw new Error("This round has not opened for submissions yet.");
    }
    if (round.submissionDeadline <= Date.now()) {
      throw new Error(
        "The submission deadline has passed. Recent uploads are still finishing in the background.",
      );
    }

    // Check if user is banned from this league or is a spectator
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_league_and_user", (q) =>
        q.eq("leagueId", round.leagueId).eq("userId", userId),
      )
      .unique();

    if (membership?.isBanned) {
      throw new Error(
        "You have been permanently banned from this league for repeated troll submissions.",
      );
    }

    if (membership?.isSpectator) {
      throw new Error(
        "Spectators cannot submit songs. Join as a full member to participate.",
      );
    }

    const submissionsPerUser = round.submissionsPerUser ?? 1;

    const existingSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", args.roundId).eq("userId", userId),
      )
      .collect();

    const submissionMode = round.submissionMode ?? "single";
    const submissionCount = getUserSubmissionCompletionCount(
      existingSubmissions,
      submissionMode,
      userId,
    );
    if (submissionMode === "album" || submissionMode === "multi") {
      const collectionId = args.collectionId?.trim();
      const hasExistingCollection =
        !!collectionId &&
        existingSubmissions.some(
          (submission) => submission.collectionId === collectionId,
        );
      if (collectionId && !hasExistingCollection && submissionCount >= submissionsPerUser) {
        throw new Error(
          `You have already submitted the maximum of ${submissionsPerUser} album(s).`,
        );
      }
    } else if (submissionCount >= submissionsPerUser) {
      throw new Error(
        `You have already submitted the maximum of ${submissionsPerUser} song(s).`,
      );
    }

    const formattedArtist = formatArtistNames(args.artist);
    const albumName = args.albumName?.trim() || args.collectionName?.trim() || undefined;

    const baseSubmissionData = {
      leagueId: round.leagueId,
      roundId: args.roundId,
      userId,
      songTitle: args.songTitle,
      artist: formattedArtist,
      albumName,
      year: args.year,
      comment: args.comment,
      duration: args.duration,
      searchText: buildSubmissionSearchText(
        args.songTitle,
        formattedArtist,
        albumName,
      ),
      normalizedSongTitle: normalizeSubmissionSongTitle(args.songTitle),
      normalizedArtist: normalizeSubmissionArtist(formattedArtist),
      collectionId: args.collectionId,
      collectionType: args.collectionType,
      collectionName: args.collectionName,
      collectionArtist: args.collectionArtist,
      collectionNotes: args.collectionNotes,
      collectionReleaseYear: args.collectionReleaseYear,
      collectionTotalTracks: args.collectionTotalTracks,
      trackNumber: args.trackNumber,
    };

    let submissionId: Id<"submissions">;

    if (args.submissionType === "file") {
      if (!args.albumArtKey || !args.songFileKey) {
        throw new Error("File keys are required for manual submission.");
      }
      const now = Date.now();
      submissionId = await ctx.db.insert("submissions", {
        ...baseSubmissionData,
        submissionType: "file",
        albumArtKey: args.albumArtKey,
        originalSongFileKey: args.songFileKey,
        fileProcessingStatus: "queued",
        fileProcessingQueuedAt: now,
      });
      await claimSubmissionUpload(ctx, {
        key: args.albumArtKey,
        ownerUserId: userId,
        claimType: "submission_album_art",
        claimId: submissionId,
      });
      await claimSubmissionUpload(ctx, {
        key: args.songFileKey,
        ownerUserId: userId,
        claimType: "submission_audio_original",
        claimId: submissionId,
      });
    } else {
      if (!args.songLink || !args.albumArtUrlValue) {
        throw new Error(
          "Link and album art URL are required for link submission.",
        );
      }
      submissionId = await ctx.db.insert("submissions", {
        ...baseSubmissionData,
        submissionType: args.submissionType,
        songLink: args.songLink,
        albumArtUrlValue: args.albumArtUrlValue,
        fileProcessingStatus: "ready",
      });
    }

    await submissionCounter.inc(ctx, args.roundId);
    const submissionDoc = await ctx.db.get("submissions", submissionId);
    await submissionsByUser.insert(ctx, submissionDoc!);
    if (args.submissionType === "file") {
      await scheduleSubmissionAudioProcessing(ctx, submissionId);
    }
    let shouldEvaluateAutoStart = true;
    if (
      submissionMode !== "single" &&
      args.collectionId &&
      typeof args.collectionTotalTracks === "number"
    ) {
      const collectionSubmissions = await ctx.db
        .query("submissions")
        .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId!))
        .collect();
      shouldEvaluateAutoStart =
        collectionSubmissions.length >= args.collectionTotalTracks;
    }

    if (shouldEvaluateAutoStart) {
      await maybeAutoStartVotingAfterSubmissionCompletion(
        ctx,
        args.roundId,
        userId,
      );
    }
  },
});

export const editSong = mutation({
  args: {
    submissionId: v.id("submissions"),
    songTitle: v.string(),
    artist: v.string(),
    albumName: v.optional(v.string()),
    year: v.optional(v.number()),
    submissionType: v.union(v.literal("file"), v.literal("youtube")),
    comment: v.optional(v.string()),
    albumArtKey: v.optional(v.union(v.string(), v.null())),
    songFileKey: v.optional(v.union(v.string(), v.null())),
    songLink: v.optional(v.union(v.string(), v.null())),
    albumArtUrlValue: v.optional(v.union(v.string(), v.null())),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) throw new Error("Submission not found.");
    if (submission.userId !== userId) {
      throw new Error("You can only edit your own submissions.");
    }

    const round = await ctx.db.get("rounds", submission.roundId);
    if (!round) throw new Error("Round not found.");
    if (round.status !== "scheduled" && round.status !== "submissions") {
      throw new Error(
        "You can only edit submissions before voting begins.",
      );
    }

    const oldDoc = submission;
    const { submissionId } = args;
    const previousAlbumArtKey = submission.albumArtKey ?? null;
    const previousSongFileKey = submission.songFileKey ?? null;
    const previousOriginalSongFileKey = submission.originalSongFileKey ?? null;
    const previousSongFileLegacyKey = submission.songFileLegacyKey ?? null;
    const previousSongLink = submission.songLink ?? null;

    let nextAlbumArtKey: string | null = previousAlbumArtKey;
    if (args.albumArtKey !== undefined) {
      nextAlbumArtKey = args.albumArtKey;
    }

    let nextSongFileKey: string | null = previousSongFileKey;
    let nextOriginalSongFileKey: string | null = previousOriginalSongFileKey;
    if (args.songFileKey !== undefined) {
      nextSongFileKey = null;
      nextOriginalSongFileKey = args.songFileKey;
    }

    let nextSongLink: string | null = previousSongLink;
    if (args.songLink !== undefined) {
      nextSongLink = args.songLink;
    }

    const formattedArtist = formatArtistNames(args.artist);
    const albumName = args.albumName?.trim() || undefined;

    const updates: Partial<Doc<"submissions">> = {
      songTitle: args.songTitle,
      artist: formattedArtist,
      albumName,
      year: args.year,
      submissionType: args.submissionType,
      comment: args.comment,
      duration: args.duration,
    };

    if (args.albumArtKey !== undefined) {
      updates.albumArtKey = args.albumArtKey ?? undefined;
    }
    if (args.songFileKey !== undefined) {
      updates.songFileKey = undefined;
      updates.originalSongFileKey = args.songFileKey ?? undefined;
      updates.songFileLegacyKey = undefined;
      updates.fileProcessingStatus = args.songFileKey ? "queued" : undefined;
      updates.fileProcessingError = undefined;
      updates.fileProcessingQueuedAt = args.songFileKey ? Date.now() : undefined;
      updates.fileProcessingStartedAt = undefined;
      updates.fileProcessingCompletedAt = undefined;
    }
    if (args.songLink !== undefined) {
      updates.songLink = args.songLink ?? undefined;
    }
    if (args.albumArtUrlValue !== undefined) {
      updates.albumArtUrlValue = args.albumArtUrlValue ?? undefined;
    }

    const newTitle = args.songTitle ?? submission.songTitle;
    const newArtist = formattedArtist || submission.artist;
    const newAlbumName = albumName ?? submission.albumName;
    updates.searchText = buildSubmissionSearchText(
      newTitle,
      newArtist,
      newAlbumName,
    );
    updates.normalizedSongTitle = normalizeSubmissionSongTitle(newTitle);
    updates.normalizedArtist = normalizeSubmissionArtist(newArtist);

    if (args.submissionType === "file") {
      updates.songLink = undefined;
      updates.albumArtUrlValue = undefined;
      nextSongLink = null;
      if (args.songFileKey === undefined) {
        nextSongFileKey = previousSongFileKey;
        nextOriginalSongFileKey = previousOriginalSongFileKey;
      }
      if (!submission.fileProcessingStatus && previousSongFileKey) {
        updates.fileProcessingStatus = "ready";
      }
    } else {
      updates.albumArtKey = undefined;
      updates.songFileKey = undefined;
      updates.originalSongFileKey = undefined;
      updates.songFileLegacyKey = undefined;
      updates.fileProcessingStatus = "ready";
      updates.fileProcessingError = undefined;
      updates.fileProcessingStartedAt = undefined;
      updates.fileProcessingCompletedAt = Date.now();
      nextAlbumArtKey = null;
      nextSongFileKey = null;
      nextOriginalSongFileKey = null;
    }

    const previousLyricsFingerprint = buildSubmissionLyricsFingerprint({
      artist: submission.artist,
      originalSongFileKey: previousOriginalSongFileKey,
      songFileKey: previousSongFileKey,
      songLink: previousSongLink,
      songTitle: submission.songTitle,
      submissionType: submission.submissionType,
    });
    const nextLyricsFingerprint = buildSubmissionLyricsFingerprint({
      artist: newArtist,
      originalSongFileKey: nextOriginalSongFileKey,
      songFileKey: nextSongFileKey,
      songLink: nextSongLink,
      songTitle: newTitle,
      submissionType: args.submissionType,
    });
    const shouldInvalidateLyrics =
      previousLyricsFingerprint !== nextLyricsFingerprint;

    if (
      args.submissionType === "file" &&
      args.albumArtKey &&
      args.albumArtKey !== previousAlbumArtKey
    ) {
      await claimSubmissionUpload(ctx, {
        key: args.albumArtKey,
        ownerUserId: userId,
        claimType: "submission_album_art",
        claimId: submissionId,
      });
    }
    if (
      args.submissionType === "file" &&
      args.songFileKey &&
      args.songFileKey !== previousOriginalSongFileKey
    ) {
      await claimSubmissionUpload(ctx, {
        key: args.songFileKey,
        ownerUserId: userId,
        claimType: "submission_audio_original",
        claimId: submissionId,
      });
    }

    if (shouldInvalidateLyrics) {
      updates.lyrics = undefined;
      updates.lyricsFetchFingerprint = undefined;
      updates.lyricsFetchStatus = undefined;
      updates.lyricsFetchDetail = undefined;
      updates.lyricsFetchedAt = undefined;
    }

    await ctx.db.patch("submissions", submissionId, updates);
    const newDoc = await ctx.db.get("submissions", submissionId);
    await submissionsByUser.replace(ctx, oldDoc, newDoc!);

    const keysToDelete = new Set<string>();
    if (previousAlbumArtKey && previousAlbumArtKey !== nextAlbumArtKey) {
      keysToDelete.add(previousAlbumArtKey);
    }
    if (previousSongFileKey && previousSongFileKey !== nextSongFileKey) {
      keysToDelete.add(previousSongFileKey);
    }
    if (
      previousOriginalSongFileKey &&
      previousOriginalSongFileKey !== nextOriginalSongFileKey
    ) {
      keysToDelete.add(previousOriginalSongFileKey);
    }
    if (
      previousSongFileLegacyKey &&
      (args.songFileKey !== undefined || args.submissionType !== "file")
    ) {
      keysToDelete.add(previousSongFileLegacyKey);
    }
    await scheduleSubmissionFileDeletion(
      ctx,
      keysToDelete,
      "stale submission file",
    );
    if (
      args.submissionType === "file" &&
      typeof args.songFileKey === "string" &&
      args.songFileKey.length > 0
    ) {
      await scheduleSubmissionAudioProcessing(ctx, submissionId);
    }

    await maybeAutoStartVotingAfterSubmissionCompletion(
      ctx,
      submission.roundId,
      userId,
    );

    return "Submission updated successfully.";
  },
});

export const deleteSubmissionFiles = internalAction({
  args: {
    keys: v.array(v.string()),
    failureLabel: v.string(),
  },
  handler: async (_ctx, args) => {
    for (const key of new Set(args.keys)) {
      try {
        await storage.deleteObject(key);
      } catch (error) {
        console.error(`Failed to delete ${args.failureLabel} "${key}"`, error);
      }
    }
  },
});

export const getForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) return [];

    const { league, canView } = await canViewLeague(
      ctx,
      round.leagueId,
      userId,
    );
    if (!league || !canView) return [];

    const submissions = (
      await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
      .collect()
    ).filter((submission) =>
      round.status === "scheduled"
        ? userId !== null && submission.userId === userId
        : true,
    );
    if (submissions.length === 0) return [];

    const userIds = [
      ...new Set(submissions.map((submission) => submission.userId)),
    ];
    const users = await Promise.all(
      userIds.map((id) => ctx.db.get("users", id)),
    );
    const userMap = new Map(
      users
        .filter((u): u is Doc<"users"> => u !== null)
        .map((u) => [u._id.toString(), u]),
    );

    const userBookmarks = userId
      ? await ctx.db
          .query("bookmarks")
          .withIndex("by_user_and_submission", (q) => q.eq("userId", userId))
          .collect()
      : [];
    const bookmarkedSubmissionIds = new Set(
      userBookmarks.map((b) => b.submissionId),
    );

    const roundResultsMap = new Map<string, Doc<"roundResults">>();
    if (round.status === "finished") {
      const results = await ctx.db
        .query("roundResults")
        .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
        .collect();
      for (const result of results) {
        roundResultsMap.set(result.submissionId.toString(), result);
      }
    }

    return Promise.all(
      submissions.map(async (submission) => {
        const user = userMap.get(submission.userId.toString());
        const isAnonymous = round.status === "voting";

        const { albumArtUrl, songFileUrl } = await resolveSubmissionMediaUrls(
          storage,
          submission,
          {
            allowPublic: league.isPublic,
            viewerUserId: userId,
          },
        );

        let points = 0;
        let isPenalized = false;
        if (round.status === "finished") {
          const resultDoc = roundResultsMap.get(submission._id.toString());
          if (resultDoc) {
            points = resultDoc.points;
            isPenalized = resultDoc.penaltyApplied ?? false;
          }
        }

        const submittedByImage =
          isAnonymous ? null : await resolveUserAvatarUrl(storage, user);

        return {
          ...submission,
          submittedBy: isAnonymous ? "Anonymous" : (user?.name ?? "Anonymous"),
          submittedByImage,
          albumArtUrl,
          songFileUrl,
          points,
          isPenalized,
          isBookmarked: bookmarkedSubmissionIds.has(submission._id),
          roundStatus: round.status,
          roundTitle: round.title,
          leagueId: league._id,
          leagueName: league.name,
        };
      }),
    );
  },
});

export const getMySubmissions = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const userSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_user_and_league", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    if (userSubmissions.length === 0) {
      return [];
    }

    const roundIds = [
      ...new Set(userSubmissions.map((submission) => submission.roundId)),
    ];
    const rounds = await Promise.all(
      roundIds.map((roundId) => ctx.db.get("rounds", roundId)),
    );
    const roundMap = new Map(
      rounds
        .filter((round): round is NonNullable<typeof round> => round !== null)
        .map((round) => [round._id.toString(), round]),
    );

    const leagueIds = [
      ...new Set(rounds.filter(Boolean).map((round) => round!.leagueId)),
    ];
    const leagues = await Promise.all(
      leagueIds.map((leagueId) => ctx.db.get("leagues", leagueId)),
    );
    const leagueMap = new Map(
      leagues
        .filter(
          (league): league is NonNullable<typeof league> => league !== null,
        )
        .map((league) => [league._id.toString(), league]),
    );

    const finishedRoundIds = new Set(
      userSubmissions
        .map((submission) => roundMap.get(submission.roundId.toString()))
        .filter(
          (round): round is NonNullable<typeof round> =>
            round?.status === "finished",
        )
        .map((round) => round._id),
    );
    const roundResultsBySubmission = new Map<string, Doc<"roundResults">>();
    if (finishedRoundIds.size > 0) {
      const finishedRoundResults = await Promise.all(
        [...finishedRoundIds].map((roundId) =>
          ctx.db
            .query("roundResults")
            .withIndex("by_round", (q) => q.eq("roundId", roundId))
            .collect(),
        ),
      );
      for (const roundResults of finishedRoundResults) {
        for (const roundResult of roundResults) {
          roundResultsBySubmission.set(
            roundResult.submissionId.toString(),
            roundResult,
          );
        }
      }
    }

    const submissionsWithDetails = await Promise.all(
      userSubmissions.map(async (submission) => {
        const round = roundMap.get(submission.roundId.toString()) ?? null;
        if (!round) return null;

        const league = leagueMap.get(round.leagueId.toString()) ?? null;
        if (!league) return null;

        const { albumArtUrl, songFileUrl } = await resolveSubmissionMediaUrls(
          storage,
          submission,
          {
            allowPublic: league.isPublic,
            viewerUserId: userId,
          },
        );

        let result: { type: string; points: number; penaltyApplied?: boolean };
        if (round.status === "finished") {
          const roundResult =
            roundResultsBySubmission.get(submission._id.toString()) ?? null;
          if (roundResult) {
            const penaltyApplied = roundResult.penaltyApplied ?? false;
            if (roundResult.isWinner) {
              result = {
                type: "winner",
                points: roundResult.points,
                penaltyApplied,
              };
            } else if (roundResult.points > 0) {
              result = {
                type: "positive",
                points: roundResult.points,
                penaltyApplied,
              };
            } else if (roundResult.points < 0) {
              result = {
                type: "negative",
                points: roundResult.points,
                penaltyApplied,
              };
            } else {
              result = {
                type: "neutral",
                points: roundResult.points,
                penaltyApplied,
              };
            }
          } else {
            result = { type: "pending", points: 0, penaltyApplied: false };
          }
        } else {
          result = { type: "pending", points: 0, penaltyApplied: false };
        }

        return {
          ...submission,
          albumArtUrl,
          songFileUrl,
          roundTitle: round.title,
          leagueName: league.name,
          leagueId: league._id,
          status: round.status,
          result,
        };
      }),
    );

    return submissionsWithDetails.filter((s) => s !== null);
  },
});

export const addComment = mutation({
  args: {
    submissionId: v.id("submissions"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be logged in to comment.");
    }

    const commenter = await ctx.db.get("users", userId);
    if (!commenter) {
      throw new Error("User not found.");
    }

    if (args.text.trim().length === 0) {
      throw new Error("Comment cannot be empty.");
    }

    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) {
      throw new Error("Submission not found.");
    }

    const round = await ctx.db.get("rounds", submission.roundId);
    if (!round) {
      throw new Error("Round not found.");
    }

    if (submission.userId !== userId) {
      const commentIsAnonymous = !shouldRevealCommentIdentity({
        isAnonymous: true,
        revealOnRoundFinished: true,
        roundStatus: round.status,
      });

      await ctx.scheduler.runAfter(0, internal.notifications.create, {
        userId: submission.userId,
        type: "new_comment",
        message: `A new ${commentIsAnonymous ? "anonymous " : ""}comment was added to your submission for "${submission.songTitle}".`,
        link: `/leagues/${round.leagueId}/round/${round._id}`,
      });
    }

    await ctx.db.insert("comments", {
      submissionId: args.submissionId,
      userId,
      text: args.text,
      isAnonymous: true,
      revealOnRoundFinished: true,
    });
  },
});

export const getCommentsForSubmission = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) {
      return [];
    }

    const { canView } = await canViewLeague(ctx, submission.leagueId, userId);
    if (!canView) {
      return [];
    }

    const round = await ctx.db.get("rounds", submission.roundId);
    if (!round) {
      return [];
    }

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_submission", (q) =>
        q.eq("submissionId", args.submissionId),
      )
      .order("asc")
      .collect();

    if (comments.length === 0) {
      return [];
    }

    const revealedCommentUserIds = [
      ...new Set(
        comments
          .filter((comment) =>
            shouldRevealCommentIdentity({
              isAnonymous: comment.isAnonymous,
              revealOnRoundFinished: comment.revealOnRoundFinished,
              roundStatus: round.status,
            }),
          )
          .map((comment) => comment.userId),
      ),
    ];

    const userById =
      revealedCommentUserIds.length > 0
        ? new Map(
            (
              await Promise.all(
                revealedCommentUserIds.map((commentUserId) =>
                  ctx.db.get("users", commentUserId),
                ),
              )
            )
              .filter((user): user is NonNullable<typeof user> => user !== null)
              .map((user) => [user._id.toString(), user]),
          )
        : null;

    const voteByUserId =
      round.status === "finished"
        ? new Map(
            (
              await ctx.db
                .query("votes")
                .withIndex("by_submission_and_user", (q) =>
                  q.eq("submissionId", args.submissionId),
                )
                .collect()
            ).map((vote) => [vote.userId.toString(), vote.vote]),
          )
        : null;

    return Promise.all(comments.map(async (comment) => {
      const anonymousIdentity = getAnonymousCommentIdentity(
        submission.roundId.toString(),
        comment.userId.toString(),
      );
      const revealIdentity = shouldRevealCommentIdentity({
        isAnonymous: comment.isAnonymous,
        revealOnRoundFinished: comment.revealOnRoundFinished,
        roundStatus: round.status,
      });
      const user = userById?.get(comment.userId.toString());

      return {
        _id: comment._id,
        _creationTime: comment._creationTime,
        submissionId: comment.submissionId,
        text: comment.text,
        authorImage:
          revealIdentity && user
            ? await resolveUserAvatarUrl(storage, user)
            : null,
        authorName: revealIdentity
          ? (user?.name ?? "Anonymous")
          : anonymousIdentity.displayName,
        avatarSeed: revealIdentity
          ? comment.userId.toString()
          : anonymousIdentity.avatarSeed,
        authorVote:
          revealIdentity && round.status === "finished"
            ? voteByUserId?.get(comment.userId.toString()) ?? undefined
            : undefined,
      };
    }));
  },
});

export const storeWaveform = mutation({
  args: {
    submissionId: v.id("submissions"),
    waveformJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated.");
    }

    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }

    const { canView } = await canViewLeague(ctx, submission.leagueId, userId);
    if (!canView) {
      throw new Error("Not authorized to access this submission.");
    }

    await ctx.runMutation(storeWaveformInternalRef, args);
  },
});

export const storeWaveformInternal = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    waveformJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.waveformJson) {
      return;
    }
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }
    if (submission.waveform) {
      // Keep a valid existing waveform, but allow replacing malformed legacy seed values.
      try {
        const parsed = JSON.parse(submission.waveform);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return;
        }
      } catch {
        // Fall through and replace malformed JSON.
      }
    }
    await ctx.db.patch("submissions", args.submissionId, {
      waveform: args.waveformJson,
    });
  },
});

export const getWaveform = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) {
      return null;
    }

    const { canView } = await canViewLeague(ctx, submission.leagueId, userId);
    if (!canView) {
      return null;
    }

    return { waveform: submission.waveform };
  },
});

export const getSubmissionById = internalQuery({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    return await ctx.db.get("submissions", args.submissionId);
  },
});

export const getSubmissionMediaAccessState = internalQuery({
  args: {
    submissionId: v.id("submissions"),
    viewerUserId: v.union(v.id("users"), v.null()),
  },
  returns: v.union(
    v.null(),
    v.object({
      canView: v.boolean(),
      allowPublic: v.boolean(),
      submissionType: v.union(v.literal("file"), v.literal("youtube")),
      songFileKey: v.union(v.string(), v.null()),
      albumArtKey: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) {
      return null;
    }

    const { league, canView } = await canViewLeague(
      ctx,
      submission.leagueId,
      args.viewerUserId,
    );

    return {
      canView,
      allowPublic: league?.isPublic ?? false,
      submissionType: submission.submissionType,
      songFileKey: submission.songFileKey ?? null,
      albumArtKey: submission.albumArtKey ?? null,
    };
  },
});

export const listPendingSubmissionAudioCandidates = internalQuery({
  args: {
    status: v.union(
      v.literal("queued"),
      v.literal("converting"),
      v.literal("failed"),
    ),
    limit: v.number(),
    staleBefore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_file_processing_status", (q) =>
        q.eq("fileProcessingStatus", args.status),
      )
      .take(Math.max(args.limit * 2, args.limit));

    return submissions
      .filter((submission) => {
        if (
          submission.submissionType !== "file" ||
          !submission.originalSongFileKey
        ) {
          return false;
        }
        if (typeof args.staleBefore === "number") {
          return (submission.fileProcessingStartedAt ?? 0) <= args.staleBefore;
        }
        return true;
      })
      .slice(0, args.limit)
      .map((submission) => ({
        submissionId: submission._id,
        originalSongFileKey: submission.originalSongFileKey!,
      }));
  },
});

export const startQueuedSubmissionAudioProcessing = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    expectedSourceKey: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (
      !submission ||
      submission.submissionType !== "file" ||
      submission.originalSongFileKey !== args.expectedSourceKey
    ) {
      return false;
    }

    const status = getSubmissionFileProcessingStatus(submission);
    if (
      status === "converting" &&
      (submission.fileProcessingStartedAt ?? 0) >
        Date.now() - SUBMISSION_AUDIO_PROCESSING_STALE_MS
    ) {
      return false;
    }
    if (status === "ready" && !submission.originalSongFileKey) {
      return false;
    }

    const oldDoc = submission;
    await ctx.db.patch("submissions", args.submissionId, {
      fileProcessingStatus: "converting",
      fileProcessingError: undefined,
      fileProcessingStartedAt: Date.now(),
    });
    const newDoc = await ctx.db.get("submissions", args.submissionId);
    if (newDoc) {
      await submissionsByUser.replace(ctx, oldDoc, newDoc);
    }
    return true;
  },
});

export const requeueStaleSubmissionAudioProcessing = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    expectedSourceKey: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (
      !submission ||
      submission.submissionType !== "file" ||
      submission.fileProcessingStatus !== "converting" ||
      submission.originalSongFileKey !== args.expectedSourceKey
    ) {
      return false;
    }

    const oldDoc = submission;
    await ctx.db.patch("submissions", args.submissionId, {
      fileProcessingStatus: "queued",
      fileProcessingError: undefined,
      fileProcessingQueuedAt: Date.now(),
      fileProcessingStartedAt: undefined,
    });
    const newDoc = await ctx.db.get("submissions", args.submissionId);
    if (newDoc) {
      await submissionsByUser.replace(ctx, oldDoc, newDoc);
    }
    return true;
  },
});

export const completeQueuedSubmissionAudioProcessing = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    expectedSourceKey: v.string(),
    convertedSongFileKey: v.string(),
  },
  returns: v.object({
    applied: v.boolean(),
    sourceKeyToDelete: v.union(v.string(), v.null()),
    previousSongFileKeyToDelete: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (
      !submission ||
      submission.submissionType !== "file" ||
      submission.originalSongFileKey !== args.expectedSourceKey
    ) {
      return {
        applied: false,
        sourceKeyToDelete: null,
        previousSongFileKeyToDelete: null,
      };
    }

    const oldDoc = submission;
    const previousSongFileKeyToDelete =
      submission.songFileKey &&
      submission.songFileKey !== args.convertedSongFileKey
        ? submission.songFileKey
        : null;

    await ctx.db.patch("submissions", args.submissionId, {
      songFileKey: args.convertedSongFileKey,
      originalSongFileKey: undefined,
      fileProcessingStatus: "ready",
      fileProcessingError: undefined,
      fileProcessingCompletedAt: Date.now(),
    });
    const newDoc = await ctx.db.get("submissions", args.submissionId);
    if (newDoc) {
      await submissionsByUser.replace(ctx, oldDoc, newDoc);
      await maybeAutoStartVotingAfterSubmissionCompletion(
        ctx,
        newDoc.roundId,
        newDoc.userId,
      );
    }

    return {
      applied: true,
      sourceKeyToDelete: args.expectedSourceKey,
      previousSongFileKeyToDelete,
    };
  },
});

export const failQueuedSubmissionAudioProcessing = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    expectedSourceKey: v.string(),
    errorMessage: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (
      !submission ||
      submission.submissionType !== "file" ||
      submission.originalSongFileKey !== args.expectedSourceKey
    ) {
      return false;
    }

    const oldDoc = submission;
    await ctx.db.patch("submissions", args.submissionId, {
      fileProcessingStatus: "failed",
      fileProcessingError: args.errorMessage,
      fileProcessingCompletedAt: Date.now(),
    });
    const newDoc = await ctx.db.get("submissions", args.submissionId);
    if (newDoc) {
      await submissionsByUser.replace(ctx, oldDoc, newDoc);
    }
    return true;
  },
});

export const processQueuedSubmissionAudio = internalAction({
  args: {
    submissionId: v.id("submissions"),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.runQuery(internal.submissions.getSubmissionById, {
      submissionId: args.submissionId,
    });
    if (
      !submission ||
      submission.submissionType !== "file" ||
      !submission.originalSongFileKey
    ) {
      return { processed: false };
    }

    const sourceKey = submission.originalSongFileKey;
    const didStart = await ctx.runMutation(
      internal.submissions.startQueuedSubmissionAudioProcessing,
      {
        submissionId: args.submissionId,
        expectedSourceKey: sourceKey,
      },
    );
    if (!didStart) {
      return { processed: false };
    }

    const siteUrl = firstNonEmpty(process.env.SITE_URL, "http://localhost:3000");
    if (!siteUrl) {
      throw new Error("SITE_URL is required for queued submission processing.");
    }

    let convertedSongFileKey: string | null = null;

    try {
      const payload = await processSubmissionAudioFile(siteUrl, sourceKey);

      convertedSongFileKey = payload.key;
      const completionResult = await ctx.runMutation(
        internal.submissions.completeQueuedSubmissionAudioProcessing,
        {
          submissionId: args.submissionId,
          expectedSourceKey: sourceKey,
          convertedSongFileKey,
        },
      );

      const keysToDelete = [
        completionResult.sourceKeyToDelete,
        completionResult.previousSongFileKeyToDelete,
      ].filter((key): key is string => Boolean(key));

      if (!completionResult.applied) {
        if (convertedSongFileKey) {
          try {
            await storage.deleteObject(convertedSongFileKey);
          } catch (error) {
            console.error(
              `Failed to delete orphaned converted submission file "${convertedSongFileKey}"`,
              error,
            );
          }
        }
        return { processed: false };
      }

      if (payload.waveformJson) {
        try {
          await ctx.runMutation(storeWaveformInternalRef, {
            submissionId: args.submissionId,
            waveformJson: payload.waveformJson,
          });
        } catch (error) {
          console.error(
            `Failed to store generated waveform for submission "${args.submissionId}"`,
            error,
          );
        }
      }

      for (const key of keysToDelete) {
        try {
          await storage.deleteObject(key);
        } catch (error) {
          console.error(`Failed to delete processed submission file "${key}"`, error);
        }
      }

      return { processed: true, convertedSongFileKey };
    } catch (error) {
      if (convertedSongFileKey) {
        try {
          await storage.deleteObject(convertedSongFileKey);
        } catch (deleteError) {
          console.error(
            `Failed to delete failed converted submission file "${convertedSongFileKey}"`,
            deleteError,
          );
        }
      }
      const message =
        error instanceof Error ? error.message : "Unknown conversion failure.";
      await ctx.runMutation(internal.submissions.failQueuedSubmissionAudioProcessing, {
        submissionId: args.submissionId,
        expectedSourceKey: sourceKey,
        errorMessage: message,
      });
      return { processed: false, error: message };
    }
  },
});

export const processPendingSubmissionAudioQueue = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<PendingSubmissionAudioQueueRunResult> => {
    const limit = Math.max(
      1,
      Math.min(
        args.limit ?? DEFAULT_PENDING_AUDIO_PROCESSING_BATCH_SIZE,
        MAX_PENDING_AUDIO_PROCESSING_BATCH_SIZE,
      ),
    );

    const staleCandidates: PendingSubmissionAudioCandidate[] = await ctx.runQuery(
      internal.submissions.listPendingSubmissionAudioCandidates,
      {
        status: "converting",
        limit,
        staleBefore: Date.now() - SUBMISSION_AUDIO_PROCESSING_STALE_MS,
      },
    );
    for (const candidate of staleCandidates) {
      await ctx.runMutation(
        internal.submissions.requeueStaleSubmissionAudioProcessing,
        {
          submissionId: candidate.submissionId,
          expectedSourceKey: candidate.originalSongFileKey,
        },
      );
    }

    const queuedCandidates: PendingSubmissionAudioCandidate[] =
      await ctx.runQuery(
      internal.submissions.listPendingSubmissionAudioCandidates,
      {
        status: "queued",
        limit,
      },
    );

    for (const candidate of queuedCandidates) {
      try {
        await ctx.runAction(internal.submissions.processQueuedSubmissionAudio, {
          submissionId: candidate.submissionId,
        });
      } catch (error) {
        console.error(
          `Failed to process queued submission audio for ${candidate.submissionId}:`,
          error,
        );
      }
    }

    return {
      requeued: staleCandidates.length,
      attempted: queuedCandidates.length,
    };
  },
});

export const getPresignedSongUrl = action({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args): Promise<string | null> => {
    const userId = await getAuthUserId(ctx);
    const mediaAccessState = await ctx.runQuery(
      getSubmissionMediaAccessStateRef,
      {
        submissionId: args.submissionId,
        viewerUserId: userId,
      },
    );
    if (
      !mediaAccessState ||
      !mediaAccessState.canView ||
      mediaAccessState.submissionType !== "file" ||
      !mediaAccessState.songFileKey
    ) {
      console.error(
        "Could not generate URL: Submission is not a file or key is missing.",
      );
      return null;
    }

    return await buildSubmissionMediaUrl({
      submissionId: args.submissionId,
      assetKind: "audio",
      storageKey: mediaAccessState.songFileKey,
      scope: buildMediaScope(mediaAccessState.allowPublic, userId),
    });
  },
});

export const getPresignedAlbumArtUrl = action({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args): Promise<string | null> => {
    const userId = await getAuthUserId(ctx);
    const mediaAccessState = await ctx.runQuery(
      getSubmissionMediaAccessStateRef,
      {
        submissionId: args.submissionId,
        viewerUserId: userId,
      },
    );
    if (!mediaAccessState || !mediaAccessState.canView || !mediaAccessState.albumArtKey) {
      console.error(
        "Could not generate album art URL: albumArtKey is missing.",
      );
      return null;
    }

    return await buildSubmissionMediaUrl({
      submissionId: args.submissionId,
      assetKind: "art",
      storageKey: mediaAccessState.albumArtKey,
      scope: buildMediaScope(mediaAccessState.allowPublic, userId),
    });
  },
});

export const checkForPotentialDuplicates = query({
  args: {
    leagueId: v.id("leagues"),
    songTitle: v.string(),
    artist: v.string(),
    currentSubmissionId: v.optional(v.id("submissions")),
  },
  handler: async (ctx, args) => {
    const normalizedTitle = normalizeSubmissionSongTitle(args.songTitle);
    const normalizedArtist = normalizeSubmissionArtist(args.artist);
    const titleQuery = args.songTitle.trim();
    const artistQuery = args.artist.trim();

    const [exactTitleMatches, exactArtistMatches] = await Promise.all([
      normalizedTitle
        ? ctx.db
            .query("submissions")
            .withIndex("by_league_and_normalized_song_title", (q) =>
              q
                .eq("leagueId", args.leagueId)
                .eq("normalizedSongTitle", normalizedTitle),
            )
            .take(EXACT_DUPLICATE_MATCH_LIMIT)
        : Promise.resolve([]),
      normalizedArtist
        ? ctx.db
            .query("submissions")
            .withIndex("by_league_and_normalized_artist", (q) =>
              q
                .eq("leagueId", args.leagueId)
                .eq("normalizedArtist", normalizedArtist),
            )
            .take(EXACT_DUPLICATE_MATCH_LIMIT)
        : Promise.resolve([]),
    ]);

    const [fuzzyTitleMatches, fuzzyArtistMatches] = await Promise.all([
      titleQuery
        ? ctx.db
            .query("submissions")
            .withSearchIndex("by_text", (q) =>
              q.search("searchText", titleQuery).eq("leagueId", args.leagueId),
            )
            .take(FUZZY_DUPLICATE_MATCH_LIMIT)
        : Promise.resolve([]),
      artistQuery
        ? ctx.db
            .query("submissions")
            .withSearchIndex("by_text", (q) =>
              q.search("searchText", artistQuery).eq("leagueId", args.leagueId),
            )
            .take(FUZZY_DUPLICATE_MATCH_LIMIT)
        : Promise.resolve([]),
    ]);

    const isCurrentSubmission = (submissionId: Id<"submissions">) =>
      !!args.currentSubmissionId && submissionId === args.currentSubmissionId;

    const combinedCandidates = new Map<string, Doc<"submissions">>();
    for (const submission of [
      ...exactTitleMatches,
      ...exactArtistMatches,
      ...fuzzyTitleMatches,
      ...fuzzyArtistMatches,
    ]) {
      if (isCurrentSubmission(submission._id)) {
        continue;
      }
      combinedCandidates.set(submission._id.toString(), submission);
    }

    const candidates = [...combinedCandidates.values()].sort(
      (a, b) => b._creationTime - a._creationTime,
    );

    if (candidates.length === 0) {
      return { songExists: null, artistExists: null };
    }

    const roundIds = [...new Set(candidates.map((s) => s.roundId))];
    const rounds = await Promise.all(
      roundIds.map((id) => ctx.db.get("rounds", id)),
    );
    const roundTitleById = new Map(
      rounds
        .filter((round): round is NonNullable<typeof round> => round !== null)
        .map((round) => [round._id.toString(), round.title]),
    );

    const asMatch = (submission: Doc<"submissions">) => ({
      title: submission.songTitle,
      artist: submission.artist,
      roundTitle:
        roundTitleById.get(submission.roundId.toString()) ?? "a previous round",
    });

    const songExists = candidates.find((submission) => {
      const dbNormalizedTitle = submission.normalizedSongTitle;
      return (
        !!normalizedTitle &&
        (dbNormalizedTitle.includes(normalizedTitle) ||
          normalizedTitle.includes(dbNormalizedTitle))
      );
    });

    const artistExists = candidates.find((submission) => {
      const dbNormalizedArtist = submission.normalizedArtist;
      return !!normalizedArtist && dbNormalizedArtist === normalizedArtist;
    });

    return {
      songExists: songExists ? asMatch(songExists) : null,
      artistExists: artistExists ? asMatch(artistExists) : null,
    };
  },
});

export const markAsTrollSubmission = mutation({
  args: {
    submissionId: v.id("submissions"),
    isTrollSubmission: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the submission
    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }

    // Get the league to check if user is owner or manager
    const league = await ctx.db.get("leagues", submission.leagueId);
    if (!league) {
      throw new Error("League not found");
    }

    // Check if user has permission (league creator, manager, or global admin)
    const user = await ctx.db.get("users", userId);
    const isOwner = league.creatorId === userId;
    const isManager = league.managers?.includes(userId) ?? false;
    const isGlobalAdmin = user?.isGlobalAdmin ?? false;

    if (!isOwner && !isManager && !isGlobalAdmin) {
      throw new Error("You don't have permission to mark troll submissions");
    }

    // If marking as troll submission for the first time
    if (args.isTrollSubmission && !submission.isTrollSubmission) {
      // Update submission flag
      await ctx.db.patch("submissions", args.submissionId, {
        isTrollSubmission: true,
        markedAsTrollBy: userId,
        markedAsTrollAt: Date.now(),
      });

      await recalculateAndPatchTrollMembershipStatus(ctx, submission);
      await updateSubmissionTrollPenalty(ctx, args.submissionId, true);

      return {
        success: true,
        message: "Submission marked as troll submission",
      };
    }
    // If unmarking as troll submission
    else if (!args.isTrollSubmission && submission.isTrollSubmission) {
      await ctx.db.patch("submissions", args.submissionId, {
        isTrollSubmission: false,
        markedAsTrollBy: undefined,
        markedAsTrollAt: undefined,
      });

      await updateSubmissionTrollPenalty(ctx, args.submissionId, false);
      await recalculateAndPatchTrollMembershipStatus(ctx, submission);

      return {
        success: true,
        message: "Submission unmarked as troll submission",
      };
    }

    return { success: true, message: "No changes made" };
  },
});
