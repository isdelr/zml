import { PageLayout } from "@/components/layout/PageLayout";
import type { Metadata } from 'next';
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { ExplorePage } from "@/components/ExplorePage";

export const metadata: Metadata = {
  title: 'Explore Leagues',
  description: 'Discover public music leagues to join and compete with other music enthusiasts.',
};

export default async function ExploreLeaguesPage() {
  const preloadedLeagues = await preloadQuery(api.leagues.getPublicLeagues);
  
  return (
    <PageLayout>
      <ExplorePage preloadedLeagues={preloadedLeagues} />
    </PageLayout>
  );
}