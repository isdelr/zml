export type VoteSummaryDetail = {
  voterId: string;
  voterName?: string | null;
  voterImage?: string | null;
  score: number;
  isDiscarded?: boolean;
  isAdminAdjustment?: boolean;
};

export type VoteScoreGroup = {
  score: number;
  isDiscarded: boolean;
  users: {
    _id: string;
    name?: string | null;
    image?: string | null;
    isAdminAdjustment?: boolean;
  }[];
};

export function groupVoteSummaryDetailsByScore(
  votes: VoteSummaryDetail[],
): VoteScoreGroup[] {
  const groups = new Map<
    string,
    Pick<VoteScoreGroup, "score" | "isDiscarded" | "users">
  >();

  for (const vote of votes) {
    const isDiscarded = vote.isDiscarded ?? false;
    const key = `${vote.score}:${isDiscarded ? "discarded" : "applied"}`;
    const group = groups.get(key) ?? {
      score: vote.score,
      isDiscarded,
      users: [],
    };
    const users = group.users;
    users.push({
      _id: vote.voterId,
      name: vote.voterName ?? null,
      image: vote.voterImage ?? null,
      isAdminAdjustment: vote.isAdminAdjustment ?? false,
    });
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map(({ score, isDiscarded, users }) => ({
      score,
      isDiscarded,
      users: [...users].sort((a, b) => {
        if (a.isAdminAdjustment !== b.isAdminAdjustment) {
          return a.isAdminAdjustment ? -1 : 1;
        }
        const nameCompare = (a.name ?? "").localeCompare(b.name ?? "");
        if (nameCompare !== 0) return nameCompare;
        return a._id.localeCompare(b._id);
      }),
    }))
    .sort(
      (a, b) =>
        b.score - a.score || Number(a.isDiscarded) - Number(b.isDiscarded),
    );
}

export function formatVoteScore(score: number) {
  if (score > 0) return `+${score}`;
  return `${score}`;
}
