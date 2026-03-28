import {
  getSubmissionCompletionCountsByUser,
  type RoundSubmissionMode,
  type SubmissionCompletionLike,
} from "@/lib/rounds/submission-completion";

type IdLike = string | { toString(): string };

type ImmediateAutoVotingWarningArgs = {
  roundStatus: "scheduled" | "submissions" | "voting" | "finished";
  isFirstRound: boolean;
  submissionMode: RoundSubmissionMode;
  submissionsPerUser: number;
  activeMemberCount: number;
  currentUserId: IdLike;
  submissions: SubmissionCompletionLike[] | undefined;
  additionalSubmissionUnits: number;
  hasIncompleteFileSubmissions: boolean;
};

export function willSubmissionImmediatelyStartVoting(
  args: ImmediateAutoVotingWarningArgs,
): boolean {
  if (
    args.roundStatus !== "submissions" ||
    args.isFirstRound ||
    args.activeMemberCount <= 0 ||
    args.additionalSubmissionUnits <= 0 ||
    args.hasIncompleteFileSubmissions
  ) {
    return false;
  }

  const counts = getSubmissionCompletionCountsByUser(
    args.submissions,
    args.submissionMode,
  );
  const currentUserId = args.currentUserId.toString();
  const currentUserCount = counts.get(currentUserId) ?? 0;

  if (currentUserCount >= args.submissionsPerUser) {
    return false;
  }

  const completedCount = Array.from(counts.values()).filter(
    (count) => count >= args.submissionsPerUser,
  ).length;
  const currentUserWillBeComplete =
    currentUserCount + args.additionalSubmissionUnits >= args.submissionsPerUser;

  return currentUserWillBeComplete && completedCount === args.activeMemberCount - 1;
}
