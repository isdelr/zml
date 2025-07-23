import { dynamicImport } from "@/components/ui/dynamic-import";
import { PageLayout } from "@/components/layout/PageLayout";
import type { Metadata } from 'next';

 
const BookmarkedPage = dynamicImport(() => import("@/components/BookMarkedPage").then(mod => ({ default: mod.BookmarkedPage })));

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