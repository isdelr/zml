import { describe, expect, it } from "vitest";
import {
  getAllowedProgressJumpSeconds,
  getCanonicalSubmissionDurationInfo,
  getCappedProgressSeconds,
  getCompletionCatchUpSyncAttempts,
  getCompletionSyncProgressSeconds,
  getPlaylistListenUnlocks,
  getRequiredListenTimeSeconds,
  getTotalPlaylistRequiredListenSeconds,
  getNextProgressSecondsToSync,
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
    expect(getRequiredListenTimeSeconds(241.9, 50, 10)).toBe(241);
    expect(hasCompletedRequiredListenTime(240, 241.9, 50, 10)).toBe(false);
    expect(hasCompletedRequiredListenTime(241, 241.9, 50, 10)).toBe(true);
  });

  it("rounds internal completion sync up within the hidden grace window", () => {
    expect(
      getCompletionSyncProgressSeconds({
        progressSeconds: 470.9,
        durationSeconds: 478.6,
        listenPercentage: 100,
        listenTimeLimitMinutes: 15,
      }),
    ).toBe(478);

    expect(
      getCompletionSyncProgressSeconds({
        progressSeconds: 469.9,
        durationSeconds: 478.6,
        listenPercentage: 100,
        listenTimeLimitMinutes: 15,
      }),
    ).toBe(469);
  });

  it("estimates bounded writes needed to catch up completion", () => {
    expect(
      getCompletionCatchUpSyncAttempts({
        desiredProgressSeconds: 300,
        lastKnownProgressSeconds: 0,
        durationSeconds: 300,
        listenPercentage: 100,
        listenTimeLimitMinutes: 15,
      }),
    ).toBe(10);

    expect(
      getCompletionCatchUpSyncAttempts({
        desiredProgressSeconds: 296,
        lastKnownProgressSeconds: 290,
        durationSeconds: 300,
        listenPercentage: 100,
        listenTimeLimitMinutes: 15,
      }),
    ).toBe(1);
  });

  it("prefers waveform duration for file submissions and flags rounded-up stored durations for self-healing", () => {
    const durationInfo = getCanonicalSubmissionDurationInfo({
      submissionType: "file",
      durationSeconds: 479,
      waveformJson: JSON.stringify({
        length: 7469,
        samples_per_pixel: 256,
        sample_rate: 4000,
      }),
    });

    expect(durationInfo).toEqual({
      durationSec: 478,
      derivedFromWaveform: true,
      shouldPersistDuration: true,
    });
    expect(hasCompletedRequiredListenTime(477, 478, 100, 15)).toBe(false);
    expect(hasCompletedRequiredListenTime(478, 478, 100, 15)).toBe(true);
  });

  it("requires a full listen when the protection cap exceeds the song length", () => {
    expect(getRequiredListenTimeSeconds(8 * 60, 100, 15)).toBe(8 * 60);
    expect(hasCompletedRequiredListenTime(8 * 60 - 1, 8 * 60, 100, 15)).toBe(
      false,
    );
    expect(hasCompletedRequiredListenTime(8 * 60, 8 * 60, 100, 15)).toBe(true);
  });

  it("targets the protection cap instead of full duration for catch-up attempts", () => {
    expect(
      getCompletionCatchUpSyncAttempts({
        desiredProgressSeconds: 1200,
        lastKnownProgressSeconds: 0,
        durationSeconds: 1200,
        listenPercentage: 100,
        listenTimeLimitMinutes: 15,
      }),
    ).toBe(15);

    expect(
      getCompletionCatchUpSyncAttempts({
        desiredProgressSeconds: 1200,
        lastKnownProgressSeconds: 920,
        durationSeconds: 1200,
        listenPercentage: 100,
        listenTimeLimitMinutes: 15,
      }),
    ).toBe(1);
  });

  it("derives progressive playlist unlock thresholds from full listens capped by protection time", () => {
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
    expect(getTotalPlaylistRequiredListenSeconds(entries, 50, 10)).toBe(720);
    expect(getUnlockedPlaylistSubmissionIds(entries, 539, 50, 10)).toEqual([
      "sub-1",
    ]);
    expect(getUnlockedPlaylistSubmissionIds(entries, 540, 50, 10)).toEqual([
      "sub-1",
      "sub-2",
      "sub-2-dup",
    ]);
  });

  it("caps playlist unlock thresholds when tracks exceed the protection limit", () => {
    const entries = [
      { submissionIds: ["sub-1"], durationSeconds: 240.9 },
      { submissionIds: ["sub-2", "sub-2-dup"], durationSeconds: 900 },
      { submissionIds: ["sub-3"], durationSeconds: 180.4 },
    ];

    expect(
      getPlaylistListenUnlocks(entries, 100, 5).map((entry) => ({
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
    expect(getTotalPlaylistRequiredListenSeconds(entries, 100, 5)).toBe(720);
    expect(getUnlockedPlaylistSubmissionIds(entries, 539, 100, 5)).toEqual([
      "sub-1",
    ]);
    expect(getUnlockedPlaylistSubmissionIds(entries, 540, 100, 5)).toEqual([
      "sub-1",
      "sub-2",
      "sub-2-dup",
    ]);
  });
});
