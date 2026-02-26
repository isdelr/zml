import { PageLayout } from "@/components/layout/PageLayout";
import type { Metadata } from 'next';
import { ActiveRoundsPage } from "@/components/ActiveRoundsPage";

export const metadata: Metadata = {
  title: 'Active Rounds',
  description: 'View all your active rounds. See which rounds are open for submissions and which are currently in the voting phase.',
};

export default function ActiveRounds() {
  return (
    <PageLayout>
      <ActiveRoundsPage />
    </PageLayout>
  );
}
