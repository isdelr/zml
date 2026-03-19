import { describe, expect, it } from "vitest";
import {
  getAllowedProgressJumpSeconds,
  getCappedProgressSeconds,
  getPlaylistFullDurationUnlocks,
  getPlaylistListenUnlocks,
  getRequiredListenTimeSeconds,
  getTotalPlaylistDurationSeconds,
  getTotalPlaylistRequiredListenSeconds,
  getNextProgressSecondsToSync,
  getUnlockedPlaylistSubmissionIdsByFullDuration,
  getUnlockedPlaylistSubmissionIds,
  hasCompletedRequiredListenTime,
} from "@/lib/music/listen-progress";

describe("listen progress sync helpers", () => {
  it("computes bounded allowed jump seconds from duration", () => {
    expect(getAllowedProgressJumpSeconds(60)).toBe(15);
    expect(getAllowedProgressJumpSeconds(240)).toBe(24);
    expect(getAllowedProgressJumpSeconds(1000)).toBe(60);
  });

  it("caps reported progress growth to one allowed jump", () => {
    expect(getCappedProgressSeconds(30, 90, 240)).toBe(54);
    expect(getCappedProgressSeconds(30, 40, 240)).toBe(40);
    expect(getCappedProgressSeconds(30, 20, 240)).toBe(30);
  });

  it("skips tiny syncs, but syncs normal intervals", () => {
    expect(
      getNextProgressSecondsToSync({
        desiredProgressSeconds: 10,
        lastSyncedProgressSeconds: 0,
        durationSeconds: 240,
      }),
    ).toBeNull();

    expect(
      getNextProgressSecondsToSync({
        desiredProgressSeconds: 20,
        lastSyncedProgressSeconds: 0,
        durationSeconds: 240,
      }),
    ).toBe(20);
  });

  it("caps backlog sync updates instead of sending large jumps", () => {
    expect(
      getNextProgressSecondsToSync({
        desiredProgressSeconds: 170,
        lastSyncedProgressSeconds: 0,
        durationSeconds: 240,
      }),
    ).toBe(24);

    expect(
      getNextProgressSecondsToSync({
        desiredProgressSeconds: 200,
        lastSyncedProgressSeconds: 0,
        durationSeconds: 0,
      }),
    ).toBe(20);
  });

  it("flushes near-end updates even with small deltas", () => {
    expect(
      getNextProgressSecondsToSync({
        desiredProgressSeconds: 296,
        lastSyncedProgressSeconds: 290,
        durationSeconds: 300,
      }),
    ).toBe(296);
  });

  it("uses an integer-second completion threshold for persistence", () => {
    expect(getRequiredListenTimeSeconds(241.9, 50, 10)).toBe(121);
    expect(hasCompletedRequiredListenTime(120.9, 241.9, 50, 10)).toBe(false);
    expect(hasCompletedRequiredListenTime(121, 241.9, 50, 10)).toBe(true);
  });

  it("derives progressive playlist unlock thresholds from required listen time", () => {
    const entries = [
      { submissionIds: ["sub-1"], durationSeconds: 240 },
      { submissionIds: ["sub-2", "sub-2-dup"], durationSeconds: 300 },
      { submissionIds: ["sub-3"], durationSeconds: 180 },
    ];

    expect(
      getPlaylistListenUnlocks(entries, 50, 10).map((entry) => ({
        submissionIds: entry.submissionIds,
        requiredListenSeconds: entry.requiredListenSeconds,
        unlockAfterSeconds: entry.unlockAfterSeconds,
      })),
    ).toEqual([
      {
        submissionIds: ["sub-1"],
        requiredListenSeconds: 120,
        unlockAfterSeconds: 120,
      },
      {
        submissionIds: ["sub-2", "sub-2-dup"],
        requiredListenSeconds: 150,
        unlockAfterSeconds: 270,
      },
      {
        submissionIds: ["sub-3"],
        requiredListenSeconds: 90,
        unlockAfterSeconds: 360,
      },
    ]);
    expect(getTotalPlaylistRequiredListenSeconds(entries, 50, 10)).toBe(360);
    expect(getUnlockedPlaylistSubmissionIds(entries, 269, 50, 10)).toEqual([
      "sub-1",
    ]);
    expect(getUnlockedPlaylistSubmissionIds(entries, 270, 50, 10)).toEqual([
      "sub-1",
      "sub-2",
      "sub-2-dup",
    ]);
  });

  it("can derive full-duration playlist unlock thresholds for youtube flows", () => {
    const entries = [
      { submissionIds: ["sub-1"], durationSeconds: 240.9 },
      { submissionIds: ["sub-2", "sub-2-dup"], durationSeconds: 300 },
      { submissionIds: ["sub-3"], durationSeconds: 180 },
    ];

    expect(
      getPlaylistFullDurationUnlocks(entries).map((entry) => ({
        submissionIds: entry.submissionIds,
        requiredListenSeconds: entry.requiredListenSeconds,
        unlockAfterSeconds: entry.unlockAfterSeconds,
      })),
    ).toEqual([
      {
        submissionIds: ["sub-1"],
        requiredListenSeconds: 240,
        unlockAfterSeconds: 240,
      },
      {
        submissionIds: ["sub-2", "sub-2-dup"],
        requiredListenSeconds: 300,
        unlockAfterSeconds: 540,
      },
      {
        submissionIds: ["sub-3"],
        requiredListenSeconds: 180,
        unlockAfterSeconds: 720,
      },
    ]);
    expect(getTotalPlaylistDurationSeconds(entries)).toBe(720);
    expect(getUnlockedPlaylistSubmissionIdsByFullDuration(entries, 539)).toEqual([
      "sub-1",
    ]);
    expect(getUnlockedPlaylistSubmissionIdsByFullDuration(entries, 540)).toEqual([
      "sub-1",
      "sub-2",
      "sub-2-dup",
    ]);
  });
});
