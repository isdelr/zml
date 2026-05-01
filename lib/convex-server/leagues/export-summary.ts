import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { buildLeagueRankings, type LeagueRankingEntry } from "./ranking";

type LeagueExportStandingSnapshot = {
  userId: Id<"users">;
  totalPoints: number;
  totalWins: number;
};

type LeagueExportRoundResultSnapshot = Pick<
  Doc<"roundResults">,
  "roundId" | "userId" | "points" | "isWinner"
>;

type LeagueExportFinishedRoundSnapshot = Pick<Doc<"rounds">, "_id">;

export type LeagueExportRoundStandingsSnapshot = {
  roundId: Id<"rounds">;
  standings: LeagueRankingEntry[];
};

export function buildLeagueExportRoundStandingsSnapshots(args: {
  finishedRounds: LeagueExportFinishedRoundSnapshot[];
  roundResults: LeagueExportRoundResultSnapshot[];
  userNamesById: Map<string, string>;
}) {
  const roundResultsByRoundId = new Map<string, LeagueExportRoundResultSnapshot[]>();
  for (const result of args.roundResults) {
    const roundKey = result.roundId.toString();
    const results = roundResultsByRoundId.get(roundKey) ?? [];
    results.push(result);
    roundResultsByRoundId.set(roundKey, results);
  }

  const cumulativePointsByUserId = new Map<string, number>();
  const cumulativeWinsByUserId = new Map<string, number>();
  const includedUserIds = new Set<string>();
  const processedRoundResults: LeagueExportRoundResultSnapshot[] = [];

  return args.finishedRounds.map((round) => {
    const roundKey = round._id.toString();
    const roundResults = roundResultsByRoundId.get(roundKey) ?? [];

    for (const result of roundResults) {
      const userKey = result.userId.toString();
      includedUserIds.add(userKey);
      cumulativePointsByUserId.set(
        userKey,
        (cumulativePointsByUserId.get(userKey) ?? 0) + result.points,
      );
      if (result.isWinner) {
        cumulativeWinsByUserId.set(
          userKey,
          (cumulativeWinsByUserId.get(userKey) ?? 0) + 1,
        );
      } else if (!cumulativeWinsByUserId.has(userKey)) {
        cumulativeWinsByUserId.set(userKey, 0);
      }
      processedRoundResults.push(result);
    }

    const standings: LeagueExportStandingSnapshot[] = [...includedUserIds].map(
      (userId) => ({
        userId: userId as Id<"users">,
        totalPoints: cumulativePointsByUserId.get(userId) ?? 0,
        totalWins: cumulativeWinsByUserId.get(userId) ?? 0,
      }),
    );

    return {
      roundId: round._id,
      standings: buildLeagueRankings({
        standings,
        roundResults: processedRoundResults,
        userNamesById: args.userNamesById,
      }),
    };
  });
}
