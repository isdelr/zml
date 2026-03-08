export type VoteSummaryDetail = {
  voterId: string;
  voterName?: string | null;
  voterImage?: string | null;
  score: number;
};

export type VoteScoreGroup = {
  score: number;
  users: {
    _id: string;
    name?: string | null;
    image?: string | null;
  }[];
};

export function groupVoteSummaryDetailsByScore(
  votes: VoteSummaryDetail[],
): VoteScoreGroup[] {
  const groups = new Map<number, VoteScoreGroup["users"]>();

  for (const vote of votes) {
    const users = groups.get(vote.score) ?? [];
    users.push({
      _id: vote.voterId,
      name: vote.voterName ?? null,
      image: vote.voterImage ?? null,
    });
    groups.set(vote.score, users);
  }

  return Array.from(groups.entries())
    .map(([score, users]) => ({
      score,
      users: [...users].sort((a, b) => {
        const nameCompare = (a.name ?? "").localeCompare(b.name ?? "");
        if (nameCompare !== 0) return nameCompare;
        return a._id.localeCompare(b._id);
      }),
    }))
    .sort((a, b) => b.score - a.score);
}

export function formatVoteScore(score: number) {
  if (score > 0) return `+${score}`;
  return `${score}`;
}
