import { v } from "convex/values";
import {
  internalMutation,
  internalAction,
  query,
  mutation,
  internalQuery,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { unreadNotifications } from "./aggregates";

type CreateNotificationArgs = {
  userId: Id<"users">;
  type: "new_comment" | "round_submission" | "round_voting" | "round_finished";
  message: string;
  link: string;
  triggeringUserId?: Id<"users">;
};

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

    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      message: args.message,
      link: args.link,
      read: false,
      triggeringUserId: args.triggeringUserId,
    });

    const newDoc = await ctx.db.get(notificationId);
    if (newDoc) {
      await unreadNotifications.insert(ctx, newDoc);
    }
    
    await ctx.scheduler.runAfter(0, internal.webPushActions.send, {
        userId: args.userId,
        payload: {
            title: "New ZML Notification",
            body: args.message,
            data: {
                url: args.link
            }
        }
    });
  },
});

export const createMany = internalMutation({
  args: {
    notifications: v.array(
      v.object({
        userId: v.id("users"),
        type: v.union(
          v.literal("new_comment"),
          v.literal("round_submission"),
          v.literal("round_voting"),
          v.literal("round_finished"),
        ),
        message: v.string(),
        link: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const notification of args.notifications) {
      const notificationId = await ctx.db.insert("notifications", {
        ...notification,
        read: false,
      });
      const newDoc = await ctx.db.get(notificationId);
      if (newDoc) {
        await unreadNotifications.insert(ctx, newDoc);
      }
      await ctx.scheduler.runAfter(0, internal.webPushActions.send, {
        userId: notification.userId,
        payload: {
            title: "New ZML Notification",
            body: notification.message,
            data: {
                url: notification.link
            }
        }
      });
    }
  },
});

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

    const notificationsToCreate = memberships
      .filter((membership) => membership.userId !== args.triggeringUserId)
      .map((membership) => ({
        userId: membership.userId,
        type: args.type,
        message: args.message,
        link: args.link,
      }));

    if (notificationsToCreate.length > 0) {
      await ctx.runMutation(internal.notifications.createMany, {
        notifications: notificationsToCreate,
      });
    }
  },
});

export const getLeagueMemberships = internalQuery({
  args: { leagueId: v.id("leagues") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .collect();
  },
});

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
    return await unreadNotifications.count(ctx, {
      bounds: { prefix: [userId, false] },
    });
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
    if (notification.read) return;

    const oldDoc = notification;
    await ctx.db.patch(args.notificationId, { read: true });
    const newDoc = { ...oldDoc, read: true };
    await unreadNotifications.replace(ctx, oldDoc, newDoc);
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

    for (const notification of unread) {
      const oldDoc = notification;
      await ctx.db.patch(notification._id, { read: true });
      const newDoc = { ...oldDoc, read: true };
      await unreadNotifications.replace(ctx, oldDoc, newDoc);
    }
  },
});