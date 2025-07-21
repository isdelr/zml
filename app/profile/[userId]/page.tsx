import { ProfilePage } from "@/components/ProfilePage";
import { Sidebar } from "@/components/Sidebar";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";

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
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return (
    <div className="flex h-screen ">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <ProfilePage userId={userId} />
      </div>
    </div>
  );
}
