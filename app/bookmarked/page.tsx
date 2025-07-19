import { BookmarkedPage } from "@/components/BookmarkedPage";
import { Sidebar } from "@/components/Sidebar";

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