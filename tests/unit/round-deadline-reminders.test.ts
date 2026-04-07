import { describe, expect, it } from "vitest";
import {
  buildRoundDeadlineReminderMessage,
  buildRoundDeadlineReminderSource,
  buildRoundDeadlineReminderTitle,
  getRoundDeadlineReminderCandidates,
} from "@/lib/rounds/deadline-reminders";

describe("round deadline reminders", () => {
  it("creates a 75% submission reminder inside the reminder window", () => {
    const now = new Date("2026-03-08T12:00:00Z").getTime();
    const round = {
      _id: "round-0",
      status: "submissions",
      submissionStartsAt: now - 24 * 60 * 60 * 1000,
      submissionDeadline: now + 72 * 60 * 60 * 1000,
      votingDeadline: now + 96 * 60 * 60 * 1000,
    } as const;

    expect(getRoundDeadlineReminderCandidates(round, now)).toEqual([
      expect.objectContaining({
        type: "round_submission",
        window: expect.objectContaining({ key: "75pct", label: "3 days" }),
      }),
    ]);
  });

  it("creates a 50% submission reminder inside the reminder window", () => {
    const now = new Date("2026-03-08T12:00:00Z").getTime();
    const round = {
      _id: "round-1",
      status: "submissions",
      submissionStartsAt: now - 48 * 60 * 60 * 1000,
      submissionDeadline: now + 48 * 60 * 60 * 1000,
      votingDeadline: now + 72 * 60 * 60 * 1000,
    } as const;

    expect(getRoundDeadlineReminderCandidates(round, now)).toEqual([
      expect.objectContaining({
        type: "round_submission",
        window: expect.objectContaining({ key: "50pct", label: "2 days" }),
      }),
    ]);
  });

  it("creates a 10% voting reminder close to the deadline", () => {
    const now = new Date("2026-03-08T12:00:00Z").getTime();
    const round = {
      _id: "round-2",
      status: "voting",
      submissionStartsAt: now - 48 * 60 * 60 * 1000,
      submissionDeadline: now - 90 * 60 * 60 * 1000,
      votingDeadline: now + 10 * 60 * 60 * 1000,
    } as const;

    expect(getRoundDeadlineReminderCandidates(round, now)).toEqual([
      expect.objectContaining({
        type: "round_voting",
        window: expect.objectContaining({
          key: "10pct",
          label: "10 hours",
        }),
      }),
    ]);
  });

  it("creates 15%, 5%, and 1% reminders for the matching windows", () => {
    const now = new Date("2026-03-08T12:00:00Z").getTime();

    expect(
      getRoundDeadlineReminderCandidates(
        {
          _id: "round-4",
          status: "submissions",
          submissionStartsAt: now - 85 * 60 * 60 * 1000,
          submissionDeadline: now + 15 * 60 * 60 * 1000,
          votingDeadline: now + 39 * 60 * 60 * 1000,
        } as const,
        now,
      ),
    ).toEqual([
      expect.objectContaining({
        type: "round_submission",
        window: expect.objectContaining({
          key: "15pct",
          label: "15 hours",
        }),
      }),
    ]);

    expect(
      getRoundDeadlineReminderCandidates(
        {
          _id: "round-5",
          status: "submissions",
          submissionStartsAt: now - 95 * 60 * 60 * 1000,
          submissionDeadline: now + 5 * 60 * 60 * 1000,
          votingDeadline: now + 29 * 60 * 60 * 1000,
        } as const,
        now,
      ),
    ).toEqual([
      expect.objectContaining({
        type: "round_submission",
        window: expect.objectContaining({
          key: "5pct",
          label: "5 hours",
        }),
      }),
    ]);

    expect(
      getRoundDeadlineReminderCandidates(
        {
          _id: "round-6",
          status: "submissions",
          submissionStartsAt: now - 99 * 60 * 60 * 1000,
          submissionDeadline: now + 60 * 60 * 1000,
          votingDeadline: now + 25 * 60 * 60 * 1000,
        } as const,
        now,
      ),
    ).toEqual([
      expect.objectContaining({
        type: "round_submission",
        window: expect.objectContaining({
          key: "1pct",
          label: "1 hour",
        }),
      }),
    ]);
  });

  it("does not create late reminders outside the grace window", () => {
    const now = new Date("2026-03-08T12:00:00Z").getTime();
    const round = {
      _id: "round-3",
      status: "submissions",
      submissionStartsAt: now - 6 * 60 * 60 * 1000,
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
        windowKey: "10pct",
      }),
    ).toBe(
      'Voting closes in 2 hours for "Synth Showdown" in "Night Owls". If you need more time request an extension in the app.',
    );
    expect(
      buildRoundDeadlineReminderMessage({
        status: "voting",
        roundTitle: "Synth Showdown",
        leagueName: "Night Owls",
        label: "2 days",
        windowKey: "50pct",
      }),
    ).toBe(
      'Voting closes in 2 days for "Synth Showdown" in "Night Owls".',
    );
    expect(
      buildRoundDeadlineReminderMessage({
        status: "voting",
        roundTitle: "Synth Showdown",
        leagueName: "Night Owls",
        label: "45 minutes",
        windowKey: "1pct",
      }),
    ).toBe(
      'Voting closes in 45 minutes for "Synth Showdown" in "Night Owls". If you need more time request an extension in the app.',
    );
    expect(
      buildRoundDeadlineReminderSource({
        roundId: "round-9" as never,
        status: "voting",
        deadline: 123,
        windowKey: "10pct",
      }),
    ).toBe("round-deadline:round-9:voting:10pct:123");
  });
});
