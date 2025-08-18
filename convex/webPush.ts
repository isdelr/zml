// convex/webPush.ts
import { v } from "convex/values";
import { internalQuery, mutation, internalMutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const subscriptionDetailsSchema = v.object({
  keys: v.object({
    p256dh: v.string(),
    auth: v.string(),
  }),
});

export const subscribe = mutation({
  args: {
    endpoint: v.string(),
    subscription: subscriptionDetailsSchema,
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    if (!args.userId) {
      throw new Error("User must be authenticated to subscribe.");
    }
    console.log(`[WebPush] Subscribe request for user ${args.userId}`);
    console.log(`[WebPush] Endpoint: ${args.endpoint.substring(0, 50)}...`);

    try {
      new URL(args.endpoint);
    } catch {
      console.error("[WebPush] Invalid endpoint URL:", args.endpoint);
      throw new Error("Invalid endpoint URL");
    }

    if (!args.subscription.keys.p256dh || !args.subscription.keys.auth) {
      console.error("[WebPush] Missing required keys in subscription");
      throw new Error("Missing required keys in subscription");
    }

    const existingByEndpoint = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint)).first();
    if (existingByEndpoint) {
      if (existingByEndpoint.userId === args.userId) {
        console.log("[WebPush] Updating existing subscription for same user");
        await ctx.db.patch(existingByEndpoint._id, {
          subscription: args.subscription,
          updatedAt: Date.now(),
        });
        return { success: true, updated: true };
      } else {
        console.warn("[WebPush] Endpoint exists for different user, removing old subscription");
        await ctx.db.delete(existingByEndpoint._id);
      }
    }

    const existingForUser = await ctx.db.query("pushSubscriptions").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
    console.log(`[WebPush] User has ${existingForUser.length} existing subscriptions`);

    const MAX_SUBSCRIPTIONS_PER_USER = 5;
    if (existingForUser.length >= MAX_SUBSCRIPTIONS_PER_USER) {
      const oldestSubscription = existingForUser.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0];
      console.log("[WebPush] Removing oldest subscription to stay under limit");
      await ctx.db.delete(oldestSubscription._id);
    }

    const newSubscription = await ctx.db.insert("pushSubscriptions", {
      userId: args.userId,
      endpoint: args.endpoint,
      subscription: args.subscription,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    });
    console.log(`[WebPush] Created new subscription with ID: ${newSubscription}`);

    return { success: true, subscriptionId: newSubscription };
  },
});

export const unsubscribe = mutation({
  args: { endpoint: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    console.log(`[WebPush] Unsubscribe request for user ${args.userId}`);
    console.log(`[WebPush] Endpoint: ${args.endpoint.substring(0, 50)}...`);

    const existing = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint)).first();
    if (existing) {
      if (existing.userId !== args.userId) {
        console.warn("[WebPush] User attempted to unsubscribe from subscription they don't own");
        throw new Error("Unauthorized to unsubscribe from this endpoint");
      }
      await ctx.db.delete(existing._id);
      console.log("[WebPush] Subscription deleted successfully");
      return { success: true };
    } else {
      console.log("[WebPush] Subscription not found for unsubscribe");
      return { success: true, message: "Subscription not found" };
    }
  },
});

export const removeSubscription = internalMutation({
  args: { endpoint: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    console.log(`[WebPush] Removing subscription due to: ${args.reason || "unknown reason"}`);
    console.log(`[WebPush] Endpoint: ${args.endpoint.substring(0, 50)}...`);
    const existing = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint)).first();
    if (existing) {
      await ctx.db.delete(existing._id);
      console.log("[WebPush] Subscription removed successfully");
      return { success: true, removed: true };
    } else {
      console.log("[WebPush] Subscription not found for removal");
      return { success: true, removed: false };
    }
  },
});

export const getSubscriptionsForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    console.log(`[WebPush] Found ${subscriptions.length} active subscriptions for user ${args.userId}`);
    return subscriptions;
  },
});

export const getAllSubscriptions = internalQuery({
  handler: async (ctx) => {
    const subscriptions = await ctx.db.query("pushSubscriptions").filter((q) => q.eq(q.field("isActive"), true)).collect();
    console.log(`[WebPush] Found ${subscriptions.length} total active subscriptions`);
    return subscriptions;
  },
});

export const getMySubscriptions = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const subscriptions = await ctx.db.query("pushSubscriptions").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    return subscriptions.map((sub) => ({
      _id: sub._id,
      endpoint: sub.endpoint.substring(0, 50) + "...",
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
      isActive: sub.isActive,
    }));
  },
});

export const deactivateSubscription = internalMutation({
  args: { endpoint: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    console.log(`[WebPush] Deactivating subscription due to: ${args.reason || "unknown reason"}`);
    const existing = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint)).first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        isActive: false,
        deactivatedAt: Date.now(),
        deactivationReason: args.reason,
      });
      console.log("[WebPush] Subscription deactivated successfully");
      return { success: true, deactivated: true };
    }
    return { success: true, deactivated: false };
  },
});

export const cleanupSubscriptions = internalMutation({
  args: { olderThanDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const olderThanMs = (args.olderThanDays || 30) * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - olderThanMs;
    console.log(`[WebPush] Cleaning up subscriptions older than ${args.olderThanDays || 30} days`);

    const oldSubscriptions = await ctx.db
      .query("pushSubscriptions")
      .filter((q) => q.and(q.eq(q.field("isActive"), false), q.lt(q.field("deactivatedAt"), cutoffTime)))
      .collect();

    console.log(`[WebPush] Found ${oldSubscriptions.length} subscriptions to clean up`);
    for (const subscription of oldSubscriptions) {
      await ctx.db.delete(subscription._id);
    }
    return { success: true, cleanedUp: oldSubscriptions.length };
  },
});

export const getSubscriptionStats = internalQuery({
  handler: async (ctx) => {
    const allSubscriptions = await ctx.db.query("pushSubscriptions").collect();
    const active = allSubscriptions.filter((s) => s.isActive !== false).length;
    const inactive = allSubscriptions.filter((s) => s.isActive === false).length;
    const uniqueUsers = new Set(allSubscriptions.map((s) => s.userId)).size;
    return {
      total: allSubscriptions.length,
      active,
      inactive,
      uniqueUsers,
    };
  },
});
