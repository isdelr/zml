import { dynamicImport } from "@/components/ui/dynamic-import";
import { PageLayout } from "@/components/layout/PageLayout";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";

const ProfilePage = dynamicImport(() =>
  import("@/components/ProfilePage").then((mod) => ({ default: mod.ProfilePage })),
);

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function generateMetadata({
                                         params,
                                       }: {
  params: { userId: string };
}): Promise<Metadata> {
  const profile = await convex.query(api.users.getProfile, {
    userId: params.userId as Id<"users">,
  });

  if (!profile) {
    return {
      title: "User Not Found",
    };
  }

  return {
    title: `${profile.name}'s Profile`,
    description: `View the profile, stats, and league history for ${profile.name}. Leagues Joined: ${profile.stats.leaguesJoined}, Total Wins: ${profile.stats.totalWins}.`,
  };
}

export default async function Profile({
                                        params,
                                      }: {
  params: { userId: string };
}) {
  return (
    <PageLayout>
      <ProfilePage userId={params.userId} />
    </PageLayout>
  );
}