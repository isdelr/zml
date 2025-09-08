import { PageLayout } from "@/components/layout/PageLayout";
import dynamic from "next/dynamic";

const AdminSeedPage = dynamic(() => import("@/components/AdminSeedPage"));

export default function SeedPageRoute() {
  return (
    <PageLayout>
      <AdminSeedPage />
    </PageLayout>
  );
}
