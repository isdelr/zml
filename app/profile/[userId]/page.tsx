import { dynamicImport } from "@/components/ui/dynamic-import";
import { PageLayout } from "@/components/layout/PageLayout";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";

 
const ProfilePage = dynamicImport(() => import("@/components/ProfilePage").then(mod => ({ default: mod.ProfilePage })));

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function generateMetadata(
  props: {
    params: Promise<{ userId: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
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
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return (
    <PageLayout>
      <ProfilePage userId={userId} />
    </PageLayout>
  );
}