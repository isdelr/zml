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
      openGraph: {
        title: "ZML | League Not Found",
        description:
          "This league does not exist or you may not have permission to view it.",
        type: "website",
      },
      twitter: {
        card: "summary",
        title: "ZML | League Not Found",
        description:
          "This league does not exist or you may not have permission to view it.",
      },
    };
  }

  const title = leagueMetadata.name;
  const description = `View the rounds, standings, and stats for the "${leagueMetadata.name}" music league. ${leagueMetadata.memberCount} ${leagueMetadata.memberCount === 1 ? "member" : "members"} competing for musical supremacy.`;
  const url = `https://zml.app/leagues/${params.leagueId}`;
  const ogImageUrl = `/api/og/league?leagueId=${params.leagueId}`;

  return {
    title,
    description,
    openGraph: {
      title: `ZML | ${title}`,
      description,
      type: "website",
      url,
      siteName: "ZML",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${leagueMetadata.name} on ZML`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `ZML | ${title}`,
      description,
      images: [ogImageUrl],
    },
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