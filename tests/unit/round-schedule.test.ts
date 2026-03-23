import { describe, expect, it } from "vitest";

import {
  buildLeagueRoundSchedule,
  buildRoundShiftPatches,
  buildRoundStartNowPatches,
  buildScheduledRoundResequencePatches,
  hoursToMs,
} from "@/lib/rounds/schedule";

describe("round schedule", () => {
  it("creates non-overlapping rounds with a 24 hour gap", () => {
    const startsAt = new Date("2026-03-10T00:00:00Z").getTime();
    const schedule = buildLeagueRoundSchedule({
      roundCount: 3,
      startsAt,
      submissionHours: 72,
      votingHours: 72,
    });

    expect(schedule).toEqual([
      {
        order: 0,
        status: "submissions",
        submissionStartsAt: new Date("2026-03-10T00:00:00Z").getTime(),
        submissionDeadline: new Date("2026-03-13T00:00:00Z").getTime(),
        votingDeadline: new Date("2026-03-16T00:00:00Z").getTime(),
      },
      {
        order: 1,
        status: "scheduled",
        submissionStartsAt: new Date("2026-03-17T00:00:00Z").getTime(),
        submissionDeadline: new Date("2026-03-20T00:00:00Z").getTime(),
        votingDeadline: new Date("2026-03-23T00:00:00Z").getTime(),
      },
      {
        order: 2,
        status: "scheduled",
        submissionStartsAt: new Date("2026-03-24T00:00:00Z").getTime(),
        submissionDeadline: new Date("2026-03-27T00:00:00Z").getTime(),
        votingDeadline: new Date("2026-03-30T00:00:00Z").getTime(),
      },
    ]);
  });

  it("shifts the current round and every later round by the same amount", () => {
    const rounds = [
      {
        _id: "round-1",
        order: 0,
        status: "submissions" as const,
        submissionStartsAt: new Date("2026-03-10T00:00:00Z").getTime(),
        submissionDeadline: new Date("2026-03-13T00:00:00Z").getTime(),
        votingDeadline: new Date("2026-03-16T00:00:00Z").getTime(),
      },
      {
        _id: "round-2",
        order: 1,
        status: "scheduled" as const,
        submissionStartsAt: new Date("2026-03-17T00:00:00Z").getTime(),
        submissionDeadline: new Date("2026-03-20T00:00:00Z").getTime(),
        votingDeadline: new Date("2026-03-23T00:00:00Z").getTime(),
      },
    ];

    expect(
      buildRoundShiftPatches({
        rounds,
        roundId: "round-1",
        adjustmentMs: hoursToMs(12),
      }),
    ).toEqual([
      {
        roundId: "round-1",
        patch: {
          submissionDeadline: new Date("2026-03-13T12:00:00Z").getTime(),
          votingDeadline: new Date("2026-03-16T12:00:00Z").getTime(),
        },
      },
      {
        roundId: "round-2",
        patch: {
          submissionStartsAt: new Date("2026-03-17T12:00:00Z").getTime(),
          submissionDeadline: new Date("2026-03-20T12:00:00Z").getTime(),
          votingDeadline: new Date("2026-03-23T12:00:00Z").getTime(),
        },
      },
    ]);
  });

  it("rebuilds future scheduled rounds from the active round anchor", () => {
    const rounds = [
      {
        _id: "round-1",
        order: 0,
        status: "voting" as const,
        submissionStartsAt: new Date("2026-03-10T00:00:00Z").getTime(),
        submissionDeadline: new Date("2026-03-13T00:00:00Z").getTime(),
        votingDeadline: new Date("2026-03-16T00:00:00Z").getTime(),
      },
      {
        _id: "round-2",
        order: 1,
        status: "scheduled" as const,
        submissionStartsAt: new Date("2026-03-17T00:00:00Z").getTime(),
        submissionDeadline: new Date("2026-03-20T00:00:00Z").getTime(),
        votingDeadline: new Date("2026-03-23T00:00:00Z").getTime(),
      },
      {
        _id: "round-3",
        order: 2,
        status: "scheduled" as const,
        submissionStartsAt: new Date("2026-03-24T00:00:00Z").getTime(),
        submissionDeadline: new Date("2026-03-27T00:00:00Z").getTime(),
        votingDeadline: new Date("2026-03-30T00:00:00Z").getTime(),
      },
    ];

    expect(
      buildScheduledRoundResequencePatches({
        rounds,
        submissionHours: 48,
        votingHours: 24,
      }),
    ).toEqual([
      {
        roundId: "round-2",
        patch: {
          submissionStartsAt: new Date("2026-03-17T00:00:00Z").getTime(),
          submissionDeadline: new Date("2026-03-19T00:00:00Z").getTime(),
          votingDeadline: new Date("2026-03-20T00:00:00Z").getTime(),
        },
      },
      {
        roundId: "round-3",
        patch: {
          submissionStartsAt: new Date("2026-03-21T00:00:00Z").getTime(),
          submissionDeadline: new Date("2026-03-23T00:00:00Z").getTime(),
          votingDeadline: new Date("2026-03-24T00:00:00Z").getTime(),
        },
      },
    ]);
  });

  it("starts a scheduled round immediately and shifts later rounds by the same amount", () => {
    const rounds = [
      {
        _id: "round-1",
        order: 0,
        status: "finished" as const,
        submissionStartsAt: new Date("2026-03-10T00:00:00Z").getTime(),
        submissionDeadline: new Date("2026-03-13T00:00:00Z").getTime(),
        votingDeadline: new Date("2026-03-16T00:00:00Z").getTime(),
      },
      {
        _id: "round-2",
        order: 1,
        status: "scheduled" as const,
        submissionStartsAt: new Date("2026-03-17T00:00:00Z").getTime(),
        submissionDeadline: new Date("2026-03-20T00:00:00Z").getTime(),
        votingDeadline: new Date("2026-03-23T00:00:00Z").getTime(),
      },
      {
        _id: "round-3",
        order: 2,
        status: "scheduled" as const,
        submissionStartsAt: new Date("2026-03-24T00:00:00Z").getTime(),
        submissionDeadline: new Date("2026-03-27T00:00:00Z").getTime(),
        votingDeadline: new Date("2026-03-30T00:00:00Z").getTime(),
      },
    ];

    expect(
      buildRoundStartNowPatches({
        rounds,
        roundId: "round-2",
        now: new Date("2026-03-15T12:00:00Z").getTime(),
        submissionHours: 72,
      }),
    ).toEqual([
      {
        roundId: "round-2",
        patch: {
          submissionStartsAt: new Date("2026-03-15T12:00:00Z").getTime(),
          submissionDeadline: new Date("2026-03-18T12:00:00Z").getTime(),
          votingDeadline: new Date("2026-03-21T12:00:00Z").getTime(),
        },
      },
      {
        roundId: "round-3",
        patch: {
          submissionStartsAt: new Date("2026-03-22T12:00:00Z").getTime(),
          submissionDeadline: new Date("2026-03-25T12:00:00Z").getTime(),
          votingDeadline: new Date("2026-03-28T12:00:00Z").getTime(),
        },
      },
    ]);
  });
});
