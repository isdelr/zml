import { describe, expect, it } from "vitest";
import { getRoundHeaderStats } from "@/lib/rounds/header-stats";

describe("getRoundHeaderStats", () => {
  it("derives finished-round header stats from the live submissions list", () => {
    expect(
      getRoundHeaderStats("finished", [
        { duration: 125 },
        { duration: 61 },
      ]),
    ).toEqual({
      submissionCount: 2,
      totalDurationSeconds: 186,
    });
  });

  it("hides scheduled-round drafts from the header stats", () => {
    expect(
      getRoundHeaderStats("scheduled", [
        { duration: 180 },
        { duration: 210 },
      ]),
    ).toEqual({
      submissionCount: 0,
      totalDurationSeconds: 0,
    });
  });
});
