// convex/presence.ts
import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { Id } from "./_generated/dataModel";
import { B2Storage } from "./b2Storage";
import { resolveUserAvatarUrl } from "./userAvatar";

const storage = new B2Storage();

// The location will be the submissionId the user is currently listening to.
// The data will be empty for now, but you could add more info later.
const presenceLocation = v.union(v.null(), v.id("submissions"));
const PRESENCE_HEARTBEAT_SKIP_MS = 25_000;
const PRESENCE_STALE_MS = 90_000;

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
    const now = Date.now();
    const existingPresence = (await ctx.db.get("users", userId))?.presence;

    if (listeningTo) {
      const existingRoundId =
        existingPresence?.location === listeningTo
          ? existingPresence.roundId
          : undefined;
      const roundId =
        existingRoundId ??
        (await ctx.db.get("submissions", listeningTo))?.roundId;

      const isSamePresence =
        existingPresence?.location === listeningTo &&
        existingPresence?.roundId === roundId;
      if (
        isSamePresence &&
        now - existingPresence.updated < PRESENCE_HEARTBEAT_SKIP_MS
      ) {
        return;
      }

      await ctx.db.patch("users", userId, {
        presence: {
          location: listeningTo,
          roundId: roundId,
          updated: now,
          data: { source: "player", tick: now },
        },
      });
    } else {
      // If they are not listening, remove the presence data
      if (!existingPresence) {
        return;
      }
      await ctx.db.patch("users", userId, { presence: undefined });
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
    const staleCutoff = Date.now() - PRESENCE_STALE_MS;
    const activeUsers = users.filter(
      (user) => user.presence && user.presence.updated >= staleCutoff,
    );

    // Return only the necessary data for the AvatarStack
    return Promise.all(
      activeUsers.map(async (user) => ({
        _id: user._id,
        name: user.name,
        image: await resolveUserAvatarUrl(storage, user),
      })),
    );
  },
});

export const listForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const listeners = await ctx.db
      .query("users")
      .withIndex("by_presence_round", (q) => q.eq("presence.roundId", roundId))
      .collect();
    const staleCutoff = Date.now() - PRESENCE_STALE_MS;

    const listenersBySubmission: Record<
      string,
      { _id: Id<"users">; name?: string; image?: string }[]
    > = {};

    for (const listener of listeners) {
      if (
        listener.presence &&
        listener.presence.location &&
        listener.presence.updated >= staleCutoff
      ) {
        const location = listener.presence.location as string;
        if (!listenersBySubmission[location]) {
          listenersBySubmission[location] = [];
        }
        const image = await resolveUserAvatarUrl(storage, listener);
        listenersBySubmission[location]!.push({
          _id: listener._id,
          name: listener.name,
          image: image ?? undefined,
        });
      }
    }
    return listenersBySubmission;
  },
});

// Lightweight no-op to keep the Convex V8 runtime warm and avoid cold-start
// latency on user-facing queries after periods of inactivity.
export const keepalive = internalMutation({
  args: {},
  handler: async () => {},
});
