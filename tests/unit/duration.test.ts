import { describe, expect, it } from "vitest";

import {
  durationMinutesToMs,
  durationMinutesToParts,
  durationPartsToMinutes,
  formatDurationMinutes,
  getDurationValidationMessage,
  isWholeMinutes,
  legacyHoursToDurationMinutes,
} from "@/lib/time/duration";

describe("duration helpers", () => {
  it("converts between parts, minutes, and milliseconds", () => {
    expect(durationPartsToMinutes({ days: 1, hours: 2, minutes: 30 })).toBe(
      1590,
    );
    expect(durationMinutesToParts(1590)).toEqual({
      days: 1,
      hours: 2,
      minutes: 30,
    });
    expect(durationMinutesToMs(15)).toBe(15 * 60 * 1000);
  });

  it("formats day/hour/minute labels", () => {
    expect(formatDurationMinutes(15)).toBe("15 minutes");
    expect(formatDurationMinutes(60)).toBe("1 hour");
    expect(formatDurationMinutes(24 * 60 + 75)).toBe(
      "1 day 1 hour 15 minutes",
    );
  });

  it("rounds legacy decimal hours to whole minutes", () => {
    expect(legacyHoursToDurationMinutes(1.5)).toBe(90);
    expect(legacyHoursToDurationMinutes(undefined)).toBe(0);
  });

  it("detects whole-minute values", () => {
    expect(isWholeMinutes(15)).toBe(true);
    expect(isWholeMinutes(15.5)).toBe(false);
    expect(isWholeMinutes("15")).toBe(false);
  });

  it("validates minimum durations", () => {
    expect(getDurationValidationMessage(9)).toBe(
      "Must be at least 10 minutes.",
    );
    expect(getDurationValidationMessage(10)).toBeNull();
  });
});
