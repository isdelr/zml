// convex/webPush.ts
import { v } from "convex/values";
import { internalQuery, mutation, internalMutation } from "./_generated/server"; // Add internalMutation
import { getAuthUserId } from "@convex-dev/auth/server";

// This schema now only contains the 'keys' part
const subscriptionDetailsSchema = v.object({
  keys: v.object({
    p256dh: v.string(),
    auth: v.string(),
  }),
});

export const subscribe = mutation({
  // Update args to accept endpoint and the rest of the subscription separately
  args: {
    endpoint: v.string(),
    subscription: subscriptionDetailsSchema,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User must be authenticated to subscribe.");
    }
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();
    if (existing) {
      console.log("Subscription already exists.");
      return;
    }
    // Store the document according to the new schema
    await ctx.db.insert("pushSubscriptions", {
      userId,
      endpoint: args.endpoint,
      subscription: args.subscription,
    });
  },
});

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Changed to internalMutation for better security
export const removeSubscription = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getSubscriptionsForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getAllSubscriptions = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("pushSubscriptions").collect();
  },
}); 