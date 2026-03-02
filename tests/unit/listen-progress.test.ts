import { describe, expect, it } from "vitest";
import {
  getAllowedProgressJumpSeconds,
  getCappedProgressSeconds,
  getNextProgressSecondsToSync,
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
});
