import { v } from "convex/values";
import {
  internalMutation,
  internalAction,
  query,
  mutation,
  internalQuery,
  ActionCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { unreadNotifications } from "./aggregates";

type NotificationType =
  | "new_comment"
  | "round_submission"
  | "round_voting"
  | "round_finished";

type CreateNotificationArgs = {
  userId: Id<"users">;
  type: NotificationType;
  message: string;
  link: string;
  triggeringUserId?: Id<"users">;
  metadata?: Record<string, unknown>;
  pushNotificationOverride?: {
    title?: string;
    body?: string;
    icon?: string;
  };
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
    metadata: v.optional(v.any()),
    pushNotificationOverride: v.optional(
      v.object({
        title: v.optional(v.string()),
        body: v.optional(v.string()),
        icon: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args: CreateNotificationArgs) => {
    if (args.userId === args.triggeringUserId) {
      return null;
    }
    const user = await ctx.db.get(args.userId);
    if (!user) {
      console.error(`[Notifications] User ${args.userId} not found`);
      return null;
    }
    const recentNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), args.type),
          q.eq(q.field("link"), args.link),
          q.gt(q.field("_creationTime"), Date.now() - 5 * 60 * 1000),
        ),
      )
      .first();
    if (recentNotifications) {
      return null;
    }
    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      message: args.message,
      link: args.link,
      read: false,
      triggeringUserId: args.triggeringUserId,
      metadata: args.metadata,
    });
    const newDoc = await ctx.db.get(notificationId);
    if (newDoc) {
      await unreadNotifications.insert(ctx, newDoc);
    }
    await ctx.scheduler.runAfter(0, internal.webPushActions.send, {
      userId: args.userId,
      payload: {
        title:
          args.pushNotificationOverride?.title ||
          getNotificationTitle(args.type),
        body: args.pushNotificationOverride?.body || args.message,
        icon: args.pushNotificationOverride?.icon,
        data: {
          url: args.link,
        },
      },
    });
    return notificationId;
  },
});

type CreateManyArgs = {
  userId: Id<"users">;
  type: NotificationType;
  message: string;
  link: string;
  triggeringUserId?: Id<"users">;
  metadata?: any;
  pushNotificationOverride?: {
    title?: string;
    body?: string;
    icon?: string;
  };
};

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
        triggeringUserId: v.optional(v.id("users")),
        metadata: v.optional(v.any()),
        pushNotificationOverride: v.optional(
          v.object({
            title: v.optional(v.string()),
            body: v.optional(v.string()),
            icon: v.optional(v.string()),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const createdIds: Id<"notifications">[] = [];
    for (const notification of args.notifications) {
      if (notification.userId === notification.triggeringUserId) {
        continue;
      }
      const user = await ctx.db.get(notification.userId);
      if (!user) {
        continue;
      }
      const notificationId = await ctx.db.insert("notifications", {
        ...notification,
        read: false,
      });
      const newDoc = await ctx.db.get(notificationId);
      if (newDoc) {
        await unreadNotifications.insert(ctx, newDoc);
        createdIds.push(newDoc._id);

        await ctx.scheduler.runAfter(0, internal.webPushActions.send, {
          userId: notification.userId,
          payload: {
            title:
              notification.pushNotificationOverride?.title ||
              getNotificationTitle(notification.type),
            body:
              notification.pushNotificationOverride?.body ||
              notification.message,
            icon: notification.pushNotificationOverride?.icon,
            data: {
              url: notification.link,
            },
          },
        });
      }
    }
    return createdIds;
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
    metadata: v.optional(v.any()),
    pushNotificationOverride: v.optional(
      v.object({
        title: v.optional(v.string()),
        body: v.optional(v.string()),
        icon: v.optional(v.string()),
      }),
    ),
  },
  handler: async (
    ctx: ActionCtx,
    args,
  ): Promise<Id<"notifications">[] | null> => {
    const memberships: Doc<"memberships">[] = await ctx.runQuery(
      internal.notifications.getLeagueMemberships,
      { leagueId: args.leagueId },
    );
    if (!memberships) return null;

    const notificationsToCreate: CreateManyArgs[] = memberships
      .filter((membership) => membership.userId !== args.triggeringUserId)
      .map((membership) => ({
        userId: membership.userId,
        type: args.type,
        message: args.message,
        link: args.link,
        metadata: args.metadata,
        pushNotificationOverride: args.pushNotificationOverride,
      }));

    if (notificationsToCreate.length > 0) {
      const createdIds = await ctx.runMutation(internal.notifications.createMany, {
        notifications: notificationsToCreate,
      });
      return createdIds;
    }
    return [];
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

    // FIX: Defined a limit for the query
    const limit = 20;

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    const enrichedNotifications = await Promise.all(
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
    return enrichedNotifications;
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
    if (notification.read) {
      return;
    }
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
      .withIndex("by_user_and_read", (q) =>
        q.eq("userId", userId).eq("read", false),
      )
      .collect();

    for (const notification of unread) {
      const oldDoc = notification;
      await ctx.db.patch(notification._id, { read: true });
      const newDoc = { ...oldDoc, read: true };
      await unreadNotifications.replace(ctx, oldDoc, newDoc);
    }
  },
});

export const deleteOldNotifications = internalMutation({
  args: {
    olderThanDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const olderThanMs = (args.olderThanDays || 90) * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - olderThanMs;

    const oldNotifications = await ctx.db
      .query("notifications")
      .filter((q) => q.lt(q.field("_creationTime"), cutoffTime))
      .collect();

    for (const notification of oldNotifications) {
      // FIX: Changed 'remove' to 'delete'
      await unreadNotifications.delete(ctx, notification);
      await ctx.db.delete(notification._id);
    }
    return { deleted: oldNotifications.length };
  },
});

function getNotificationTitle(type: string): string {
  switch (type) {
    case "new_comment":
      return "New Comment";
    case "round_submission":
      return "New Round Started";
    case "round_voting":
      return "Voting Time!";
    case "round_finished":
      return "Round Complete";
    default:
      return "ZML Notification";
  }
}