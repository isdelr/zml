"use client";

import { Progress } from "@/components/ui/progress";

interface UploadProgressStatusProps {
  progress: number;
  isSubmitting: boolean;
}

export function UploadProgressStatus({
  progress,
  isSubmitting,
}: UploadProgressStatusProps) {
  if (!isSubmitting || progress <= 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Upload Progress</span>
        <span className="font-medium">{progress}%</span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}
