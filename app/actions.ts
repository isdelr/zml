import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { PushSubscription } from "web-push";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function subscribeUser(sub: PushSubscription) {
  try {
    // Call the mutation with the updated arguments
    await convex.mutation(api.webPush.subscribe, {
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
export async function unsubscribeUser(endpoint: string) {
  try {
    await convex.mutation(api.webPush.unsubscribe, { endpoint });
    return { success: true };
  } catch (error) {
    console.error("Failed to unsubscribe user:", error);
    return { success: false, error: "Failed to unsubscribe." };
  }
}
