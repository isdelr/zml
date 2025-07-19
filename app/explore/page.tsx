import { ExplorePage } from "@/components/ExplorePage";
import { Sidebar } from "@/components/Sidebar";

export default function ExploreLeaguesPage() {
  return (
    <div className="flex h-screen ">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <ExplorePage />
      </div>
    </div>
  );
}