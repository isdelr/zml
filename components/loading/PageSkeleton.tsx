import { Skeleton } from "@/components/ui/skeleton";

export function PageListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="size-10 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
              <div className="hidden gap-2 md:flex">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PageListSkeleton;
