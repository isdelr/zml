export const MAX_LEAGUE_UPVOTES_PER_MEMBER = 99;
export const MAX_LEAGUE_DOWNVOTES_PER_MEMBER = 99;

export function getDefaultPositiveVotesPerSubmission(maxPositiveVotes: number) {
  return Math.max(1, Math.ceil(maxPositiveVotes / 2));
}

export function getDefaultNegativeVotesPerSubmission(maxNegativeVotes: number) {
  return Math.max(1, Math.floor(maxNegativeVotes / 4));
}
