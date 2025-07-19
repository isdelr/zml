import { LeaguePage } from "@/components/LeaguePage";
import { Sidebar } from "@/components/Sidebar";

export default async function League({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  return (
    <>
      <div className="flex h-screen ">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          {/* We now render LeaguePage instead of MainContent directly */}
          <LeaguePage leagueId={leagueId} />
          {/* Spacer for the music player */}
          <div className="h-24" />
        </div>
      </div>
    </>
  );
}
