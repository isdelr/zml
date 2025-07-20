import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";

const FALLBACK_IMAGE_URL = "https://i.ytimg.com/vi/J7tp_0lFI0I/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDnX9OH1KITaxV876Nn-gONVGbK_w";

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
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .collect();

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

        return {
          ...submission,
          submittedBy: user?.name ?? "Anonymous",
          albumArtUrl: albumArtUrl ?? FALLBACK_IMAGE_URL,
          songFileUrl: songFileUrl,
        };
      }),
    );
  },
});
