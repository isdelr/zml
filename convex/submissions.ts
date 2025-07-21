import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";

const r2 = new R2(components.r2);

export const submitSong = mutation({
  args: {
    roundId: v.id("rounds"),
    songTitle: v.string(),
    artist: v.string(),
    albumArtKey: v.string(),
    songFileKey: v.string(),
    comment: v.optional(v.string()),
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

    await ctx.db.insert("submissions", {
      leagueId: round.leagueId,
      roundId: args.roundId,
      userId,
      songTitle: args.songTitle,
      artist: args.artist,
      albumArtKey: args.albumArtKey,
      songFileKey: args.songFileKey,
      comment: args.comment,
    });
  },
});

export const editSong = mutation({
  args: {
    submissionId: v.id("submissions"),
    songTitle: v.string(),
    artist: v.string(),
    comment: v.optional(v.string()),
    albumArtKey: v.optional(v.string()),
    songFileKey: v.optional(v.string()),
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
    const updates: Partial<typeof submission> = {
      songTitle: rest.songTitle,
      artist: rest.artist,
      comment: rest.comment,
    };

    if (rest.albumArtKey) {
      updates.albumArtKey = rest.albumArtKey;
    }
    if (rest.songFileKey) {
      updates.songFileKey = rest.songFileKey;
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
        const [albumArtUrl, songFileUrl] = await Promise.all([
          submission.albumArtKey
            ? r2.getUrl(submission.albumArtKey)
            : Promise.resolve(null),
          submission.songFileKey
            ? r2.getUrl(submission.songFileKey)
            : Promise.resolve(null),
        ]);
        const points = allVotesForRound
          .filter((v) => v.submissionId === submission._id)
          .reduce((acc, vote) => acc + vote.vote, 0);
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
          albumArtUrl: albumArtUrl,
          songFileUrl: songFileUrl,
          points,
          userUpvotes,
          userDownvotes,
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

        const [albumArtUrl, songFileUrl] = await Promise.all([
          r2.getUrl(submission.albumArtKey),
          r2.getUrl(submission.songFileKey),
        ]);

        let result: { type: string; points: number };

        if (round.status === "finished") {
          const roundResult = await ctx.db
            .query("roundResults")
            .withIndex("by_submission", (q) =>
              q.eq("submissionId", submission._id),
            )
            .first();

          if (roundResult) {
            if (roundResult.isWinner) {
              result = { type: "winner", points: roundResult.points };
            } else if (roundResult.points > 0) {
              result = { type: "positive", points: roundResult.points };
            } else if (roundResult.points < 0) {
              result = { type: "negative", points: roundResult.points };
            } else {
              result = { type: "neutral", points: roundResult.points };
            }
          } else {
            result = { type: "pending", points: 0 };
          }
        } else {
          result = { type: "pending", points: 0 };
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
    if (args.text.trim().length === 0) {
      throw new Error("Comment cannot be empty.");
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
      .withIndex("by_submission", (q) => q.eq("submissionId", args.submissionId))
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