import dynamic from "next/dynamic";

const AdminSeedPage = dynamic(() => import("@/components/AdminSeedPage"));

export default function SeedPageRoute() {
  return <AdminSeedPage />;
}
