import { dynamicImport } from "@/components/ui/dynamic-import";
import { PageLayout } from "@/components/layout/PageLayout";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";

const ProfilePage = dynamicImport(() =>
  import("@/components/ProfilePage").then((mod) => ({ default: mod.ProfilePage })),
);

const convex = new ConvexHttpClient(
  (process.env.CONVEX_SELF_HOSTED_URL || process.env.NEXT_PUBLIC_CONVEX_URL)!,
);

export async function generateMetadata({
                                         params,
                                       }: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;

  let profile;
  try {
    profile = await convex.query(api.users.getProfile, {
      userId: userId as Id<"users">,
    });
  } catch {
    return { title: "Profile" };
  }

  if (!profile) {
    return {
      title: "User Not Found",
      description: "This user profile could not be found.",
    };
  }

  const title = `${profile.name}'s Profile`;
  const description = `View the profile, stats, and league history for ${profile.name}. Leagues Joined: ${profile.stats.leaguesJoined}, Total Wins: ${profile.stats.totalWins}.`;
  const url = `https://zml.app/profile/${userId}`;

  return {
    title,
    description,
    openGraph: {
      title: `ZML | ${title}`,
      description,
      type: "website",
      url,
      siteName: "ZML",
    },
    twitter: {
      card: "summary",
      title: `ZML | ${title}`,
      description,
    },
  };
}

export default async function Profile({
                                        params,
                                      }: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return (
    <PageLayout>
      <ProfilePage userId={userId} />
    </PageLayout>
  );
}