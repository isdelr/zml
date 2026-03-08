"use client";

import { Badge } from "@/components/ui/badge";
import {
  getSubmissionFileProcessingStatus,
  getSubmissionProcessingCopy,
} from "@/lib/submission/file-processing";

type SubmissionProcessingStatusProps = {
  submission: {
    submissionType: "file" | "youtube";
    songFileKey?: string | null;
    fileProcessingStatus?: "queued" | "converting" | "ready" | "failed" | null;
    fileProcessingError?: string | null;
  };
  compact?: boolean;
};

export function SubmissionProcessingStatus({
  submission,
  compact = false,
}: SubmissionProcessingStatusProps) {
  if (submission.submissionType !== "file") {
    return null;
  }

  const status = getSubmissionFileProcessingStatus(submission);
  const copy = getSubmissionProcessingCopy(status);

  return (
    <div className={compact ? undefined : "space-y-2"}>
      <Badge variant="outline" className={copy.className}>
        {copy.label}
      </Badge>
    </div>
  );
}
