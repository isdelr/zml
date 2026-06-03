export type StandardVoteLike = {
  userId: string;
  vote: number;
};

export type SubmissionPenaltyLike = {
  userId: string;
  isTrollSubmission?: boolean | null;
};

export function getFinalizedVoterIdSet(
  votes: Iterable<StandardVoteLike>,
  maxUp: number,
  maxDown: number,
): Set<string> {
  const budgetByUser = new Map<string, { up: number; down: number }>();

  for (const vote of votes) {
    const key = vote.userId.toString();
    const entry = budgetByUser.get(key) ?? { up: 0, down: 0 };
    if (vote.vote > 0) entry.up += vote.vote;
    else if (vote.vote < 0) entry.down += Math.abs(vote.vote);
    budgetByUser.set(key, entry);
  }

  const finalizedVoters = new Set<string>();
  for (const [userId, { up, down }] of budgetByUser.entries()) {
    if (up === maxUp && down === maxDown) {
      finalizedVoters.add(userId);
    }
  }

  return finalizedVoters;
}

export function isSubmissionPenalized(
  submission: SubmissionPenaltyLike,
  finalizedVoterIds: ReadonlySet<string>,
): boolean {
  return (
    !finalizedVoterIds.has(submission.userId.toString()) ||
    submission.isTrollSubmission === true
  );
}

export function getEffectiveStandardVoteScore(
  vote: StandardVoteLike,
  submission: SubmissionPenaltyLike,
  finalizedVoterIds: ReadonlySet<string>,
): number {
  if (vote.vote <= 0) {
    return vote.vote;
  }

  if (!finalizedVoterIds.has(vote.userId.toString())) {
    return 0;
  }

  if (isSubmissionPenalized(submission, finalizedVoterIds)) {
    return 0;
  }

  return vote.vote;
}

export function getEffectiveStandardVoteTotal(
  votes: Iterable<StandardVoteLike>,
  submission: SubmissionPenaltyLike,
  finalizedVoterIds: ReadonlySet<string>,
): number {
  let total = 0;
  for (const vote of votes) {
    total += getEffectiveStandardVoteScore(vote, submission, finalizedVoterIds);
  }
  return total;
}
