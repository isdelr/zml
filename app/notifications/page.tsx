import { dynamicImport } from "@/components/ui/dynamic-import";
import { PageLayout } from "@/components/layout/PageLayout";
import type { Metadata } from 'next';

// Dynamically import the NotificationsPage component
const NotificationsPage = dynamicImport(() => import("@/components/NotificationsPage").then(mod => ({ default: mod.default })));

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Stay updated with the latest activity in your leagues. See comments, round updates, and more.',
};

export default function Notifications() {
  return (
    <PageLayout>
      <NotificationsPage />
    </PageLayout>
  );
}