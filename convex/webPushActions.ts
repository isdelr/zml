// convex/webPushActions.ts
"use node";

import { internalAction, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import webpush, { PushSubscription, WebPushError } from "web-push";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

if (process.env.VAPID_PUBLIC_KEY&& process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:isaias005@hotmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

// FIX: Define a type for the action's arguments
type SendArgs = {
  userId: Id<"users">;
  payload: {
    title: string;
    body: string;
    data?: { url?: string };
    icon?: string;
    badge?: string;
  };
};

// FIX: Define a type for the action's return value
type SendResult = {
  success: boolean;
  error?: string;
  successCount?: number;
  failureCount?: number;
  totalSubscriptions?: number;
  errors?: { endpoint: string; statusCode: number; error: string }[];
};

export const send = internalAction({
  args: {
    userId: v.id("users"),
    payload: v.object({
      title: v.string(),
      body: v.string(),
      data: v.optional(v.object({ url: v.optional(v.string()) })),
      icon: v.optional(v.string()),
      badge: v.optional(v.string()),
    }),
  },

  handler: async (ctx: ActionCtx, args: SendArgs): Promise<SendResult> => {
    if (!process.env.VAPID_PUBLIC_KEY|| !process.env.VAPID_PRIVATE_KEY) {
      console.error("[Push] VAPID keys not configured");
      return { success: false, error: "VAPID keys not configured" };
    }

    const subscriptions: Doc<"pushSubscriptions">[] = await ctx.runQuery(
      internal.webPush.getSubscriptionsForUser,
      { userId: args.userId },
    );

    if (subscriptions.length === 0) {
      return { success: false, error: "No subscriptions found" };
    }

    const notificationPayload = JSON.stringify({
      title: args.payload.title,
      body: args.payload.body,
      icon: args.payload.icon || "/icons/web-app-manifest-192x192.png",
      badge: args.payload.badge || "/icons/web-app-manifest-192x192.png",
      data: {
        url: args.payload.data?.url || "/",
        timestamp: Date.now(),
      },
    });

    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    for (const sub of subscriptions) {
      const fullSubscriptionObject = {
        endpoint: sub.endpoint,
        keys: sub.subscription.keys,
      };

      try {
        await webpush.sendNotification(
          fullSubscriptionObject as PushSubscription,
          notificationPayload,
          { TTL: 86400, urgency: "normal" },
        );
        successCount++;
      } catch (error) {
        const webPushError = error as WebPushError;
        failureCount++;
        errors.push({
          endpoint: sub.endpoint.substring(0, 50) + "...",
          statusCode: webPushError.statusCode,
          error: webPushError.body,
        });

        if (webPushError.statusCode === 404 || webPushError.statusCode === 410) {
          await ctx.runMutation(internal.webPush.removeSubscription, {
            endpoint: fullSubscriptionObject.endpoint,
          });
        }
      }
    }

    const result: SendResult = {
      success: successCount > 0,
      successCount,
      failureCount,
      totalSubscriptions: subscriptions.length,
      errors: errors.length > 0 ? errors : undefined,
    };

    return result;
  },
});
