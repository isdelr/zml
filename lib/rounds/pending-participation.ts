type IdLike = string | { toString(): string };

type MemberLike = {
  _id: IdLike;
};

type SubmissionLike = {
  userId: IdLike;
};

type VoteLike = {
  userId: IdLike;
  vote: number;
};

type PendingParticipationArgs = {
  status: "submissions" | "voting";
  members: MemberLike[] | undefined;
  submissions: SubmissionLike[] | undefined;
  submissionsPerUser: number;
  votes?: VoteLike[] | undefined;
  maxUp?: number;
  maxDown?: number;
};

const toId = (value: IdLike) => value.toString();

export function getPendingSubmissionParticipantIds(
  members: MemberLike[] | undefined,
  submissions: SubmissionLike[] | undefined,
  submissionsPerUser: number,
): string[] {
  const memberIds = (members ?? []).map((member) => toId(member._id));
  if (memberIds.length === 0) {
    return [];
  }

  const submissionCounts = new Map<string, number>();
  for (const submission of submissions ?? []) {
    const userId = toId(submission.userId);
    submissionCounts.set(userId, (submissionCounts.get(userId) ?? 0) + 1);
  }

  return memberIds.filter(
    (memberId) => (submissionCounts.get(memberId) ?? 0) < submissionsPerUser,
  );
}

export function getPendingVotingParticipantIds(
  members: MemberLike[] | undefined,
  submissions: SubmissionLike[] | undefined,
  votes: VoteLike[] | undefined,
  maxUp: number,
  maxDown: number,
): string[] {
  const memberIds = new Set((members ?? []).map((member) => toId(member._id)));
  if (memberIds.size === 0) {
    return [];
  }

  const eligibleVoterIds = [
    ...new Set(
      (submissions ?? [])
        .map((submission) => toId(submission.userId))
        .filter((userId) => memberIds.has(userId)),
    ),
  ];
  if (eligibleVoterIds.length === 0) {
    return [];
  }

  const voteTotals = new Map<string, { up: number; down: number }>();
  for (const vote of votes ?? []) {
    const userId = toId(vote.userId);
    const current = voteTotals.get(userId) ?? { up: 0, down: 0 };
    if (vote.vote > 0) {
      current.up += vote.vote;
    } else if (vote.vote < 0) {
      current.down += Math.abs(vote.vote);
    }
    voteTotals.set(userId, current);
  }

  return eligibleVoterIds.filter((userId) => {
    const totals = voteTotals.get(userId) ?? { up: 0, down: 0 };
    return totals.up < maxUp || totals.down < maxDown;
  });
}

export function getPendingRoundParticipantIds(
  args: PendingParticipationArgs,
): string[] {
  if (args.status === "submissions") {
    return getPendingSubmissionParticipantIds(
      args.members,
      args.submissions,
      args.submissionsPerUser,
    );
  }

  return getPendingVotingParticipantIds(
    args.members,
    args.submissions,
    args.votes,
    args.maxUp ?? 0,
    args.maxDown ?? 0,
  );
}
