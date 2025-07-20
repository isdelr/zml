import { ProfilePage } from "@/components/ProfilePage";
import { Sidebar } from "@/components/Sidebar";

export default function Profile({ params }: { params: { userId: string } }) {
  return (
    <div className="flex h-screen ">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <ProfilePage userId={params.userId} />
      </div>
    </div>
  );
}