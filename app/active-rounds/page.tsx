import { PageLayout } from "@/components/layout/PageLayout";
import type { Metadata } from 'next';
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { ActiveRoundsPage } from "@/components/ActiveRoundsPage";

export const metadata: Metadata = {
  title: 'Active Rounds',
  description: 'View all your active rounds. See which rounds are open for submissions and which are currently in the voting phase.',
};

export default async function ActiveRounds() {
  const preloadedActiveRounds = await preloadQuery(api.rounds.getActiveForUser);

  return (
    <PageLayout>
      <ActiveRoundsPage preloadedActiveRounds={preloadedActiveRounds} />
    </PageLayout>
  );
}