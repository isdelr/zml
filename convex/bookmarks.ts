import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { B2Storage } from "./b2Storage";
import { resolveSubmissionMediaUrls } from "../lib/convex-server/submissions/media";

const storage = new B2Storage();

export const toggleBookmark = mutation({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be logged in to bookmark a song.");
    }

    const existingBookmark = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_and_submission", (q) =>
        q.eq("userId", userId).eq("submissionId", args.submissionId),
      )
      .first();

    if (existingBookmark) {
      await ctx.db.delete("bookmarks", existingBookmark._id);
      return { bookmarked: false };
    } else {
      await ctx.db.insert("bookmarks", {
        userId,
        submissionId: args.submissionId,
      });
      return { bookmarked: true };
    }
  },
});

export const getBookmarkedSongs = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_and_submission", (q) => q.eq("userId", userId))
      .collect();
    if (bookmarks.length === 0) {
      return [];
    }

    const submissions = await Promise.all(
      bookmarks.map((bookmark) => ctx.db.get("submissions", bookmark.submissionId)),
    );
    const submissionMap = new Map(
      submissions
        .filter((submission): submission is NonNullable<typeof submission> => submission !== null)
        .map((submission) => [submission._id.toString(), submission]),
    );

    const roundIds = [...new Set(submissions.filter(Boolean).map((s) => s!.roundId))];
    const rounds = await Promise.all(roundIds.map((roundId) => ctx.db.get("rounds", roundId)));
    const roundMap = new Map(
      rounds
        .filter((round): round is NonNullable<typeof round> => round !== null)
        .map((round) => [round._id.toString(), round]),
    );

    const leagueIds = [...new Set(rounds.filter(Boolean).map((round) => round!.leagueId))];
    const leagues = await Promise.all(
      leagueIds.map((leagueId) => ctx.db.get("leagues", leagueId)),
    );
    const leagueMap = new Map(
      leagues
        .filter((league): league is NonNullable<typeof league> => league !== null)
        .map((league) => [league._id.toString(), league]),
    );

    const songs = await Promise.all(
      bookmarks.map(async (bookmark) => {
        const submission = submissionMap.get(bookmark.submissionId.toString());
        if (!submission) return null;

        const round = roundMap.get(submission.roundId.toString());
        if (!round) return null;

        const league = leagueMap.get(round.leagueId.toString());
        if (!league) return null;

        const { albumArtUrl, songFileUrl } = await resolveSubmissionMediaUrls(
          storage,
          submission,
        );

        return {
          ...submission,
          _id: submission._id,
          roundTitle: round.title,
          leagueName: league.name,
          leagueId: league._id,
          albumArtUrl: albumArtUrl,
          songFileUrl: songFileUrl,
          isBookmarked: true,
        };
      }),
    );

    return songs.filter((song): song is NonNullable<typeof song> => song !== null);
  },
});
