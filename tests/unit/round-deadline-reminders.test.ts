import { describe, expect, it } from "vitest";
import {
  buildRoundDeadlineReminderMessage,
  buildRoundDeadlineReminderSource,
  buildRoundDeadlineReminderTitle,
  getRoundDeadlineReminderCandidates,
} from "@/lib/rounds/deadline-reminders";

describe("round deadline reminders", () => {
  it("creates a 48-hour submission reminder inside the reminder window", () => {
    const now = new Date("2026-03-08T12:00:00Z").getTime();
    const round = {
      _id: "round-0",
      status: "submissions",
      submissionDeadline: now + 48 * 60 * 60 * 1000 - 10 * 60 * 1000,
      votingDeadline: now + 72 * 60 * 60 * 1000,
    } as const;

    expect(getRoundDeadlineReminderCandidates(round, now)).toEqual([
      expect.objectContaining({
        type: "round_submission",
        window: expect.objectContaining({ key: "2d", label: "2 days" }),
      }),
    ]);
  });

  it("creates a 24-hour submission reminder inside the reminder window", () => {
    const now = new Date("2026-03-08T12:00:00Z").getTime();
    const round = {
      _id: "round-1",
      status: "submissions",
      submissionDeadline: now + 24 * 60 * 60 * 1000 - 10 * 60 * 1000,
      votingDeadline: now + 48 * 60 * 60 * 1000,
    } as const;

    expect(getRoundDeadlineReminderCandidates(round, now)).toEqual([
      expect.objectContaining({
        type: "round_submission",
        window: expect.objectContaining({ key: "24h", label: "1 day" }),
      }),
    ]);
  });

  it("creates only the 2-hour voting reminder close to deadline", () => {
    const now = new Date("2026-03-08T12:00:00Z").getTime();
    const round = {
      _id: "round-2",
      status: "voting",
      submissionDeadline: now - 24 * 60 * 60 * 1000,
      votingDeadline: now + 2 * 60 * 60 * 1000 - 5 * 60 * 1000,
    } as const;

    expect(getRoundDeadlineReminderCandidates(round, now)).toEqual([
      expect.objectContaining({
        type: "round_voting",
        window: expect.objectContaining({ key: "2h", label: "2 hours" }),
      }),
    ]);
  });

  it("does not create late 24-hour reminders outside the grace window", () => {
    const now = new Date("2026-03-08T12:00:00Z").getTime();
    const round = {
      _id: "round-3",
      status: "submissions",
      submissionDeadline: now + 10 * 60 * 60 * 1000,
      votingDeadline: now + 48 * 60 * 60 * 1000,
    } as const;

    expect(getRoundDeadlineReminderCandidates(round, now)).toEqual([]);
  });

  it("builds stable titles, messages, and sources", () => {
    expect(
      buildRoundDeadlineReminderTitle({
        status: "submissions",
        label: "1 day",
      }),
    ).toBe("Submission deadline in 1 day");
    expect(
      buildRoundDeadlineReminderMessage({
        status: "voting",
        roundTitle: "Synth Showdown",
        leagueName: "Night Owls",
        label: "2 hours",
      }),
    ).toBe(
      'Voting closes in 2 hours for "Synth Showdown" in "Night Owls".',
    );
    expect(
      buildRoundDeadlineReminderSource({
        roundId: "round-9" as never,
        status: "voting",
        deadline: 123,
        windowKey: "2h",
      }),
    ).toBe("round-deadline:round-9:voting:2h:123");
  });
});
