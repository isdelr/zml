import type { Doc } from "../../convex/_generated/dataModel";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const ROUND_DEADLINE_REMINDER_WINDOWS = [
  {
    key: "24h",
    label: "1 day",
    thresholdMs: 24 * HOUR_MS,
    graceMs: 30 * MINUTE_MS,
  },
  {
    key: "2h",
    label: "2 hours",
    thresholdMs: 2 * HOUR_MS,
    graceMs: 15 * MINUTE_MS,
  },
] as const;

type ActiveRoundStatus = Extract<Doc<"rounds">["status"], "submissions" | "voting">;

type ActiveRoundReminderShape = Pick<
  Doc<"rounds">,
  "status" | "submissionDeadline" | "votingDeadline"
>;

export type RoundDeadlineReminderWindow =
  (typeof ROUND_DEADLINE_REMINDER_WINDOWS)[number];

export type RoundDeadlineReminderCandidate = {
  window: RoundDeadlineReminderWindow;
  deadline: number;
  type: "round_submission" | "round_voting";
};

export function getActiveRoundDeadline(round: ActiveRoundReminderShape): number | null {
  if (round.status === "submissions") {
    return round.submissionDeadline;
  }
  if (round.status === "voting") {
    return round.votingDeadline;
  }
  return null;
}

export function getRoundDeadlineReminderCandidates(
  round: ActiveRoundReminderShape,
  now: number,
): RoundDeadlineReminderCandidate[] {
  const deadline = getActiveRoundDeadline(round);
  if (!deadline) {
    return [];
  }

  const remainingMs = deadline - now;
  if (remainingMs <= 0) {
    return [];
  }

  return ROUND_DEADLINE_REMINDER_WINDOWS.filter(
    (window) =>
      remainingMs <= window.thresholdMs &&
      remainingMs > window.thresholdMs - window.graceMs,
  ).map((window) => ({
    window,
    deadline,
    type: round.status === "submissions" ? "round_submission" : "round_voting",
  }));
}

export function buildRoundDeadlineReminderSource(args: {
  roundId: Doc<"rounds">["_id"];
  status: ActiveRoundStatus;
  deadline: number;
  windowKey: RoundDeadlineReminderWindow["key"];
}): string {
  return [
    "round-deadline",
    args.roundId,
    args.status,
    args.windowKey,
    args.deadline,
  ].join(":");
}

export function buildRoundDeadlineReminderMessage(args: {
  status: ActiveRoundStatus;
  roundTitle: string;
  leagueName: string;
  label: string;
}): string {
  if (args.status === "submissions") {
    return `Submissions close in ${args.label} for "${args.roundTitle}" in "${args.leagueName}".`;
  }

  return `Voting closes in ${args.label} for "${args.roundTitle}" in "${args.leagueName}".`;
}

export function buildRoundDeadlineReminderTitle(args: {
  status: ActiveRoundStatus;
  label: string;
}): string {
  if (args.status === "submissions") {
    return `Submission deadline in ${args.label}`;
  }

  return `Voting deadline in ${args.label}`;
}
