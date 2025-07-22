import { dynamicImport } from "@/components/ui/dynamic-import";
import { PageLayout } from "@/components/layout/PageLayout";
import type { Metadata } from 'next';

// Dynamically import the ExplorePage component
const ExplorePage = dynamicImport(() => import("@/components/ExplorePage").then(mod => ({ default: mod.ExplorePage })));

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