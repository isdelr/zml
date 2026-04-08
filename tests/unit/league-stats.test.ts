import { describe, expect, it } from "vitest";

import {
  buildLeagueStatsChartRows,
  getLeagueStatsField,
  getLeagueStatsSeriesColor,
  type LeagueStatsTrajectoryData,
} from "@/lib/leagues/stats";

describe("league stats helpers", () => {
  it("flattens trajectory points into chart rows with cumulative metrics", () => {
    const trajectory: LeagueStatsTrajectoryData = {
      hasData: true,
      leagueStartAt: 100,
      rangeEndAt: 300,
      series: [
        { userId: "user-1", name: "Alex" },
        { userId: "user-2", name: "Sam" },
      ],
      points: [
        {
          key: "start",
          label: "League start",
          shortLabel: "Start",
          timestamp: 100,
          kind: "league_start",
          metrics: [
            {
              userId: "user-1",
              totalPoints: 0,
              rank: 1,
              upvotesReceived: 0,
              downvotesReceived: 0,
              pointsDelta: 0,
              upvotesDelta: 0,
              downvotesDelta: 0,
            },
            {
              userId: "user-2",
              totalPoints: 0,
              rank: 1,
              upvotesReceived: 0,
              downvotesReceived: 0,
              pointsDelta: 0,
              upvotesDelta: 0,
              downvotesDelta: 0,
            },
          ],
        },
        {
          key: "round-1",
          label: "Round 1",
          shortLabel: "R1",
          timestamp: 300,
          kind: "finished_round",
          roundId: "round-1",
          roundTitle: "Round 1",
          metrics: [
            {
              userId: "user-1",
              totalPoints: 5,
              rank: 1,
              upvotesReceived: 6,
              downvotesReceived: 1,
              pointsDelta: 5,
              upvotesDelta: 6,
              downvotesDelta: 1,
            },
            {
              userId: "user-2",
              totalPoints: -1,
              rank: 2,
              upvotesReceived: 1,
              downvotesReceived: 2,
              pointsDelta: -1,
              upvotesDelta: 1,
              downvotesDelta: 2,
            },
          ],
        },
      ],
    };

    const { rows, yDomain } = buildLeagueStatsChartRows(trajectory);

    expect(rows).toHaveLength(2);
    expect(rows[1][getLeagueStatsField("user-1", "points")]).toBe(5);
    expect(rows[1][getLeagueStatsField("user-1", "upvotes")]).toBe(6);
    expect(rows[1][getLeagueStatsField("user-2", "downvotes")]).toBe(2);
    expect(yDomain).toEqual([-3, 7]);
  });

  it("cycles series colors from the accent-aware palette", () => {
    expect(getLeagueStatsSeriesColor(0)).toBe("var(--chart-1)");
    expect(getLeagueStatsSeriesColor(5)).toContain("color-mix");
    expect(getLeagueStatsSeriesColor(10)).toBe("var(--chart-1)");
  });
});
