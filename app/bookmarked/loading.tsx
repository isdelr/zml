import { PageLayout } from "@/components/layout/PageLayout";

export default function Loading() {
  return (
    <PageLayout>
      <div className="flex h-[50vh] items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    </PageLayout>
  );
}