// convex/webPush.ts
import { v } from "convex/values";
import { internalQuery, mutation, internalMutation, query } from "./_generated/server";
import { getAuthUserId } from "./authCore";

const subscriptionDetailsSchema = v.object({
  keys: v.object({
    p256dh: v.string(),
    auth: v.string(),
  }),
});

function normalizeVapidPublicKey(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, "").trim();
}

export const subscribe = mutation({
  args: {
    endpoint: v.string(),
    applicationServerKey: v.string(),
    subscription: subscriptionDetailsSchema,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User must be authenticated to subscribe.");
    }
    console.log(`[WebPush] Subscribe request for user ${userId}`);
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

    const serverApplicationServerKey = normalizeVapidPublicKey(
      process.env.VAPID_PUBLIC_KEY,
    );
    const clientApplicationServerKey = normalizeVapidPublicKey(
      args.applicationServerKey,
    );
    if (!serverApplicationServerKey) {
      console.error("[WebPush] VAPID_PUBLIC_KEY is missing in Convex env");
      throw new Error("Push notifications are not configured on the server.");
    }
    if (clientApplicationServerKey !== serverApplicationServerKey) {
      console.error("[WebPush] Client/server VAPID public key mismatch", {
        clientKeyLength: clientApplicationServerKey.length,
        serverKeyLength: serverApplicationServerKey.length,
      });
      throw new Error(
        "Push notification keys are out of sync. Rebuild the frontend with the server VAPID public key.",
      );
    }

    const existingByEndpoint = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint)).first();
    if (existingByEndpoint) {
      if (existingByEndpoint.userId === userId) {
        console.log("[WebPush] Updating existing subscription for same user");
        await ctx.db.patch("pushSubscriptions", existingByEndpoint._id, {
          applicationServerKey: clientApplicationServerKey,
          subscription: args.subscription,
          updatedAt: Date.now(),
          isActive: true,
          deactivatedAt: undefined,
          deactivationReason: undefined,
        });
        return { success: true, updated: true };
      } else {
        console.warn("[WebPush] Endpoint exists for different user, removing old subscription");
        await ctx.db.delete("pushSubscriptions", existingByEndpoint._id);
      }
    }

    const MAX_SUBSCRIPTIONS_PER_USER = 5;
    const existingForUser = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_SUBSCRIPTIONS_PER_USER + 1);
    console.log(`[WebPush] User has ${existingForUser.length} existing subscriptions`);

    if (existingForUser.length >= MAX_SUBSCRIPTIONS_PER_USER) {
      const oldestSubscription = existingForUser[0];
      console.log("[WebPush] Removing oldest subscription to stay under limit");
      await ctx.db.delete("pushSubscriptions", oldestSubscription._id);
    }

    const newSubscription = await ctx.db.insert("pushSubscriptions", {
      userId,
      endpoint: args.endpoint,
      applicationServerKey: clientApplicationServerKey,
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
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User must be authenticated to unsubscribe.");
    }

    console.log(`[WebPush] Unsubscribe request for user ${userId}`);
    console.log(`[WebPush] Endpoint: ${args.endpoint.substring(0, 50)}...`);

    const existing = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint)).first();
    if (existing) {
      if (existing.userId !== userId) {
        console.warn("[WebPush] User attempted to unsubscribe from subscription they don't own");
        throw new Error("Unauthorized to unsubscribe from this endpoint");
      }
      await ctx.db.delete("pushSubscriptions", existing._id);
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
    console.log(`[WebPush] Deactivating subscription due to: ${args.reason || "unknown reason"}`);
    console.log(`[WebPush] Endpoint: ${args.endpoint.substring(0, 50)}...`);
    const existing = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint)).first();
    if (existing) {
      await ctx.db.patch("pushSubscriptions", existing._id, {
        isActive: false,
        deactivatedAt: Date.now(),
        deactivationReason: args.reason ?? "unknown",
        updatedAt: Date.now(),
      });
      console.log("[WebPush] Subscription deactivated successfully");
      return { success: true, removed: true };
    } else {
      console.log("[WebPush] Subscription not found for deactivation");
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
      .collect();
    const activeSubscriptions = subscriptions.filter(
      (subscription) => subscription.isActive !== false,
    );
    console.log(`[WebPush] Found ${activeSubscriptions.length} active subscriptions for user ${args.userId}`);
    return activeSubscriptions;
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
