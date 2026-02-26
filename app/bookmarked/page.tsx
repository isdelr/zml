import { PageLayout } from "@/components/layout/PageLayout";
import type { Metadata } from 'next';
import { BookmarkedPage } from "@/components/BookMarkedPage";

export const metadata: Metadata = {
  title: 'Bookmarked Songs',
  description: 'All your saved tracks in one place. Revisit the best songs you\'ve discovered from your music leagues.',
};

export default function Bookmarked() {
  return (
    <PageLayout>
      <BookmarkedPage />
    </PageLayout>
  );
}
