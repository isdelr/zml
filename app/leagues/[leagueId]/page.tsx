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
          <LeaguePage leagueId={leagueId} />
        </div>
      </div>
    </>
  );
}
