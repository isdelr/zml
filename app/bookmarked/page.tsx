import { BookmarkedPage } from "@/components/BookMarkedPage";
import { Sidebar } from "@/components/Sidebar";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bookmarked Songs',
  description: 'All your saved tracks in one place. Revisit the best songs you\'ve discovered from your music leagues.',
};

export default function Bookmarked() {
  return (
    <div className="flex h-screen ">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <BookmarkedPage />
      </div>
    </div>
  );
}