// convex/presence.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// The location will be the submissionId the user is currently listening to.
// The data will be empty for now, but you could add more info later.
const presenceLocation = v.union(v.null(), v.id("submissions"));

// Mutation to update the user's presence data.
export const update = mutation({
  args: {
    listeningTo: presenceLocation,
  },
  handler: async (ctx, { listeningTo }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return;
    }
    const user = await ctx.db.get(userId);
    if (!user) return;

    if (listeningTo) {
      // Fetch submission to get roundId
      const submission = await ctx.db.get(listeningTo);
      const roundId = submission?.roundId;

      await ctx.db.patch(userId, {
        presence: {
          location: listeningTo,
          roundId: roundId, // Store the roundId
          updated: Date.now(),
          data: {},
        },
      });
    } else {
      // If they are not listening, remove the presence data
      await ctx.db.patch(userId, { presence: undefined });
    }
  },
});

// Query to list all users present at a specific location (listening to a song).
export const list = query({
  args: { location: presenceLocation },
  handler: async (ctx, { location }) => {
    if (location === null) {
      return [];
    }
    const users = await ctx.db
      .query("users")
      .withIndex("by_presence", (q) => q.eq("presence.location", location))
      .collect();

    // Return only the necessary data for the AvatarStack
    return users.map((user) => ({
      _id: user._id,
      name: user.name,
      image: user.image,
    }));
  },
});

export const listForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const listeners = await ctx.db
      .query("users")
      .withIndex("by_presence_round", q => q.eq("presence.roundId", roundId))
      .collect();

    const listenersBySubmission: Record<string, { _id: Id<"users">, name?: string, image?: string }[]> = {};

    for (const listener of listeners) {
      if (listener.presence && listener.presence.location) {
        const location = listener.presence.location as string;
        if (!listenersBySubmission[location]) {
          listenersBySubmission[location] = [];
        }
        listenersBySubmission[location]!.push({
          _id: listener._id,
          name: listener.name,
          image: listener.image,
        });
      }
    }
    return listenersBySubmission;
  }
});