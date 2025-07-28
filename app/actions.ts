import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { PushSubscription } from "web-push";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface PushSubscriptionDetails extends PushSubscription {
  userId: Id<"users">; // Assuming you have a users table with Id
}

export async function subscribeUser(sub: PushSubscriptionDetails) {
  try {
    // Call the mutation with the updated arguments
    await convex.mutation(api.webPush.subscribe, {
      userId: sub.userId,
      endpoint: sub.endpoint,
      subscription: {
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to subscribe user:", error);
    return { success: false, error: "Failed to subscribe." };
  }
}

// The rest of the file remains the same
export async function unsubscribeUser(userId: Id<"users">, endpoint: string) {
  try {
    await convex.mutation(api.webPush.unsubscribe, {userId, endpoint });
    return { success: true };
  } catch (error) {
    console.error("Failed to unsubscribe user:", error);
    return { success: false, error: "Failed to unsubscribe." };
  }
}
