'use server'

import webpush, { PushSubscription } from 'web-push'

// This is a placeholder for a database. In a real application, you'd use
// your database (like Convex) to store subscriptions.
let subscriptions: PushSubscription[] = [];

// You need to generate VAPID keys and store them in your environment variables.
// Use `npx web-push generate-vapid-keys` to create them.
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'rosvelt005@hotmail.com', // Replace with your email
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
} else {
    console.warn("VAPID keys are not configured. Push notifications will not work.");
}


export async function subscribeUser(sub: PushSubscription) {
    console.log('Received subscription:', sub);
    // In a production environment, you would want to store the subscription in a database.
    // For example: await ctx.db.insert("pushSubscriptions", { userId: ..., subscription: sub });
    subscriptions.push(sub);
    return { success: true };
}

export async function unsubscribeUser(endpoint: string) {
    console.log('Unsubscribing:', endpoint);
    // In production, you'd find and remove the subscription from your database.
    subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
    return { success: true };
}

// This is a simplified send function. In a real app, you'd likely target specific users.
export async function sendNotification(message: string) {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        throw new Error("VAPID public key not set.");
    }

    console.log(`Sending notification to ${subscriptions.length} subscribers.`);

    const notificationPayload = JSON.stringify({
        title: 'ZML Notification',
        body: message,
        icon: '/icons/icon-192x192.png',
    });

    const promises = subscriptions.map(sub =>
        webpush.sendNotification(sub, notificationPayload).catch(error => {
            console.error('Error sending notification, subscription might be expired.', error);
            // Here you might want to remove the expired subscription.
        })
    );

    await Promise.all(promises);
    return { success: true };
}