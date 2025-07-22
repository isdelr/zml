import { dynamicImport } from "@/components/ui/dynamic-import";
import { PageLayout } from "@/components/layout/PageLayout";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";

// Dynamically import the LeaguePage component
const LeaguePage = dynamicImport(() => import("@/components/LeaguePage").then(mod => ({ default: mod.LeaguePage })));

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}): Promise<Metadata> {
  const { leagueId } = await params;
  const league = await convex.query(api.leagues.get, { id: leagueId as Id<"leagues"> });

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
    <PageLayout>
      <LeaguePage leagueId={leagueId} />
    </PageLayout>
  );
}