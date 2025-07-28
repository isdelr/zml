// convex/webPushActions.ts
"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import webpush, { PushSubscription, WebPushError } from "web-push";
import { v } from "convex/values";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:your-email@example.com", // Replace with your email
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
} else {
  console.warn("VAPID keys are not configured. Push notifications will not work.");
}

export const send = internalAction({
  args: {
    userId: v.id("users"),
    // This payload structure matches what your sw.js expects
    payload: v.object({
      title: v.string(),
      body: v.string(),
      data: v.object({
        url: v.string(),
      }),
    }),
  },
  handler: async (ctx, args) => {
    if (!process.env.VAPID_PUBLIC_KEY) {
      console.error("VAPID public key not set.");
      return;
    }

    const subscriptions = await ctx.runQuery(internal.webPush.getSubscriptionsForUser, {
      userId: args.userId,
    });

    if (subscriptions.length === 0) {
      console.log(`No push subscriptions for user ${args.userId}`);
      return;
    }

    const notificationPayload = JSON.stringify(args.payload);

    for (const sub of subscriptions) {
      const fullSubscriptionObject = {
        endpoint: sub.endpoint,
        keys: sub.subscription.keys,
      };

      try {
        await webpush.sendNotification(fullSubscriptionObject as PushSubscription, notificationPayload);
      } catch (error) {
        const webPushError = error as WebPushError;
        if (webPushError.statusCode === 404 || webPushError.statusCode === 410) {
          console.log("Subscription has expired or is no longer valid. Removing.");
          await ctx.runMutation(internal.webPush.removeSubscription, {
            endpoint: fullSubscriptionObject.endpoint,
          });
        } else {
          console.error("Error sending push notification:", webPushError.body);
        }
      }
    }
  },
});

