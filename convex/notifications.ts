import { v } from "convex/values";
import {
  internalMutation,
  internalAction,
  query,
  mutation,
  internalQuery,
  ActionCtx,
  MutationCtx,
} from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";

type NotificationType =
  | "new_comment"
  | "round_submission"
  | "round_voting"
  | "round_finished";
type NotificationMetadata = {
  seedNamespace?: string;
  source?: string;
};

const notificationMetadataValidator = v.object({
  seedNamespace: v.optional(v.string()),
  source: v.optional(v.string()),
});

const notificationTypeValidator = v.union(
  v.literal("new_comment"),
  v.literal("round_submission"),
  v.literal("round_voting"),
  v.literal("round_finished"),
);

const pushNotificationOverrideValidator = v.object({
  title: v.optional(v.string()),
  body: v.optional(v.string()),
  icon: v.optional(v.string()),
});

type NotificationWriteArgs = {
  userId: Id<"users">;
  type: NotificationType;
  message: string;
  link: string;
  triggeringUserId?: Id<"users">;
  metadata?: NotificationMetadata;
  pushNotificationOverride?: {
    title?: string;
    body?: string;
    icon?: string;
  };
};

type CreateNotificationOptions = {
  existingUserIds?: ReadonlySet<string>;
};

const enqueueNotificationPush = async (
  ctx: MutationCtx,
  notification: NotificationWriteArgs,
) => {
  await ctx.scheduler.runAfter(0, internal.webPushActions.send, {
    userId: notification.userId,
    payload: {
      title:
        notification.pushNotificationOverride?.title ||
        getNotificationTitle(notification.type),
      body: notification.pushNotificationOverride?.body || notification.message,
      icon: notification.pushNotificationOverride?.icon,
      data: {
        url: notification.link,
      },
    },
  });
};

const createNotificationWithSideEffects = async (
  ctx: MutationCtx,
  notification: NotificationWriteArgs,
  options: CreateNotificationOptions = {},
): Promise<Id<"notifications"> | null> => {
  if (notification.userId === notification.triggeringUserId) {
    return null;
  }
  if (options.existingUserIds) {
    if (!options.existingUserIds.has(notification.userId.toString())) {
      return null;
    }
  } else {
    const user = await ctx.db.get("users", notification.userId);
    if (!user) {
      return null;
    }
  }

  const notificationId = await ctx.db.insert("notifications", {
    userId: notification.userId,
    type: notification.type,
    message: notification.message,
    link: notification.link,
    read: false,
    createdAt: Date.now(),
    triggeringUserId: notification.triggeringUserId,
    metadata: notification.metadata,
  });

  const newDoc = await ctx.db.get("notifications", notificationId);
  if (!newDoc) {
    return notificationId;
  }
  await enqueueNotificationPush(ctx, notification);

  return notificationId;
};

export const create = internalMutation({
  args: {
    userId: v.id("users"),
    type: notificationTypeValidator,
    message: v.string(),
    link: v.string(),
    triggeringUserId: v.optional(v.id("users")),
    metadata: v.optional(notificationMetadataValidator),
    pushNotificationOverride: v.optional(pushNotificationOverrideValidator),
  },
  handler: async (ctx, args: NotificationWriteArgs) => {
    const duplicateWindowStart = Date.now() - 0.5 * 60 * 1000;
    const recentSameType = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_type", (q) =>
        q.eq("userId", args.userId).eq("type", args.type),
      )
      .order("desc")
      .take(20);
    const hasRecentDuplicate = recentSameType.some(
      (notification) =>
        notification.link === args.link &&
        notification._creationTime > duplicateWindowStart,
    );
    if (hasRecentDuplicate) {
      return null;
    }

    const notificationId = await createNotificationWithSideEffects(ctx, args);
    return notificationId;
  },
});

export const createMany = internalMutation({
  args: {
    notifications: v.array(
      v.object({
        userId: v.id("users"),
        type: notificationTypeValidator,
        message: v.string(),
        link: v.string(),
        triggeringUserId: v.optional(v.id("users")),
        metadata: v.optional(notificationMetadataValidator),
        pushNotificationOverride: v.optional(pushNotificationOverrideValidator),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const uniqueUserIds = [
      ...new Set(args.notifications.map((notification) => notification.userId)),
    ];
    const users = await Promise.all(
      uniqueUserIds.map((userId) => ctx.db.get("users", userId)),
    );
    const existingUserIds = new Set(
      users
        .filter((user): user is NonNullable<typeof user> => user !== null)
        .map((user) => user._id.toString()),
    );

    const createdIds: Id<"notifications">[] = [];
    for (const notification of args.notifications) {
      const notificationId = await createNotificationWithSideEffects(
        ctx,
        notification,
        { existingUserIds },
      );
      if (notificationId) {
        createdIds.push(notificationId);
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
    metadata: v.optional(notificationMetadataValidator),
    pushNotificationOverride: v.optional(
      v.object({
        title: v.optional(v.string()),
        body: v.optional(v.string()),
        icon: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx: ActionCtx, args): Promise<Id<"notifications">[]> => {
    const memberships: Doc<"memberships">[] = await ctx.runQuery(
      internal.notifications.getLeagueMemberships,
      { leagueId: args.leagueId },
    );

    const notificationsToCreate: NotificationWriteArgs[] = memberships
      .filter((membership) => membership.userId !== args.triggeringUserId)
      .map((membership) => ({
        userId: membership.userId,
        type: args.type,
        message: args.message,
        link: args.link,
        triggeringUserId: args.triggeringUserId,
        metadata: args.metadata,
        pushNotificationOverride: args.pushNotificationOverride,
      }));

    if (notificationsToCreate.length > 0) {
      const createdIds = await ctx.runMutation(
        internal.notifications.createMany,
        { notifications: notificationsToCreate },
      );
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
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const paginationResult = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(args.paginationOpts);

    const enrichedNotifications = paginationResult.page.map((notification) => ({
      ...notification,
      triggeringUserName: null,
      triggeringUserImage: null,
    }));

    return { ...paginationResult, page: enrichedNotifications };
  },
});

export const getUnreadCount = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return 0;
    }

    const unreadPreview = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) =>
        q.eq("userId", userId).eq("read", false),
      )
      .take(100);
    return unreadPreview.length >= 100 ? 99 : unreadPreview.length;
  },
});

export const getRecentUnread = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const limit = Math.max(1, Math.min(args.limit ?? 5, 10));
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) =>
        q.eq("userId", userId).eq("read", false),
      )
      .order("desc")
      .take(limit);

    return unread.map((notification) => ({
      ...notification,
      triggeringUserName: null,
    }));
  },
});

export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated.");
    }
    const notification = await ctx.db.get("notifications", args.notificationId);
    if (!notification || notification.userId !== userId) {
      throw new Error("Notification not found or access denied.");
    }
    if (notification.read) {
      return;
    }
    await ctx.db.patch("notifications", args.notificationId, { read: true });
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
      await ctx.db.patch("notifications", notification._id, { read: true });
    }
  },
});

export const deleteOldNotifications = internalMutation({
  args: { olderThanDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const olderThanMs = (args.olderThanDays || 90) * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - olderThanMs;
    const oldNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_created_at", (q) => q.lt("createdAt", cutoffTime))
      .collect();
    for (const notification of oldNotifications) {
      await ctx.db.delete("notifications", notification._id);
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
