import { describe, expect, it } from "vitest";

import { buildLeagueExportRoundStandingsSnapshots } from "@/lib/convex-server/leagues/export-summary";

describe("buildLeagueExportRoundStandingsSnapshots", () => {
  it("builds cumulative standings snapshots in finished-round order", () => {
    const snapshots = buildLeagueExportRoundStandingsSnapshots({
      finishedRounds: [{ _id: "round-1" as never }, { _id: "round-2" as never }],
      roundResults: [
        {
          roundId: "round-1" as never,
          userId: "user-a" as never,
          points: 10,
          isWinner: true,
        },
        {
          roundId: "round-1" as never,
          userId: "user-b" as never,
          points: 6,
          isWinner: false,
        },
        {
          roundId: "round-2" as never,
          userId: "user-a" as never,
          points: 4,
          isWinner: false,
        },
        {
          roundId: "round-2" as never,
          userId: "user-b" as never,
          points: 9,
          isWinner: true,
        },
        {
          roundId: "round-2" as never,
          userId: "user-c" as never,
          points: 0,
          isWinner: false,
        },
      ],
      userNamesById: new Map([
        ["user-a", "Avery"],
        ["user-b", "Blake"],
        ["user-c", "Casey"],
      ]),
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]?.standings.map((entry) => entry.userId)).toEqual([
      "user-a",
      "user-b",
    ]);
    expect(snapshots[0]?.standings[0]).toMatchObject({
      userId: "user-a",
      totalPoints: 10,
      totalWins: 1,
    });
    expect(snapshots[1]?.standings.map((entry) => entry.userId)).toEqual([
      "user-b",
      "user-a",
      "user-c",
    ]);
    expect(snapshots[1]?.standings[0]).toMatchObject({
      userId: "user-b",
      totalPoints: 15,
      totalWins: 1,
    });
    expect(snapshots[1]?.standings[1]).toMatchObject({
      userId: "user-a",
      totalPoints: 14,
      totalWins: 1,
    });
    expect(snapshots[1]?.standings[2]).toMatchObject({
      userId: "user-c",
      totalPoints: 0,
      totalWins: 0,
    });
  });
});
