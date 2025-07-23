import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { R2 } from "@convex-dev/r2";
import { components, internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { SpotifyApi } from "@spotify/web-api-ts-sdk";

const r2 = new R2(components.r2);

function getYouTubeVideoId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export const getSongMetadataFromLink = action({
  args: { link: v.string() },
  handler: async (ctx, args) => {
    if (args.link.includes("spotify")) {
      const spotifyApi = SpotifyApi.withClientCredentials(
        process.env.SPOTIFY_CLIENT_ID!,
        process.env.SPOTIFY_CLIENT_SECRET!,
      );
      const trackId = args.link.split("/track/")[1].split("?")[0];
      const track = await spotifyApi.tracks.get(trackId);
      return {
        songTitle: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        albumArtUrl: track.album.images[0].url,
        duration: Math.round(track.duration_ms / 1000),
        submissionType: "spotify" as const,
      };
    } else if (
      args.link.includes("youtube") ||
      args.link.includes("youtu.be")
    ) {
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
        albumArtUrl: snippet.thumbnails.high.url,
        submissionType: "youtube" as const,
        duration: contentDetails.duration ? parseISO8601Duration(contentDetails.duration) : 0,
      };
    }
    throw new Error(
      "Invalid link provided. Please use a Spotify or YouTube link.",
    );
  },
});

export const submitSong = mutation({
  args: {
    roundId: v.id("rounds"),
    submissionType: v.union(
      v.literal("file"),
      v.literal("spotify"),
      v.literal("youtube"),
    ),
    songTitle: v.string(),
    artist: v.string(),
    comment: v.optional(v.string()),
    albumArtKey: v.optional(v.string()),
    songFileKey: v.optional(v.string()),
    songLink: v.optional(v.string()),
    albumArtUrlValue: v.optional(v.string()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const round = await ctx.db.get(args.roundId);
    if (!round) throw new Error("Round not found.");
    if (round.status !== "submissions")
      throw new Error("Submissions are not open.");

    const existing = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", args.roundId).eq("userId", userId),
      )
      .first();
    if (existing) throw new Error("You have already submitted a song.");

    const baseSubmissionData = {
      leagueId: round.leagueId,
      roundId: args.roundId,
      userId,
      songTitle: args.songTitle,
      artist: args.artist,
      comment: args.comment,
      duration: args.duration,
    };

    if (args.submissionType === "file") {
      if (!args.albumArtKey || !args.songFileKey) {
        throw new Error("File keys are required for manual submission.");
      }
      await ctx.db.insert("submissions", {
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
      await ctx.db.insert("submissions", {
        ...baseSubmissionData,
        submissionType: args.submissionType,
        songLink: args.songLink,
        albumArtUrlValue: args.albumArtUrlValue,
      });
    }
  },
});

export const editSong = mutation({
  args: {
    submissionId: v.id("submissions"),
    songTitle: v.string(),
    artist: v.string(),
    submissionType: v.union(
      v.literal("file"),
      v.literal("spotify"),
      v.literal("youtube"),
    ),
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
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("Submission not found.");
    if (submission.userId !== userId) {
      throw new Error("You can only edit your own submissions.");
    }
    const round = await ctx.db.get(submission.roundId);
    if (!round) throw new Error("Round not found.");
    if (round.status !== "submissions") {
      throw new Error(
        "You can only edit submissions during the submission phase.",
      );
    }

    const { submissionId, ...rest } = args;

    const updates: Partial<Doc<"submissions">> = {};

    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) {
        (updates as any)[key] = value;
      }
    }

    if (args.albumArtKey === null) updates.albumArtKey = undefined;
    if (args.songFileKey === null) updates.songFileKey = undefined;
    if (args.songLink === null) updates.songLink = undefined;
    if (args.albumArtUrlValue === null) updates.albumArtUrlValue = undefined;

    if (args.submissionType === "file") {
      updates.songLink = undefined;
      updates.albumArtUrlValue = undefined;
    } else {
      updates.albumArtKey = undefined;
      updates.songFileKey = undefined;
    }

    await ctx.db.patch(submissionId, updates);

    return "Submission updated successfully.";
  },
});

export const getForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const round = await ctx.db.get(args.roundId);
    if (!round) return [];

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .collect();

    const allVotesForRound = await ctx.db
      .query("votes")
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .collect();
    const userBookmarks = userId
      ? await ctx.db
          .query("bookmarks")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect()
      : [];
    const bookmarkedSubmissionIds = new Set(
      userBookmarks.map((b) => b.submissionId),
    );

    return Promise.all(
      submissions.map(async (submission) => {
        const user = await ctx.db.get(submission.userId);

        let albumArtUrl: string | null = null;
        let songFileUrl: string | null = null;

        if (submission.submissionType === "file") {
          [albumArtUrl, songFileUrl] = await Promise.all([
            submission.albumArtKey
              ? r2.getUrl(submission.albumArtKey)
              : Promise.resolve(null),
            submission.songFileKey
              ? r2.getUrl(submission.songFileKey)
              : Promise.resolve(null),
          ]);
        } else {
          albumArtUrl = submission.albumArtUrlValue ?? null;
          songFileUrl = submission.songLink ?? null;
        }

        let points = 0;
        let isPenalized = false;

        if (round.status === "finished") {
          const resultDoc = await ctx.db
            .query("roundResults")
            .withIndex("by_submission", (q) =>
              q.eq("submissionId", submission._id),
            )
            .first();
          if (resultDoc) {
            points = resultDoc.points;
            isPenalized = resultDoc.penaltyApplied ?? false;
          }
        } else {
          points = allVotesForRound
            .filter((v) => v.submissionId === submission._id)
            .reduce((acc, vote) => acc + vote.vote, 0);
        }

        let userUpvotes = 0;
        let userDownvotes = 0;
        if (userId) {
          const userVotesOnSubmission = allVotesForRound.filter(
            (v) => v.userId === userId && v.submissionId === submission._id,
          );
          userUpvotes = userVotesOnSubmission.filter((v) => v.vote > 0).length;
          userDownvotes = userVotesOnSubmission.filter(
            (v) => v.vote < 0,
          ).length;
        }
        return {
          ...submission,
          submittedBy: user?.name ?? "Anonymous",
          submittedByImage: user?.image ?? null,
          albumArtUrl: albumArtUrl!,
          songFileUrl: songFileUrl,
          points,
          userUpvotes,
          userDownvotes,
          isPenalized,
          isBookmarked: bookmarkedSubmissionIds.has(submission._id),
          roundStatus: round.status,
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
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const submissionsWithDetails = await Promise.all(
      userSubmissions.map(async (submission) => {
        const round = await ctx.db.get(submission.roundId);
        if (!round) return null;
        const league = await ctx.db.get(round.leagueId);
        if (!league) return null;

        let albumArtUrl: string | null = null;
        let songFileUrl: string | null = null;

        if (submission.submissionType === "file") {
          [albumArtUrl, songFileUrl] = await Promise.all([
            submission.albumArtKey
              ? r2.getUrl(submission.albumArtKey)
              : Promise.resolve(null),
            submission.songFileKey
              ? r2.getUrl(submission.songFileKey)
              : Promise.resolve(null),
          ]);
        } else {
          albumArtUrl = submission.albumArtUrlValue ?? null;
          songFileUrl = submission.songLink ?? null;
        }

        let result: {
          type: string;
          points: number;
          penaltyApplied?: boolean;
        };

        if (round.status === "finished") {
          const roundResult = await ctx.db
            .query("roundResults")
            .withIndex("by_submission", (q) =>
              q.eq("submissionId", submission._id),
            )
            .first();

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
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found.");
    }

    if (args.text.trim().length === 0) {
      throw new Error("Comment cannot be empty.");
    }

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Submission not found.");
    }

    const round = await ctx.db.get(submission.roundId);
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
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_submission", (q) =>
        q.eq("submissionId", args.submissionId),
      )
      .order("asc")
      .collect();

    return Promise.all(
      comments.map(async (comment) => {
        const user = await ctx.db.get(comment.userId);
        return {
          ...comment,
          authorName: user?.name ?? "Anonymous",
          authorImage: user?.image ?? null,
        };
      }),
    );
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
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }

    if (submission.waveform) {
      return;
    }

    await ctx.db.patch(args.submissionId, { waveform: args.waveformJson });
  },
});

export const getWaveform = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    return submission ? { waveform: submission.waveform } : null;
  },
});