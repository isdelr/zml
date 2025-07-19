import { CreateLeaguePage } from "@/components/CreateLeaguePage";
import { Sidebar } from "@/components/Sidebar";

export default function CreateLeague() {
  return (
    <div className="flex h-screen ">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <CreateLeaguePage />
      </div>
    </div>
  );
}
