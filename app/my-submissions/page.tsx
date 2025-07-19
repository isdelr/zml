import { MySubmissionsPage } from "@/components/MySubmissionsPage";
import { Sidebar } from "@/components/Sidebar";

export default function MySubmissions() {
  return (
    <div className="flex h-screen ">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <MySubmissionsPage />
      </div>
    </div>
  );
}