import { dynamicImport } from "@/components/ui/dynamic-import";
import { PageLayout } from "@/components/layout/PageLayout";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";

const LeaguePage = dynamicImport(() =>
  import("@/components/LeaguePage").then((mod) => ({
    default: mod.LeaguePage,
  })),
);

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function generateMetadata({
                                         params,
                                       }: {
  params: { leagueId: string };
}): Promise<Metadata> {
  const leagueMetadata = await convex.query(api.leagues.getLeagueMetadata, {
    id: params.leagueId as Id<"leagues">,
  });

  if (!leagueMetadata) {
    return {
      title: "League Not Found",
      description:
        "This league does not exist or you may not have permission to view it.",
    };
  }

  return {
    title: leagueMetadata.name,
    description: `View the rounds, standings, and stats for the "${leagueMetadata.name}" music league. Members: ${leagueMetadata.memberCount}.`,
};
}

export default async function League({
                                       params,
                                     }: {
  params: { leagueId: string };
}) {
  return (
    <PageLayout>
      <LeaguePage leagueId={params.leagueId} />
    </PageLayout>
  );
}