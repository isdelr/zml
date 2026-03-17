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

export function getVoteLimitSnapshotPatch(
  overrides: VoteLimitOverrides,
  defaults: VoteLimitDefaults,
) {
  const patch: VoteLimitOverrides = {};

  if (overrides.maxPositiveVotes == null) {
    patch.maxPositiveVotes = defaults.maxPositiveVotes;
  }

  if (overrides.maxNegativeVotes == null) {
    patch.maxNegativeVotes = defaults.maxNegativeVotes;
  }

  return patch;
}
