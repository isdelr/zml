 

import { PageLayout } from "@/components/layout/PageLayout";
import { LeaguePage } from "@/components/LeaguePage";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";

 
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

 
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

   
  const title = `${roundTitle} - A Round in ${leagueName}`;
  const description = `Current Status: Now open for submissions! | ${roundDescription}`;

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
       
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
