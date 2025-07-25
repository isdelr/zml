import { PageLayout } from "@/components/layout/PageLayout";
import type { Metadata } from 'next';
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import NotificationsPage from "@/components/NotificationsPage";

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Stay updated with the latest activity in your leagues. See comments, round updates, and more.',
};

export default async function Notifications() {
  const preloadedNotifications = await preloadQuery(api.notifications.getForUser);

  return (
    <PageLayout>
      <NotificationsPage preloadedNotifications={preloadedNotifications} />
    </PageLayout>
  );
}