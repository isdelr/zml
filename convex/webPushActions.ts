// convex/webPushActions.ts
"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import webpush, { PushSubscription, WebPushError } from "web-push";
import { v } from "convex/values";

// Configure web-push with your VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:your-email@example.com", // Replace with your email
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
} else {
  console.warn("VAPID keys are not configured. Push notifications will not work.");
}

/**
 * Main internal action to trigger sending a notification to all subscribers.
 */
export const sendToAll = action({
  args: { message: v.string() },
  handler: async (ctx, args) => {
    if (!process.env.VAPID_PUBLIC_KEY) {
      throw new Error("VAPID public key not set.");
    }

    const subscriptions = await ctx.runQuery(internal.webPush.getAllSubscriptions);
    console.log(`Sending notification to ${subscriptions.length} subscribers.`);

    const notificationPayload = JSON.stringify({
      title: "ZML Notification",
      body: args.message,
      icon: "/icons/icon-192x192.png",
    });

    // Loop through subscriptions and send notifications directly
    for (const sub of subscriptions) {
      const fullSubscriptionObject = {
        endpoint: sub.endpoint,
        keys: sub.subscription.keys,
      };

      try {
        await webpush.sendNotification(fullSubscriptionObject as PushSubscription, notificationPayload);
      } catch (error) {
        // Use property checking to safely identify the error type
        if (
          error &&
          typeof error === "object" &&
          "statusCode" in error &&
          "body" in error
        ) {
          const webPushError = error as WebPushError;
          console.error(
            `Error sending notification to ${fullSubscriptionObject.endpoint}:`,
            webPushError.body
          );
          if (webPushError.statusCode === 404 || webPushError.statusCode === 410) {
            console.log("Subscription expired, removing from DB.");
            // Call the internalMutation with the correct path
            await ctx.runMutation(internal.webPush.removeSubscription, {
              endpoint: fullSubscriptionObject.endpoint,
            });
          }
        } else {
          console.error("An unexpected error occurred during push notification:", error);
        }
      }
    }

    return { success: true };
  },
});