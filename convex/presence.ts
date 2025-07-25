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
      // If the user is listening to a song, set their presence
      await ctx.db.patch(userId, {
        presence: {
          location: listeningTo,
          updated: Date.now(),
          data: {}, // You could add more data here if needed
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