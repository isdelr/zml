import { describe, expect, it } from "vitest";
import {
  formatDeadlineAdjustment,
  getAdjustedDeadline,
  getDeadlineAdjustmentHours,
  getSignedDeadlineAdjustmentLabel,
} from "@/lib/rounds/deadline-adjustments";

describe("deadline adjustments", () => {
  it("converts day and hour presets into total hours", () => {
    expect(getDeadlineAdjustmentHours({ days: 1, hours: 6 })).toBe(30);
  });

  it("formats mixed day and hour labels", () => {
    expect(formatDeadlineAdjustment({ days: 1, hours: 1 })).toBe("1 day 1 hour");
    expect(formatDeadlineAdjustment({ days: 0, hours: 6 })).toBe("6 hours");
  });

  it("formats signed labels for quick preset buttons", () => {
    expect(
      getSignedDeadlineAdjustmentLabel("increase", { days: 1, hours: 1 }),
    ).toBe("+1 day 1 hour");
    expect(
      getSignedDeadlineAdjustmentLabel("decrease", { days: 0, hours: 6 }),
    ).toBe("-6 hours");
  });

  it("applies increases and decreases to deadlines", () => {
    const currentDeadline = new Date("2026-03-10T12:00:00Z").getTime();

    expect(
      getAdjustedDeadline(currentDeadline, "increase", { days: 1, hours: 0 }),
    ).toBe(new Date("2026-03-11T12:00:00Z").getTime());

    expect(
      getAdjustedDeadline(currentDeadline, "decrease", { days: 0, hours: 6 }),
    ).toBe(new Date("2026-03-10T06:00:00Z").getTime());
  });
});
