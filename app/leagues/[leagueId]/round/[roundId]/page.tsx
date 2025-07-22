// app/leagues/[leagueId]/round/[roundId]/page.tsx

import { PageLayout } from "@/components/layout/PageLayout";
import { LeaguePage } from "@/components/LeaguePage";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";

// Initialize Convex client for server-side fetching
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// This is where the magic happens for embeds
export async function generateMetadata({
  params,
}: {
  params: { leagueId: string; roundId: string };
}): Promise<Metadata> {
  const metadata = await convex.query(api.rounds.getRoundMetadata, {
    roundId: params.roundId as unknown,
  });

  if (!metadata) {
    return {
      title: "Round Not Found",
      description: "This round does not exist or has been moved.",
    };
  }

  const { roundTitle, roundDescription, imageUrl, leagueName } = metadata;

  // Construct a compelling title and description for the embed
  const title = `${roundTitle} - A Round in ${leagueName}`;
  const description = `Current Status: Now open for submissions! | ${roundDescription}`;

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      // Provide an image for a visually appealing embed
      images: imageUrl ? [{ url: imageUrl }] : [],
      type: "website",
      url: `/leagues/${params.leagueId}/round/${params.roundId}`,
    },
    twitter: {
      card: "summary_large_image",
      title: title,
      description: description,
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

// This page will reuse your existing LeaguePage component.
// LeaguePage already has the logic to display a specific round based on URL params.
export default async function RoundPage({
  params,
}: {
  params: { leagueId: string; roundId: string };
}) {
  // We can pass the leagueId to the component, which will then use client-side
  // hooks to read the `roundId` from the URL and display the correct details.
  return (
    <PageLayout>
      <LeaguePage leagueId={params.leagueId} />
    </PageLayout>
  );
}
