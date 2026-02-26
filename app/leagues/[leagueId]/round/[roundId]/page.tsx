import { PageLayout } from "@/components/layout/PageLayout";
import { LeaguePage } from "@/components/LeaguePage";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";

const convex = new ConvexHttpClient(
  (process.env.CONVEX_SELF_HOSTED_URL || process.env.NEXT_PUBLIC_CONVEX_URL)!,
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ leagueId: string; roundId: string }>;
}): Promise<Metadata> {
  const { leagueId, roundId } = await params;

  let metadata;
  try {
    metadata = await convex.query(api.rounds.getRoundMetadata, {
      roundId: roundId as Id<"rounds">,
      includeImageUrl: false,
    });
  } catch {
    return { title: "Round" };
  }

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

  const { roundTitle, roundDescription, leagueName } = metadata;
  const title = `${roundTitle}`;
  const description = `${roundDescription} | A round in ${leagueName} on ZML`;
  const url = `https://zml.app/leagues/${leagueId}/round/${roundId}`;
  const ogImageUrl = `/api/og/round?roundId=${roundId}`;

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
  params: Promise<{ leagueId: string; roundId: string }>;
}) {
  const { leagueId } = await params;
  return (
    <PageLayout>
      <LeaguePage leagueId={leagueId} />
    </PageLayout>
  );
}
