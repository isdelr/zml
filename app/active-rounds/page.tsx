import { ActiveRoundsPage } from "@/components/ActiveRoundsPage";
import { Sidebar } from "@/components/Sidebar";

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