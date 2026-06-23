export type RoundSubmissionMode = "single" | "multi" | "album";

export const MAX_SUBMISSIONS_PER_USER = 100;
export const MIN_MULTI_SUBMISSIONS_PER_USER = 2;

export function getSubmissionSettingsError({
  submissionsPerUser,
  submissionMode,
}: {
  submissionsPerUser: number;
  submissionMode: RoundSubmissionMode;
}) {
  if (
    !Number.isInteger(submissionsPerUser) ||
    submissionsPerUser < 1 ||
    submissionsPerUser > MAX_SUBMISSIONS_PER_USER
  ) {
    return `Submissions per user must be between 1 and ${MAX_SUBMISSIONS_PER_USER}.`;
  }

  if (submissionMode === "single" && submissionsPerUser !== 1) {
    return "Single song mode only allows 1 song per participant.";
  }

  if (
    submissionMode !== "single" &&
    submissionsPerUser < MIN_MULTI_SUBMISSIONS_PER_USER
  ) {
    return "Multiple song modes require at least 2 songs per participant.";
  }

  return null;
}
