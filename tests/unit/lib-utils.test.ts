import { describe, expect, it, vi, afterEach } from "vitest";
import { cn, formatDeadline } from "@/lib/utils";

describe("cn", () => {
  it("merges classes and resolves tailwind conflicts", () => {
    expect(cn("p-2", "p-4", "text-sm")).toContain("p-4");
    expect(cn("p-2", "p-4", "text-sm")).not.toContain("p-2");
  });
});

describe("formatDeadline", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ended when deadline is in the past", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    expect(formatDeadline(999_999)).toBe("Ended");
  });

  it("returns a concrete date for future deadlines", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    // Feb 15, 2026 at 2:30 PM UTC
    const deadline = new Date(2026, 1, 15, 14, 30).getTime();
    const result = formatDeadline(deadline);
    expect(result).toContain("Feb 15, 2026");
    expect(result).toMatch(/at \d{1,2}:\d{2} [AP]M$/);
  });

  it("does not loop for durations over 30 days", () => {
    const now = new Date(2026, 0, 1, 0, 0).getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);
    // 45 days later
    const deadline = new Date(2026, 1, 15, 0, 0).getTime();
    const result = formatDeadline(deadline);
    expect(result).toContain("Feb 15, 2026");
    expect(result).not.toBe("Ended");
  });
});
