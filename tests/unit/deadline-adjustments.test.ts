import { describe, expect, it } from "vitest";
import {
  formatDeadlineAdjustment,
  getAdjustedDeadline,
  getDeadlineAdjustmentMinutes,
  getSignedDeadlineAdjustmentLabel,
} from "@/lib/rounds/deadline-adjustments";

describe("deadline adjustments", () => {
  it("converts day, hour, and minute presets into total minutes", () => {
    expect(getDeadlineAdjustmentMinutes({ days: 1, hours: 6, minutes: 30 })).toBe(1830);
  });

  it("formats mixed day, hour, and minute labels", () => {
    expect(formatDeadlineAdjustment({ days: 1, hours: 1, minutes: 15 })).toBe(
      "1 day 1 hour 15 minutes",
    );
    expect(formatDeadlineAdjustment({ days: 0, hours: 0, minutes: 30 })).toBe(
      "30 minutes",
    );
  });

  it("formats signed labels for quick preset buttons", () => {
    expect(
      getSignedDeadlineAdjustmentLabel("increase", { days: 1, hours: 1, minutes: 0 }),
    ).toBe("+1 day 1 hour");
    expect(
      getSignedDeadlineAdjustmentLabel("decrease", { days: 0, hours: 0, minutes: 30 }),
    ).toBe("-30 minutes");
  });

  it("applies increases and decreases to deadlines", () => {
    const currentDeadline = new Date("2026-03-10T12:00:00Z").getTime();

    expect(
      getAdjustedDeadline(currentDeadline, "increase", {
        days: 1,
        hours: 0,
        minutes: 0,
      }),
    ).toBe(new Date("2026-03-11T12:00:00Z").getTime());

    expect(
      getAdjustedDeadline(currentDeadline, "decrease", {
        days: 0,
        hours: 6,
        minutes: 30,
      }),
    ).toBe(new Date("2026-03-10T05:30:00Z").getTime());
  });
});
