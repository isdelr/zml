export const submissionFileProcessingStatuses = [
  "queued",
  "converting",
  "ready",
  "failed",
] as const;

export type SubmissionFileProcessingStatus =
  (typeof submissionFileProcessingStatuses)[number];

type SubmissionProcessingShape = {
  submissionType: "file" | "youtube";
  songFileKey?: string | null;
  songLink?: string | null;
  fileProcessingStatus?: SubmissionFileProcessingStatus | null;
  fileProcessingError?: string | null;
};

export function getSubmissionFileProcessingStatus(
  submission: SubmissionProcessingShape,
): SubmissionFileProcessingStatus {
  if (submission.submissionType !== "file") {
    return "ready";
  }
  if (submission.fileProcessingStatus) {
    return submission.fileProcessingStatus;
  }
  return submission.songFileKey ? "ready" : "queued";
}

export function hasPendingSubmissionProcessing(
  submission: SubmissionProcessingShape,
): boolean {
  const status = getSubmissionFileProcessingStatus(submission);
  return status === "queued" || status === "converting";
}

export function isSubmissionPlayable(submission: SubmissionProcessingShape) {
  if (submission.submissionType !== "file") {
    return Boolean(submission.songLink);
  }
  return (
    getSubmissionFileProcessingStatus(submission) === "ready" &&
    Boolean(submission.songFileKey)
  );
}

export function getSubmissionProcessingCopy(
  status: SubmissionFileProcessingStatus,
) {
  switch (status) {
    case "queued":
      return {
        label: "Uploaded",
        description:
          "Your file is uploaded. We are getting it ready in the background, even if you leave this page.",
        className:
          "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
      };
    case "converting":
      return {
        label: "Processing",
        description:
          "We are getting your file ready now. It will be playable as soon as this finishes.",
        className:
          "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200",
      };
    case "failed":
      return {
        label: "Needs Attention",
        description:
          "We could not finish preparing this file. Edit the submission and upload it again.",
        className:
          "border-destructive/30 bg-destructive/10 text-destructive",
      };
    case "ready":
    default:
      return {
        label: "Ready",
        description:
          "Your song is ready. This is the version that will be used for playback and voting.",
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
      };
  }
}
