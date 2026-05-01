import type { Doc, Id } from "../../../convex/_generated/dataModel";

type LeagueStandingSnapshot = Pick<
  Doc<"leagueStandings">,
  "userId" | "totalPoints" | "totalWins"
>;

type LeagueRoundResultSnapshot = Pick<
  Doc<"roundResults">,
  "roundId" | "userId" | "points"
>;

type PlacementProfile = {
  counts: Map<number, number>;
  maxPlacement: number;
};

type RankingBaseEntry = {
  userId: Id<"users">;
  totalPoints: number;
  totalWins: number;
  name: string;
  placementProfile: PlacementProfile;
};

export type LeagueRankingPlacementCount = {
  placement: number;
  count: number;
};

export type LeagueRankingEntry = {
  userId: Id<"users">;
  rank: number;
  totalPoints: number;
  totalWins: number;
  tiedOnPoints: boolean;
  wonOnTieBreak: boolean;
  tieBreakSummary: string | null;
  placementCounts: LeagueRankingPlacementCount[];
};

function formatOrdinal(value: number) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) {
    return `${value}th`;
  }

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function buildPlacementProfiles(
  roundResults: LeagueRoundResultSnapshot[],
): Map<string, PlacementProfile> {
  const roundPointsByUser = new Map<string, Map<string, number>>();

  for (const result of roundResults) {
    const roundKey = result.roundId.toString();
    const roundPoints =
      roundPointsByUser.get(roundKey) ?? new Map<string, number>();
    const userKey = result.userId.toString();
    roundPoints.set(userKey, (roundPoints.get(userKey) ?? 0) + result.points);
    roundPointsByUser.set(roundKey, roundPoints);
  }

  const placementProfiles = new Map<string, PlacementProfile>();

  for (const roundPoints of roundPointsByUser.values()) {
    const rankedUsers = [...roundPoints.entries()].sort((left, right) => {
      const pointsDifference = right[1] - left[1];
      if (pointsDifference !== 0) {
        return pointsDifference;
      }

      return left[0].localeCompare(right[0]);
    });

    let previousPoints: number | null = null;
    let currentPlacement = 0;

    rankedUsers.forEach(([userId, points], index) => {
      if (previousPoints === null || points !== previousPoints) {
        currentPlacement = index + 1;
        previousPoints = points;
      }

      const existingProfile = placementProfiles.get(userId) ?? {
        counts: new Map<number, number>(),
        maxPlacement: 0,
      };
      existingProfile.counts.set(
        currentPlacement,
        (existingProfile.counts.get(currentPlacement) ?? 0) + 1,
      );
      existingProfile.maxPlacement = Math.max(
        existingProfile.maxPlacement,
        currentPlacement,
      );
      placementProfiles.set(userId, existingProfile);
    });
  }

  return placementProfiles;
}

function comparePlacementProfiles(
  left: PlacementProfile,
  right: PlacementProfile,
  maxPlacement: number,
) {
  for (let placement = 1; placement <= maxPlacement; placement += 1) {
    const difference =
      (left.counts.get(placement) ?? 0) - (right.counts.get(placement) ?? 0);
    if (difference !== 0) {
      return difference > 0 ? 1 : -1;
    }
  }

  return 0;
}

function buildTieBreakSummary(
  winner: PlacementProfile,
  runnerUp: PlacementProfile,
  maxPlacement: number,
) {
  for (let placement = 1; placement <= maxPlacement; placement += 1) {
    const winnerCount = winner.counts.get(placement) ?? 0;
    const runnerUpCount = runnerUp.counts.get(placement) ?? 0;
    if (winnerCount === runnerUpCount) {
      continue;
    }

    return `Won tie-break with more ${formatOrdinal(placement)}-place finishes (${winnerCount} to ${runnerUpCount}).`;
  }

  return null;
}

export function buildLeagueRankings(args: {
  standings: LeagueStandingSnapshot[];
  roundResults: LeagueRoundResultSnapshot[];
  userNamesById: Map<string, string>;
}): LeagueRankingEntry[] {
  const placementProfiles = buildPlacementProfiles(args.roundResults);
  const maxPlacement = Math.max(
    0,
    ...[...placementProfiles.values()].map((profile) => profile.maxPlacement),
  );

  const rankingEntries: RankingBaseEntry[] = args.standings.map((standing) => ({
    userId: standing.userId,
    totalPoints: standing.totalPoints,
    totalWins: standing.totalWins,
    name: args.userNamesById.get(standing.userId.toString()) ?? "Unknown User",
    placementProfile: placementProfiles.get(standing.userId.toString()) ?? {
      counts: new Map<number, number>(),
      maxPlacement: 0,
    },
  }));

  const sortedEntries = [...rankingEntries].sort((left, right) => {
    const pointsDifference = right.totalPoints - left.totalPoints;
    if (pointsDifference !== 0) {
      return pointsDifference;
    }

    const placementDifference = comparePlacementProfiles(
      left.placementProfile,
      right.placementProfile,
      maxPlacement,
    );
    if (placementDifference !== 0) {
      return placementDifference > 0 ? -1 : 1;
    }

    const nameDifference = left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
    if (nameDifference !== 0) {
      return nameDifference;
    }

    return left.userId.toString().localeCompare(right.userId.toString());
  });

  const pointCounts = new Map<number, number>();
  for (const entry of sortedEntries) {
    pointCounts.set(entry.totalPoints, (pointCounts.get(entry.totalPoints) ?? 0) + 1);
  }

  return sortedEntries.map((entry, index) => {
    const nextSamePointsEntry =
      sortedEntries
        .slice(index + 1)
        .find((candidate) => candidate.totalPoints === entry.totalPoints) ?? null;
    const placementCounts = [...entry.placementProfile.counts.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([placement, count]) => ({ placement, count }));

    const wonOnTieBreak =
      nextSamePointsEntry !== null &&
      comparePlacementProfiles(
        entry.placementProfile,
        nextSamePointsEntry.placementProfile,
        maxPlacement,
      ) > 0;

    return {
      userId: entry.userId,
      rank: index + 1,
      totalPoints: entry.totalPoints,
      totalWins: entry.totalWins,
      tiedOnPoints: (pointCounts.get(entry.totalPoints) ?? 0) > 1,
      wonOnTieBreak,
      tieBreakSummary:
        wonOnTieBreak && nextSamePointsEntry
          ? buildTieBreakSummary(
              entry.placementProfile,
              nextSamePointsEntry.placementProfile,
              maxPlacement,
            )
          : null,
      placementCounts,
    };
  });
}
