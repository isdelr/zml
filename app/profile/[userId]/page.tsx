import { ProfilePage } from "@/components/ProfilePage";
import { Sidebar } from "@/components/Sidebar";

export default async function Profile({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {

  const { userId } = await params;
  
  return (
    <div className="flex h-screen ">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <ProfilePage userId={userId} />
      </div>
    </div>
  );
}