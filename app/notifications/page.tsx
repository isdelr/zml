import { PageLayout } from "@/components/layout/PageLayout";
import type { Metadata } from 'next';
import NotificationsPage from "@/components/NotificationsPage";

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Stay updated with the latest activity in your leagues. See comments, round updates, and more.',
};

export default async function Notifications() {
  return (
    <PageLayout>
      <NotificationsPage />
    </PageLayout>
  );
}