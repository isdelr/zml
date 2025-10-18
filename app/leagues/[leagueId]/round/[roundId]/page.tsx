import { PageLayout } from "@/components/layout/PageLayout";
import { LeaguePage } from "@/components/LeaguePage";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function generateMetadata({
                                         params,
                                       }: {
  params: { leagueId: string; roundId: string };
}): Promise<Metadata> {
  const metadata = await convex.query(api.rounds.getRoundMetadata, {
    roundId: params.roundId as Id<"rounds">,
  });

  if (!metadata) {
    return {
      title: "Round Not Found",
      description: "This round does not exist or has been moved.",
      openGraph: {
        title: "ZML | Round Not Found",
        description: "This round does not exist or has been moved.",
        type: "website",
      },
      twitter: {
        card: "summary",
        title: "ZML | Round Not Found",
        description: "This round does not exist or has been moved.",
      },
    };
  }

  const { roundTitle, roundDescription, imageUrl, leagueName } = metadata;
  const title = `${roundTitle}`;
  const description = `${roundDescription} | A round in ${leagueName} on ZML`;
  const url = `https://zml.app/leagues/${params.leagueId}/round/${params.roundId}`;
  const ogImageUrl = imageUrl || `/api/og/round?roundId=${params.roundId}`;

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
          alt: `${roundTitle} in ${leagueName}`,
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

export default async function RoundPage({
                                          params,
                                        }: {
  params: { leagueId: string; roundId: string };
}) {
  return (
    <PageLayout>
      <LeaguePage leagueId={params.leagueId} />
    </PageLayout>
  );
}