import type { Doc } from "../../convex/_generated/dataModel";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MAX_REMINDER_GRACE_MS = 30 * MINUTE_MS;
const MIN_REMINDER_GRACE_MS = MINUTE_MS;

export const ROUND_DEADLINE_REMINDER_CHECKPOINTS = [
  {
    key: "75pct",
    fractionRemaining: 0.75,
  },
  {
    key: "50pct",
    fractionRemaining: 0.5,
  },
  {
    key: "25pct",
    fractionRemaining: 0.25,
  },
  {
    key: "15pct",
    fractionRemaining: 0.15,
  },
  {
    key: "10pct",
    fractionRemaining: 0.1,
  },
  {
    key: "5pct",
    fractionRemaining: 0.05,
  },
  {
    key: "1pct",
    fractionRemaining: 0.01,
  },
] as const;

type ActiveRoundStatus = Extract<Doc<"rounds">["status"], "submissions" | "voting">;

type ActiveRoundReminderShape = Pick<
  Doc<"rounds">,
  "status" | "submissionStartsAt" | "submissionDeadline" | "votingDeadline"
>;

export type RoundDeadlineReminderWindow =
  (typeof ROUND_DEADLINE_REMINDER_CHECKPOINTS)[number] & {
    label: string;
    thresholdMs: number;
    graceMs: number;
  };

export type RoundDeadlineReminderCandidate = {
  window: RoundDeadlineReminderWindow;
  deadline: number;
  type: "round_submission" | "round_voting";
};

const EXTENSION_POLL_REMINDER_WINDOW_KEYS = new Set<
  RoundDeadlineReminderWindow["key"]
>(["10pct", "1pct"]);

function formatUnit(value: number, unit: "day" | "hour" | "minute"): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

function formatReminderDuration(durationMs: number): string {
  const roundedMinutes = Math.max(1, Math.round(durationMs / MINUTE_MS));
  const days = Math.floor(roundedMinutes / (DAY_MS / MINUTE_MS));
  const hours = Math.floor((roundedMinutes % (DAY_MS / MINUTE_MS)) / (HOUR_MS / MINUTE_MS));
  const minutes = roundedMinutes % (HOUR_MS / MINUTE_MS);

  const parts: string[] = [];
  if (days > 0) {
    parts.push(formatUnit(days, "day"));
  }
  if (hours > 0) {
    parts.push(formatUnit(hours, "hour"));
  }
  if (minutes > 0 && days === 0) {
    parts.push(formatUnit(minutes, "minute"));
  }

  return parts.slice(0, 2).join(" ");
}

function buildRoundDeadlineReminderWindows(
  totalDurationMs: number,
): RoundDeadlineReminderWindow[] {
  const thresholds = ROUND_DEADLINE_REMINDER_CHECKPOINTS.map((checkpoint) => ({
    ...checkpoint,
    thresholdMs: totalDurationMs * checkpoint.fractionRemaining,
  }));

  return thresholds.map((window, index) => {
    const nextThresholdMs = thresholds[index + 1]?.thresholdMs ?? 0;
    const gapToNextWindowMs = window.thresholdMs - nextThresholdMs;

    return {
      ...window,
      label: formatReminderDuration(window.thresholdMs),
      graceMs: Math.max(
        MIN_REMINDER_GRACE_MS,
        Math.min(MAX_REMINDER_GRACE_MS, Math.floor(gapToNextWindowMs / 2)),
      ),
    };
  });
}

function shouldIncludeVotingExtensionPrompt(
  windowKey: RoundDeadlineReminderWindow["key"],
): boolean {
  return (
    windowKey === "25pct" ||
    windowKey === "15pct" ||
    windowKey === "10pct" ||
    windowKey === "5pct" ||
    windowKey === "1pct"
  );
}

export function shouldIncludeExtensionPollReminder(
  windowKey: RoundDeadlineReminderWindow["key"],
): boolean {
  return EXTENSION_POLL_REMINDER_WINDOW_KEYS.has(windowKey);
}

export function getActiveRoundDeadline<T extends ActiveRoundReminderShape>(
  round: T,
): number | null {
  if (round.status === "submissions") {
    return round.submissionDeadline;
  }
  if (round.status === "voting") {
    return round.votingDeadline;
  }
  return null;
}

function getActiveRoundReminderWindow(
  round: ActiveRoundReminderShape,
):
  | {
      deadline: number;
      phaseStart: number;
      type: "round_submission" | "round_voting";
    }
  | null {
  if (round.status === "submissions") {
    if (round.submissionStartsAt === undefined) {
      return null;
    }

    return {
      deadline: round.submissionDeadline,
      phaseStart: round.submissionStartsAt,
      type: "round_submission",
    };
  }

  if (round.status === "voting") {
    return {
      deadline: round.votingDeadline,
      phaseStart: round.submissionDeadline,
      type: "round_voting",
    };
  }

  return null;
}

export function getRoundDeadlineReminderCandidates<T extends ActiveRoundReminderShape>(
  round: T,
  now: number,
): RoundDeadlineReminderCandidate[] {
  const activeReminderWindow = getActiveRoundReminderWindow(round);
  if (!activeReminderWindow) {
    return [];
  }

  const remainingMs = activeReminderWindow.deadline - now;
  const totalDurationMs = activeReminderWindow.deadline - activeReminderWindow.phaseStart;
  if (remainingMs <= 0 || totalDurationMs <= 0) {
    return [];
  }

  return buildRoundDeadlineReminderWindows(totalDurationMs).filter(
    (window) =>
      remainingMs <= window.thresholdMs &&
      remainingMs > window.thresholdMs - window.graceMs,
  ).map((window) => ({
    window,
    deadline: activeReminderWindow.deadline,
    type: activeReminderWindow.type,
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
  windowKey: RoundDeadlineReminderWindow["key"];
}): string {
  if (args.status === "submissions") {
    return `Submissions close in ${args.label} for "${args.roundTitle}" in "${args.leagueName}".`;
  }

  if (shouldIncludeVotingExtensionPrompt(args.windowKey)) {
    return `Voting closes in ${args.label} for "${args.roundTitle}" in "${args.leagueName}". If you need more time request an extension in the app.`;
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

export function buildExtensionPollReminderSource(args: {
  pollId: string;
  deadline: number;
  windowKey: RoundDeadlineReminderWindow["key"];
}): string {
  return [
    "extension-poll-deadline",
    args.pollId,
    args.windowKey,
    args.deadline,
  ].join(":");
}

export function buildExtensionPollReminderMessage(args: {
  roundTitle: string;
  leagueName: string;
  label: string;
}): string {
  return `Extension poll closes in ${args.label} for "${args.roundTitle}" in "${args.leagueName}". Vote in the app.`;
}

export function buildExtensionPollReminderTitle(args: {
  label: string;
}): string {
  return `Extension poll closes in ${args.label}`;
}
