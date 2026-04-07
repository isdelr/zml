import { describe, expect, it } from "vitest";
import {
  clampSeekTargetToAllowedProgress,
  getRequiredListenTimeSeconds,
  hasCompletedListenRequirement,
  shouldMarkListenCompleted,
} from "@/lib/music/listen-enforcement";

describe("listen enforcement helpers", () => {
  it("treats server or local completion as completed", () => {
    expect(hasCompletedListenRequirement(true, false)).toBe(true);
    expect(hasCompletedListenRequirement(false, true)).toBe(true);
    expect(hasCompletedListenRequirement(false, false)).toBe(false);
  });

  it("clamps forward seeks past listened progress with tolerance", () => {
    expect(clampSeekTargetToAllowedProgress(80, 60, 120)).toBe(61.5);
    expect(clampSeekTargetToAllowedProgress(40, 60, 120)).toBe(40);
  });

  it("computes required listen time as full duration capped by the protection limit", () => {
    expect(getRequiredListenTimeSeconds(300, 50, 10)).toBe(300);
    expect(getRequiredListenTimeSeconds(1200, 100, 5)).toBe(300);
  });

  it("marks completion when listened time crosses threshold", () => {
    expect(shouldMarkListenCompleted(300, 300, 50, 10)).toBe(true);
    expect(shouldMarkListenCompleted(299, 300, 50, 10)).toBe(false);
  });

  it("waits for the authoritative rounded-up second at fractional boundaries", () => {
    expect(getRequiredListenTimeSeconds(241.9, 50, 10)).toBe(241);
    expect(shouldMarkListenCompleted(240, 241.9, 50, 10)).toBe(false);
    expect(shouldMarkListenCompleted(241, 241.9, 50, 10)).toBe(true);
  });
});
