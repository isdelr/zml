import { LeaguePage } from "@/components/LeaguePage"
import { Sidebar } from "@/components/Sidebar";

export default function Home() {
  return (
    <>
      <div className="flex h-screen ">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          {/* We now render LeaguePage instead of MainContent directly */}
          <LeaguePage />
          {/* Spacer for the music player */}
          <div className="h-24" />
        </div>
      </div>
    </>
  );
}