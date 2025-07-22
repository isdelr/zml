import { v } from "convex/values";
import {
  internalMutation,
  internalAction,
  query,
  mutation,
  internalQuery, // <-- Import internalQuery
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// --- Internal Mutations & Actions for Creating Notifications ---

type CreateNotificationArgs = {
  userId: Id<"users">;
  type: "new_comment" | "round_submission" | "round_voting" | "round_finished";
  message: string;
  link: string;
  triggeringUserId?: Id<"users">;
};

// Internal mutation to create a single notification
export const create = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("new_comment"),
      v.literal("round_submission"),
      v.literal("round_voting"),
      v.literal("round_finished"),
    ),
    message: v.string(),
    link: v.string(),
    triggeringUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args: CreateNotificationArgs) => {
    if (args.userId === args.triggeringUserId) {
      return;
    }

    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      message: args.message,
      link: args.link,
      read: false,
      triggeringUserId: args.triggeringUserId,
    });
  },
});

// Internal action to create notifications for all members of a league
export const createForLeague = internalAction({
  args: {
    leagueId: v.id("leagues"),
    type: v.union(
      v.literal("round_submission"),
      v.literal("round_voting"),
      v.literal("round_finished"),
    ),
    message: v.string(),
    link: v.string(),
    triggeringUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const memberships = await ctx.runQuery(
      internal.notifications.getLeagueMemberships,
      { leagueId: args.leagueId },
    );

    for (const membership of memberships) {
      if (membership.userId === args.triggeringUserId) {
        continue;
      }

      await ctx.runMutation(internal.notifications.create, {
        userId: membership.userId,
        type: args.type,
        message: args.message,
        link: args.link,
      });
    }
  },
});

// Helper query used by the internal action above
// FIX: Changed from query to internalQuery
export const getLeagueMemberships = internalQuery({
  args: { leagueId: v.id("leagues") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .collect();
  },
});

// --- Public Queries & Mutations for the Frontend ---

export const getForUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return Promise.all(
      notifications.map(async (notification) => {
        let triggeringUser: Doc<"users"> | null = null;
        if (notification.triggeringUserId) {
          triggeringUser = await ctx.db.get(notification.triggeringUserId);
        }
        return {
          ...notification,
          triggeringUserName: triggeringUser?.name ?? null,
          triggeringUserImage: triggeringUser?.image ?? null,
        };
      }),
    );
  },
});

export const getUnreadCount = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return 0;
    }
    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();

    return unreadNotifications.length;
  },
});

export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated.");
    }
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== userId) {
      throw new Error("Notification not found or access denied.");
    }
    await ctx.db.patch(args.notificationId, { read: true });
  },
});

export const markAllAsRead = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated.");
    }
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();

    await Promise.all(
      unread.map((notification) =>
        ctx.db.patch(notification._id, { read: true }),
      ),
    );
  },
});