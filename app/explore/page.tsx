import { PageLayout } from "@/components/layout/PageLayout";
import type { Metadata } from 'next';
import { ExplorePage } from "@/components/ExplorePage";

export const metadata: Metadata = {
  title: 'Explore Leagues',
  description: 'Discover public music leagues to join and compete with other music enthusiasts.',
};

export default function ExploreLeaguesPage() {
  return (
    <PageLayout>
      <ExplorePage />
    </PageLayout>
  );
}
