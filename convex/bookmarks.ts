import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";

const r2 = new R2(components.r2);

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
      await ctx.db.delete(existingBookmark._id);
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
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const songs = await Promise.all(
      bookmarks.map(async (bookmark) => {
        const submission = await ctx.db.get(bookmark.submissionId);
        if (!submission) return null;

        const round = await ctx.db.get(submission.roundId);
        const league = round ? await ctx.db.get(round.leagueId) : null;
        const [albumArtUrl, songFileUrl] = await Promise.all([
          r2.getUrl(submission.albumArtKey),
          r2.getUrl(submission.songFileKey),
        ]);

        return {
          ...submission,
          _id: submission._id,
          roundTitle: round?.title ?? "Unknown Round",
          leagueName: league?.name ?? "Unknown League",
          leagueId: league?._id ?? ("" as Id<"leagues">),
          albumArtUrl: albumArtUrl,
          songFileUrl: songFileUrl,
          isBookmarked: true, // Song is definitely bookmarked here
        };
      }),
    );

    return songs.filter((song): song is NonNullable<typeof song> => song !== null);
  },
});