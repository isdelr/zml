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
  params: Promise<{ leagueId: string }>;
}): Promise<Metadata> {
  const { leagueId } = await params;

  let leagueMetadata;
  try {
    leagueMetadata = await convex.query(api.leagues.getLeagueMetadata, {
      leagueId: leagueId as Id<"leagues">,
    });
  } catch {
    return { title: "League" };
  }

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
  const url = `https://zml.app/leagues/${leagueId}`;
  const ogImageUrl = `/api/og/league?leagueId=${leagueId}`;

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
  params: Promise<{ leagueId: string }>;
}) {
  await params;
  return null;
}
