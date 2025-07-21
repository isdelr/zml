import { LeaguePage } from "@/components/LeaguePage";
import { Sidebar } from "@/components/Sidebar";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function generateMetadata({
  params,
}: {
  params: { leagueId: string };
}): Promise<Metadata> {
  const league = await convex.query(api.leagues.get, { id: params.leagueId as Id<"leagues"> });

  if (!league) {
    return {
      title: "League Not Found",
      description: "This league does not exist or you may not have permission to view it.",
    };
  }

  return {
    title: league.name,
    description: `View the rounds, standings, and stats for the "${league.name}" music league. Members: ${league.memberCount}.`,
  };
}

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