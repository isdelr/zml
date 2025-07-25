import { PageLayout } from "@/components/layout/PageLayout";
import type { Metadata } from 'next';
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { BookmarkedPage } from "@/components/BookMarkedPage";

export const metadata: Metadata = {
  title: 'Bookmarked Songs',
  description: 'All your saved tracks in one place. Revisit the best songs you\'ve discovered from your music leagues.',
};

export default async function Bookmarked() {
  const preloadedBookmarkedSongs = await preloadQuery(api.bookmarks.getBookmarkedSongs);

  return (
    <PageLayout>
      <BookmarkedPage preloadedBookmarkedSongs={preloadedBookmarkedSongs} />
    </PageLayout>
  );
}