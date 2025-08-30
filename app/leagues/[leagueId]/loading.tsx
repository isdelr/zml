import { PageLayout } from "@/components/layout/PageLayout";
import PageListSkeleton from "@/components/loading/PageSkeleton";

export default function Loading() {
  return (
    <PageLayout>
      <PageListSkeleton />
    </PageLayout>
  );
}