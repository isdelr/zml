type IdLike = string | { toString(): string };

type MemberLike = {
  _id: IdLike;
};

type SubmissionLike = {
  userId: IdLike;
};

type VoteLike = {
  userId: IdLike;
  vote: number;
};

export const EXTENSION_REASON_MIN_LENGTH = 20;
export const EXTENSION_REQUEST_WINDOW_RATIO = 0.25;
export const EXTENSION_POLL_TIE_EXTENSION_MS = 8 * 60 * 60 * 1000;
export const EXTENSION_POLL_APPROVED_EXTENSION_MS = 24 * 60 * 60 * 1000;
export const EXTENSION_POLL_MIN_TURNOUT_RATIO = 0.5;
export const MAX_EXTENSION_REQUESTS_PER_LEAGUE_USER = 2;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type ExtensionPollResolutionResult =
  | "approved"
  | "tie"
  | "rejected"
  | "insufficient_turnout";
export type LockedExtensionPollResult = "approved" | "rejected";

export type ExtensionPollType = "submission" | "voting";

const toId = (value: IdLike) => value.toString();

function formatUnit(value: number, unit: "day" | "hour" | "minute"): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

export function formatExtensionPollRequestWindowLabel(windowMs: number): string {
  const roundedMinutes = Math.max(1, Math.round(windowMs / MINUTE_MS));
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

export function getExtensionPollRequestWindowMs(
  phaseStartsAt: number,
  phaseDeadline: number,
): number {
  return Math.max(0, (phaseDeadline - phaseStartsAt) * EXTENSION_REQUEST_WINDOW_RATIO);
}

export function isExtensionPollRequestWindowOpen(
  phaseStartsAt: number,
  phaseDeadline: number,
  now: number,
): boolean {
  const phaseDurationMs = phaseDeadline - phaseStartsAt;
  const remainingMs = phaseDeadline - now;
  return (
    phaseDurationMs > 0 &&
    remainingMs > 0 &&
    remainingMs <= getExtensionPollRequestWindowMs(phaseStartsAt, phaseDeadline)
  );
}

export function getRemainingExtensionRequests(
  usedRequests: number,
  maxRequests = MAX_EXTENSION_REQUESTS_PER_LEAGUE_USER,
): number {
  return Math.max(0, maxRequests - usedRequests);
}

export function getFinalizedVotingParticipantIds(
  members: MemberLike[] | undefined,
  submissions: SubmissionLike[] | undefined,
  votes: VoteLike[] | undefined,
  maxUp: number,
  maxDown: number,
): string[] {
  const memberIds = new Set((members ?? []).map((member) => toId(member._id)));
  if (memberIds.size === 0) {
    return [];
  }

  const eligibleVoterIds = [
    ...new Set(
      (submissions ?? [])
        .map((submission) => toId(submission.userId))
        .filter((userId) => memberIds.has(userId)),
    ),
  ];
  if (eligibleVoterIds.length === 0) {
    return [];
  }

  const voteTotals = new Map<string, { up: number; down: number }>();
  for (const vote of votes ?? []) {
    const userId = toId(vote.userId);
    const current = voteTotals.get(userId) ?? { up: 0, down: 0 };
    if (vote.vote > 0) {
      current.up += vote.vote;
    } else if (vote.vote < 0) {
      current.down += Math.abs(vote.vote);
    }
    voteTotals.set(userId, current);
  }

  return eligibleVoterIds.filter((userId) => {
    const totals = voteTotals.get(userId) ?? { up: 0, down: 0 };
    return totals.up === maxUp && totals.down === maxDown;
  });
}

export function getSubmittedParticipantIds(
  members: MemberLike[] | undefined,
  submissions: SubmissionLike[] | undefined,
): string[] {
  const memberIds = new Set((members ?? []).map((member) => toId(member._id)));
  if (memberIds.size === 0) {
    return [];
  }

  return [
    ...new Set(
      (submissions ?? [])
        .map((submission) => toId(submission.userId))
        .filter((userId) => memberIds.has(userId)),
    ),
  ];
}

export function getExtensionPollResolution(args: {
  yesVotes: number;
  noVotes: number;
  eligibleVoterCount: number;
}): {
  result: ExtensionPollResolutionResult;
  appliedExtensionMs: number;
} {
  const totalVotes = args.yesVotes + args.noVotes;
  if (!hasExtensionPollReachedMinimumTurnout(totalVotes, args.eligibleVoterCount)) {
    return {
      result: "insufficient_turnout",
      appliedExtensionMs: 0,
    };
  }

  if (args.yesVotes > args.noVotes) {
    return {
      result: "approved",
      appliedExtensionMs: EXTENSION_POLL_APPROVED_EXTENSION_MS,
    };
  }

  if (args.yesVotes === args.noVotes) {
    return {
      result: "tie",
      appliedExtensionMs: EXTENSION_POLL_TIE_EXTENSION_MS,
    };
  }

  return {
    result: "rejected",
    appliedExtensionMs: 0,
  };
}

export function getLockedExtensionPollResult(args: {
  yesVotes: number;
  noVotes: number;
  eligibleVoterCount: number;
}): LockedExtensionPollResult | null {
  if (args.yesVotes * 2 > args.eligibleVoterCount) {
    return "approved";
  }

  if (args.noVotes * 2 > args.eligibleVoterCount) {
    return "rejected";
  }

  return null;
}

export function getExtensionPollMinimumTurnout(eligibleVoterCount: number): number {
  return Math.ceil(eligibleVoterCount * EXTENSION_POLL_MIN_TURNOUT_RATIO);
}

export function hasExtensionPollReachedMinimumTurnout(
  totalVotes: number,
  eligibleVoterCount: number,
): boolean {
  return totalVotes >= getExtensionPollMinimumTurnout(eligibleVoterCount);
}
