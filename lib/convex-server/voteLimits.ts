type VoteLimitDefaults = {
  maxPositiveVotes: number;
  maxNegativeVotes: number;
};

type VoteLimitOverrides = {
  maxPositiveVotes?: number | null;
  maxNegativeVotes?: number | null;
};

export function getVoteLimits(
  overrides: VoteLimitOverrides,
  defaults: VoteLimitDefaults,
) {
  return {
    maxUp: overrides.maxPositiveVotes ?? defaults.maxPositiveVotes,
    maxDown: overrides.maxNegativeVotes ?? defaults.maxNegativeVotes,
  };
}
