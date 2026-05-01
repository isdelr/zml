import { describe, expect, it } from "vitest";

import { buildLeagueRankings } from "@/lib/convex-server/leagues/ranking";

describe("buildLeagueRankings", () => {
  it("keeps higher point totals ahead without tie-break metadata", () => {
    const rankings = buildLeagueRankings({
      standings: [
        { userId: "user-a" as never, totalPoints: 30, totalWins: 2 },
        { userId: "user-b" as never, totalPoints: 18, totalWins: 1 },
      ],
      roundResults: [
        { roundId: "round-1" as never, userId: "user-a" as never, points: 12 },
        { roundId: "round-1" as never, userId: "user-b" as never, points: 8 },
      ],
      userNamesById: new Map([
        ["user-a", "Avery"],
        ["user-b", "Blake"],
      ]),
    });

    expect(rankings.map((entry) => entry.userId)).toEqual([
      "user-a",
      "user-b",
    ]);
    expect(rankings[0]?.wonOnTieBreak).toBe(false);
    expect(rankings[1]?.wonOnTieBreak).toBe(false);
  });

  it("breaks a points tie using counts of first-place finishes", () => {
    const rankings = buildLeagueRankings({
      standings: [
        { userId: "user-a" as never, totalPoints: 20, totalWins: 2 },
        { userId: "user-b" as never, totalPoints: 20, totalWins: 1 },
      ],
      roundResults: [
        { roundId: "round-1" as never, userId: "user-a" as never, points: 10 },
        { roundId: "round-1" as never, userId: "user-b" as never, points: 8 },
        { roundId: "round-2" as never, userId: "user-a" as never, points: 4 },
        { roundId: "round-2" as never, userId: "user-b" as never, points: 10 },
        { roundId: "round-3" as never, userId: "user-a" as never, points: 9 },
        { roundId: "round-3" as never, userId: "user-b" as never, points: 7 },
      ],
      userNamesById: new Map([
        ["user-a", "Avery"],
        ["user-b", "Blake"],
      ]),
    });

    expect(rankings.map((entry) => entry.userId)).toEqual([
      "user-a",
      "user-b",
    ]);
    expect(rankings[0]?.wonOnTieBreak).toBe(true);
    expect(rankings[0]?.tieBreakSummary).toContain("1st-place finishes");
    expect(rankings[1]?.wonOnTieBreak).toBe(false);
  });

  it("falls through to deeper placements when first-place counts are tied", () => {
    const rankings = buildLeagueRankings({
      standings: [
        { userId: "user-a" as never, totalPoints: 15, totalWins: 1 },
        { userId: "user-b" as never, totalPoints: 15, totalWins: 1 },
        { userId: "user-c" as never, totalPoints: 21, totalWins: 1 },
      ],
      roundResults: [
        { roundId: "round-1" as never, userId: "user-a" as never, points: 10 },
        { roundId: "round-1" as never, userId: "user-b" as never, points: 10 },
        { roundId: "round-1" as never, userId: "user-c" as never, points: 8 },
        { roundId: "round-2" as never, userId: "user-a" as never, points: 7 },
        { roundId: "round-2" as never, userId: "user-b" as never, points: 6 },
        { roundId: "round-2" as never, userId: "user-c" as never, points: 9 },
      ],
      userNamesById: new Map([
        ["user-a", "Avery"],
        ["user-b", "Blake"],
        ["user-c", "Casey"],
      ]),
    });

    expect(rankings.map((entry) => entry.userId)).toEqual([
      "user-c",
      "user-a",
      "user-b",
    ]);
    expect(rankings[1]?.wonOnTieBreak).toBe(true);
    expect(rankings[1]?.tieBreakSummary).toContain("2nd-place finishes");
  });

  it("assigns the same round placement to tied users", () => {
    const rankings = buildLeagueRankings({
      standings: [
        { userId: "user-a" as never, totalPoints: 10, totalWins: 1 },
        { userId: "user-b" as never, totalPoints: 10, totalWins: 1 },
        { userId: "user-c" as never, totalPoints: 8, totalWins: 0 },
      ],
      roundResults: [
        { roundId: "round-1" as never, userId: "user-a" as never, points: 10 },
        { roundId: "round-1" as never, userId: "user-b" as never, points: 10 },
        { roundId: "round-1" as never, userId: "user-c" as never, points: 5 },
      ],
      userNamesById: new Map([
        ["user-a", "Avery"],
        ["user-b", "Blake"],
        ["user-c", "Casey"],
      ]),
    });

    expect(rankings[0]?.placementCounts).toEqual([{ placement: 1, count: 1 }]);
    expect(rankings[1]?.placementCounts).toEqual([{ placement: 1, count: 1 }]);
    expect(rankings[2]?.placementCounts).toEqual([{ placement: 3, count: 1 }]);
  });

  it("uses summed round points across multiple submissions for placement", () => {
    const rankings = buildLeagueRankings({
      standings: [
        { userId: "user-a" as never, totalPoints: 9, totalWins: 1 },
        { userId: "user-b" as never, totalPoints: 8, totalWins: 0 },
      ],
      roundResults: [
        { roundId: "round-1" as never, userId: "user-a" as never, points: 5 },
        { roundId: "round-1" as never, userId: "user-a" as never, points: 4 },
        { roundId: "round-1" as never, userId: "user-b" as never, points: 8 },
      ],
      userNamesById: new Map([
        ["user-a", "Avery"],
        ["user-b", "Blake"],
      ]),
    });

    expect(rankings[0]?.userId).toBe("user-a");
    expect(rankings[0]?.placementCounts).toEqual([{ placement: 1, count: 1 }]);
    expect(rankings[1]?.placementCounts).toEqual([{ placement: 2, count: 1 }]);
  });

  it("falls back deterministically when placement profiles are also tied", () => {
    const rankings = buildLeagueRankings({
      standings: [
        { userId: "user-b" as never, totalPoints: 10, totalWins: 1 },
        { userId: "user-a" as never, totalPoints: 10, totalWins: 1 },
      ],
      roundResults: [
        { roundId: "round-1" as never, userId: "user-a" as never, points: 9 },
        { roundId: "round-1" as never, userId: "user-b" as never, points: 9 },
      ],
      userNamesById: new Map([
        ["user-a", "Avery"],
        ["user-b", "Blake"],
      ]),
    });

    expect(rankings.map((entry) => entry.userId)).toEqual([
      "user-a",
      "user-b",
    ]);
    expect(rankings[0]?.wonOnTieBreak).toBe(false);
    expect(rankings[0]?.tieBreakSummary).toBeNull();
  });
});
