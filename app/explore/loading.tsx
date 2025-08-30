import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageLayout>
      <div className="p-4 md:p-8">
        <div className="mb-6">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="aspect-square w-full rounded-md" />
                <Skeleton className="mb-1 mt-4 h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-5 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}