"use client";

import { Progress } from "@/components/ui/progress";

interface UploadProgressStatusProps {
  progress?: number | null;
  isVisible: boolean;
  title: string;
  description?: string;
}

export function UploadProgressStatus({
  progress,
  isVisible,
  title,
  description,
}: UploadProgressStatusProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-secondary/30 p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4 text-sm">
          <div>
            <p className="font-medium">{title}</p>
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {typeof progress === "number" ? (
            <span className="font-medium">{progress}%</span>
          ) : null}
        </div>
        {typeof progress === "number" ? (
          <Progress value={progress} className="h-2" />
        ) : null}
      </div>
    </div>
  );
}
