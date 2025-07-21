import { ActiveRoundsPage } from "@/components/ActiveRoundsPage";
import { Sidebar } from "@/components/Sidebar";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Active Rounds',
  description: 'View all your active rounds. See which rounds are open for submissions and which are currently in the voting phase.',
};

export default function ActiveRounds() {
  return (
    <div className="flex h-screen ">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <ActiveRoundsPage />
      </div>
    </div>
  );
}