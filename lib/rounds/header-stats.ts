type RoundHeaderSubmission = {
  duration?: number | null;
};

type RoundStatus = "scheduled" | "submissions" | "voting" | "finished";

export function getRoundHeaderStats(
  roundStatus: RoundStatus,
  submissions: RoundHeaderSubmission[] | undefined,
) {
  if (roundStatus === "scheduled" || !submissions || submissions.length === 0) {
    return {
      submissionCount: 0,
      totalDurationSeconds: 0,
    };
  }

  return {
    submissionCount: submissions.length,
    totalDurationSeconds: submissions.reduce(
      (total, submission) => total + (submission.duration ?? 0),
      0,
    ),
  };
}
