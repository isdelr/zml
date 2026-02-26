// File: convex/submissions.ts
// convex/submissions.ts
import { v } from "convex/values";
import {
  mutation,
  query,
  action,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { B2Storage } from "./b2Storage";
import { internal } from "./_generated/api";
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

const storage = new B2Storage();
const TROLL_SUBMISSION_BAN_THRESHOLD = 2;
const TROLL_SUBMISSION_POINTS_PENALTY = 10;
const EXACT_DUPLICATE_MATCH_LIMIT = 50;
const FUZZY_DUPLICATE_MATCH_LIMIT = 30;

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
    if (round.status !== "submissions")
      throw new Error("Submissions are not open.");

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

    // For album/multi rounds, count unique collections instead of individual tracks
    let submissionCount = existingSubmissions.length;
    if (round.submissionMode === "album" || round.submissionMode === "multi") {
      const uniqueCollections = new Set(
        existingSubmissions
          .filter((s) => s.collectionId)
          .map((s) => s.collectionId),
      );
      submissionCount = uniqueCollections.size;

      // If submitting a new collection, check if user would exceed limit
      if (args.collectionId && !uniqueCollections.has(args.collectionId)) {
        if (submissionCount >= submissionsPerUser) {
          throw new Error(
            `You have already submitted the maximum of ${submissionsPerUser} album(s).`,
          );
        }
      }
    } else {
      // For single song rounds, count individual submissions
      if (existingSubmissions.length >= submissionsPerUser) {
        throw new Error(
          `You have already submitted the maximum of ${submissionsPerUser} song(s).`,
        );
      }
    }

    const baseSubmissionData = {
      leagueId: round.leagueId,
      roundId: args.roundId,
      userId,
      songTitle: args.songTitle,
      artist: args.artist,
      comment: args.comment,
      duration: args.duration,
      searchText: buildSubmissionSearchText(args.songTitle, args.artist),
      normalizedSongTitle: normalizeSubmissionSongTitle(args.songTitle),
      normalizedArtist: normalizeSubmissionArtist(args.artist),
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
      submissionId = await ctx.db.insert("submissions", {
        ...baseSubmissionData,
        submissionType: "file",
        albumArtKey: args.albumArtKey,
        songFileKey: args.songFileKey,
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
      });
    }

    await submissionCounter.inc(ctx, args.roundId);
    const submissionDoc = await ctx.db.get("submissions", submissionId);
    await submissionsByUser.insert(ctx, submissionDoc!);
  },
});

export const editSong = mutation({
  args: {
    submissionId: v.id("submissions"),
    songTitle: v.string(),
    artist: v.string(),
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
    if (round.status !== "submissions") {
      throw new Error(
        "You can only edit submissions during the submission phase.",
      );
    }

    const oldDoc = submission;
    const { submissionId } = args;
    const previousAlbumArtKey = submission.albumArtKey ?? null;
    const previousSongFileKey = submission.songFileKey ?? null;
    const previousSongLink = submission.songLink ?? null;

    let nextAlbumArtKey: string | null = previousAlbumArtKey;
    if (args.albumArtKey !== undefined) {
      nextAlbumArtKey = args.albumArtKey;
    }

    let nextSongFileKey: string | null = previousSongFileKey;
    if (args.songFileKey !== undefined) {
      nextSongFileKey = args.songFileKey;
    }

    let nextSongLink: string | null = previousSongLink;
    if (args.songLink !== undefined) {
      nextSongLink = args.songLink;
    }

    const updates: Partial<Doc<"submissions">> = {
      songTitle: args.songTitle,
      artist: args.artist,
      submissionType: args.submissionType,
      comment: args.comment,
      duration: args.duration,
    };

    if (args.albumArtKey !== undefined) {
      updates.albumArtKey = args.albumArtKey ?? undefined;
    }
    if (args.songFileKey !== undefined) {
      updates.songFileKey = args.songFileKey ?? undefined;
    }
    if (args.songLink !== undefined) {
      updates.songLink = args.songLink ?? undefined;
    }
    if (args.albumArtUrlValue !== undefined) {
      updates.albumArtUrlValue = args.albumArtUrlValue ?? undefined;
    }

    const newTitle = args.songTitle ?? submission.songTitle;
    const newArtist = args.artist ?? submission.artist;
    updates.searchText = buildSubmissionSearchText(newTitle, newArtist);
    updates.normalizedSongTitle = normalizeSubmissionSongTitle(newTitle);
    updates.normalizedArtist = normalizeSubmissionArtist(newArtist);

    if (args.submissionType === "file") {
      updates.songLink = undefined;
      updates.albumArtUrlValue = undefined;
      nextSongLink = null;
    } else {
      updates.albumArtKey = undefined;
      updates.songFileKey = undefined;
      nextAlbumArtKey = null;
      nextSongFileKey = null;
    }

    const shouldInvalidateLyrics =
      args.songTitle !== submission.songTitle ||
      args.artist !== submission.artist ||
      args.submissionType !== submission.submissionType ||
      nextSongLink !== previousSongLink;

    if (shouldInvalidateLyrics) {
      updates.lyrics = undefined;
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
    for (const key of keysToDelete) {
      try {
        await storage.deleteObject(key);
      } catch (error) {
        console.error(`Failed to delete stale submission file "${key}"`, error);
      }
    }

    return "Submission updated successfully.";
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

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
      .collect();
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

    const user = await ctx.db.get("users", userId);
    if (!user) {
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
      await ctx.scheduler.runAfter(0, internal.notifications.create, {
        userId: submission.userId,
        type: "new_comment",
        message: `${user.name} commented on your submission for "${submission.songTitle}".`,
        link: `/leagues/${round.leagueId}/round/${round._id}`,
        triggeringUserId: userId,
      });
    }

    await ctx.db.insert("comments", {
      submissionId: args.submissionId,
      userId,
      text: args.text,
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

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_submission", (q) =>
        q.eq("submissionId", args.submissionId),
      )
      .order("asc")
      .collect();

    const userIds = [...new Set(comments.map((comment) => comment.userId))];
    const users = await Promise.all(
      userIds.map((userId) => ctx.db.get("users", userId)),
    );
    const userById = new Map(
      users
        .filter((user): user is NonNullable<typeof user> => user !== null)
        .map((user) => [user._id.toString(), user]),
    );

    return Promise.all(comments.map(async (comment) => {
      const user = userById.get(comment.userId.toString());
      const authorImage = await resolveUserAvatarUrl(storage, user);
      return {
        ...comment,
        authorName: user?.name ?? "Anonymous",
        authorImage,
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
    const submission = await ctx.db.get("submissions", args.submissionId);
    return submission ? { waveform: submission.waveform } : null;
  },
});

export const getSubmissionById = internalQuery({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    return await ctx.db.get("submissions", args.submissionId);
  },
});

export const getPresignedSongUrl = action({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args): Promise<string | null> => {
    const submission: Doc<"submissions"> | null = await ctx.runQuery(
      internal.submissions.getSubmissionById,
      {
        submissionId: args.submissionId,
      },
    );
    if (
      !submission ||
      submission.submissionType !== "file" ||
      !submission.songFileKey
    ) {
      console.error(
        "Could not generate URL: Submission is not a file or key is missing.",
      );
      return null;
    }
    return await storage.getUrl(submission.songFileKey);
  },
});

export const getPresignedAlbumArtUrl = action({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args): Promise<string | null> => {
    const submission: Doc<"submissions"> | null = await ctx.runQuery(
      internal.submissions.getSubmissionById,
      {
        submissionId: args.submissionId,
      },
    );
    if (!submission || !submission.albumArtKey) {
      console.error(
        "Could not generate album art URL: albumArtKey is missing.",
      );
      return null;
    }
    return await storage.getUrl(submission.albumArtKey);
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
