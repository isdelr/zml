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
    });
  },
});

export const getForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
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
          // Fetch the pre-calculated result
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
            // Fallback for rounds finished before this logic was deployed
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