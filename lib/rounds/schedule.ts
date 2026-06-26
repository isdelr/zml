import {
  DEFAULT_SUBMISSION_DURATION_MINUTES,
  DEFAULT_VOTING_DURATION_MINUTES,
  MINUTE_MS,
  durationMinutesToMs,
  getEffectiveDurationMinutes,
} from "../../lib/time/duration";

export const ROUND_GAP_MINUTES = 24 * 60;
export const ROUND_GAP_MS = durationMinutesToMs(ROUND_GAP_MINUTES);

export type RoundLifecycleStatus =
  | "scheduled"
  | "submissions"
  | "voting"
  | "finished";

type RoundScheduleShape = {
  _creationTime?: number;
  order?: number;
  status: RoundLifecycleStatus;
  submissionStartsAt?: number;
  submissionDeadline: number;
  votingDeadline: number;
  submissionDurationMinutes?: number | null;
  votingDurationMinutes?: number | null;
};

type LeagueDurationShape = {
  submissionDeadline: number;
  votingDeadline: number;
  submissionDurationMinutes?: number | null;
  votingDurationMinutes?: number | null;
};

type RoundDurationShape = {
  submissionDurationMinutes?: number | null;
  votingDurationMinutes?: number | null;
};

export type BuiltRoundSchedule = {
  order: number;
  status: Extract<RoundLifecycleStatus, "scheduled" | "submissions">;
  submissionStartsAt: number;
  submissionDeadline: number;
  votingDeadline: number;
};

export type SwappableRoundScheduleStatus = Extract<
  RoundLifecycleStatus,
  "scheduled" | "submissions"
>;

export type RoundScheduleSwapPatch = {
  roundId: string;
  patch: {
    order?: number;
    status?: SwappableRoundScheduleStatus;
    submissionStartsAt?: number;
    submissionDeadline?: number;
    votingDeadline?: number;
  };
};

type RoundShiftPatch = {
  roundId: string;
  patch: {
    submissionStartsAt?: number;
    submissionDeadline: number;
    votingDeadline: number;
  };
};

export function minutesToMs(minutes: number): number {
  return Number.isFinite(minutes) ? Math.trunc(minutes) * MINUTE_MS : 0;
}

export function getLeagueSubmissionDurationMinutes(
  league: LeagueDurationShape,
): number {
  return getEffectiveDurationMinutes({
    durationMinutes: league.submissionDurationMinutes,
    legacyHours: league.submissionDeadline,
    fallbackMinutes: DEFAULT_SUBMISSION_DURATION_MINUTES,
  });
}

export function getLeagueVotingDurationMinutes(
  league: LeagueDurationShape,
): number {
  return getEffectiveDurationMinutes({
    durationMinutes: league.votingDurationMinutes,
    legacyHours: league.votingDeadline,
    fallbackMinutes: DEFAULT_VOTING_DURATION_MINUTES,
  });
}

export function getRoundSubmissionDurationMinutes(
  round: RoundDurationShape,
  league: LeagueDurationShape,
): number {
  return (
    round.submissionDurationMinutes ??
    getLeagueSubmissionDurationMinutes(league)
  );
}

export function getRoundVotingDurationMinutes(
  round: RoundDurationShape,
  league: LeagueDurationShape,
): number {
  return round.votingDurationMinutes ?? getLeagueVotingDurationMinutes(league);
}

export function getRoundOrderValue(
  round: Pick<RoundScheduleShape, "order" | "_creationTime">,
): number {
  return round.order ?? round._creationTime ?? Number.MAX_SAFE_INTEGER;
}

export function sortRoundsInLeagueOrder<T extends RoundScheduleShape>(
  rounds: T[],
): T[] {
  return [...rounds].sort(
    (left, right) => getRoundOrderValue(left) - getRoundOrderValue(right),
  );
}

export function getSubmissionStart(
  round: Pick<RoundScheduleShape, "submissionStartsAt" | "submissionDeadline">,
  submissionDurationMinutes: number,
): number {
  return (
    round.submissionStartsAt ??
    round.submissionDeadline - minutesToMs(submissionDurationMinutes)
  );
}

export function buildLeagueRoundSchedule(args: {
  roundCount: number;
  startsAt: number;
  submissionDurationMinutes: number;
  votingDurationMinutes: number;
  gapMs?: number;
}): BuiltRoundSchedule[] {
  const gapMs = args.gapMs ?? ROUND_GAP_MS;
  const submissionDurationMs = minutesToMs(args.submissionDurationMinutes);
  const votingDurationMs = minutesToMs(args.votingDurationMinutes);
  const schedules: BuiltRoundSchedule[] = [];

  let submissionStartsAt = args.startsAt;
  for (let index = 0; index < args.roundCount; index += 1) {
    const submissionDeadline = submissionStartsAt + submissionDurationMs;
    const votingDeadline = submissionDeadline + votingDurationMs;

    schedules.push({
      order: index,
      status: index === 0 ? "submissions" : "scheduled",
      submissionStartsAt,
      submissionDeadline,
      votingDeadline,
    });

    submissionStartsAt = votingDeadline + gapMs;
  }

  return schedules;
}

export function buildRoundShiftPatches<
  TRound extends RoundScheduleShape & { _id: string },
>(args: {
  rounds: TRound[];
  roundId: string;
  adjustmentMs: number;
  gapMs?: number;
}): RoundShiftPatch[] {
  const sortedRounds = sortRoundsInLeagueOrder(args.rounds);
  const gapMs = args.gapMs ?? ROUND_GAP_MS;
  const targetIndex = sortedRounds.findIndex(
    (round) => round._id.toString() === args.roundId,
  );

  if (targetIndex === -1) {
    return [];
  }

  const patches = new Map<string, RoundShiftPatch["patch"]>();

  sortedRounds.slice(targetIndex).forEach((round, index) => {
    const roundId = round._id.toString();

    if (index === 0) {
      if (round.status === "submissions") {
        patches.set(roundId, {
          submissionDeadline: round.submissionDeadline + args.adjustmentMs,
          votingDeadline: round.votingDeadline + args.adjustmentMs,
        });
        return;
      }

      if (round.status === "voting") {
        patches.set(roundId, {
          submissionDeadline: round.submissionDeadline,
          votingDeadline: round.votingDeadline + args.adjustmentMs,
        });
        return;
      }
    }

    const patch: {
      submissionStartsAt?: number;
      submissionDeadline: number;
      votingDeadline: number;
    } = {
      submissionDeadline: round.submissionDeadline + args.adjustmentMs,
      votingDeadline: round.votingDeadline + args.adjustmentMs,
    };

    if (round.submissionStartsAt !== undefined) {
      patch.submissionStartsAt = round.submissionStartsAt + args.adjustmentMs;
    }

    patches.set(roundId, patch);
  });

  let nextSubmissionStartsAt: number | null = null;

  for (const round of sortedRounds) {
    const roundId = round._id.toString();
    const patch = patches.get(roundId);
    const submissionStartsAt =
      patch?.submissionStartsAt ?? round.submissionStartsAt;
    let votingDeadline = patch?.votingDeadline ?? round.votingDeadline;

    if (
      patch &&
      round.status === "scheduled" &&
      submissionStartsAt !== undefined &&
      nextSubmissionStartsAt !== null &&
      submissionStartsAt < nextSubmissionStartsAt
    ) {
      const cascadeShiftMs = nextSubmissionStartsAt - submissionStartsAt;
      patch.submissionStartsAt = submissionStartsAt + cascadeShiftMs;
      patch.submissionDeadline += cascadeShiftMs;
      patch.votingDeadline += cascadeShiftMs;
      votingDeadline = patch.votingDeadline;
    }

    nextSubmissionStartsAt = votingDeadline + gapMs;
  }

  return [...patches.entries()].map(([roundId, patch]) => ({
    roundId,
    patch,
  }));
}

export function buildRoundStartNowPatches<
  TRound extends RoundScheduleShape & { _id: string },
>(args: {
  rounds: TRound[];
  roundId: string;
  now: number;
  submissionDurationMinutes: number;
}): Array<{
  roundId: string;
  patch: {
    submissionStartsAt?: number;
    submissionDeadline: number;
    votingDeadline: number;
  };
}> {
  const sortedRounds = sortRoundsInLeagueOrder(args.rounds);
  const targetRound = sortedRounds.find(
    (round) => round._id.toString() === args.roundId,
  );

  if (!targetRound) {
    return [];
  }

  const scheduledStart = getSubmissionStart(
    targetRound,
    targetRound.submissionDurationMinutes ?? args.submissionDurationMinutes,
  );
  const adjustmentMs = args.now - scheduledStart;

  if (adjustmentMs === 0) {
    return [];
  }

  return buildRoundShiftPatches({
    rounds: sortedRounds,
    roundId: args.roundId,
    adjustmentMs,
  });
}

export function buildNextRoundStartNowPatchesAfterFinish<
  TRound extends RoundScheduleShape & { _id: string },
>(args: {
  rounds: TRound[];
  finishedRoundId: string;
  now: number;
  submissionDurationMinutes: number;
}): {
  nextRoundId: string;
  patches: Array<{
    roundId: string;
    patch: {
      submissionStartsAt?: number;
      submissionDeadline: number;
      votingDeadline: number;
    };
  }>;
} | null {
  const sortedRounds = sortRoundsInLeagueOrder(args.rounds);
  const finishedRoundIndex = sortedRounds.findIndex(
    (round) => round._id.toString() === args.finishedRoundId,
  );

  if (finishedRoundIndex === -1) {
    return null;
  }

  const nextRound = sortedRounds
    .slice(finishedRoundIndex + 1)
    .find((round) => round.status !== "finished");

  if (!nextRound || nextRound.status !== "scheduled") {
    return null;
  }

  const nextRoundIndex = sortedRounds.findIndex(
    (round) => round._id.toString() === nextRound._id.toString(),
  );
  const futureRounds = sortedRounds
    .slice(nextRoundIndex)
    .filter((round) => round.status !== "finished");

  if (futureRounds.some((round) => round.status !== "scheduled")) {
    return null;
  }

  return {
    nextRoundId: nextRound._id.toString(),
    patches: buildRoundStartNowPatches({
      rounds: futureRounds,
      roundId: nextRound._id.toString(),
      now: args.now,
      submissionDurationMinutes: args.submissionDurationMinutes,
    }),
  };
}

function isSwappableRoundScheduleStatus(
  status: RoundLifecycleStatus,
): status is SwappableRoundScheduleStatus {
  return status === "scheduled" || status === "submissions";
}

function getRoundScheduleSlot<TRound extends RoundScheduleShape>(
  round: TRound,
  order: number,
  submissionDurationMinutes: number,
) {
  const effectiveSubmissionDurationMinutes =
    round.submissionDurationMinutes ?? submissionDurationMinutes;

  return {
    order,
    status: round.status as SwappableRoundScheduleStatus,
    submissionStartsAt: getSubmissionStart(
      round,
      effectiveSubmissionDurationMinutes,
    ),
    submissionDeadline: round.submissionDeadline,
    votingDeadline: round.votingDeadline,
  };
}

export function buildRoundScheduleSwapPatches<
  TRound extends RoundScheduleShape & { _id: string },
>(args: {
  rounds: TRound[];
  firstRoundId: string;
  secondRoundId: string;
  submissionDurationMinutes: number;
}): RoundScheduleSwapPatch[] {
  if (args.firstRoundId === args.secondRoundId) {
    return [];
  }

  const sortedRounds = sortRoundsInLeagueOrder(args.rounds);
  const firstIndex = sortedRounds.findIndex(
    (round) => round._id.toString() === args.firstRoundId,
  );
  const secondIndex = sortedRounds.findIndex(
    (round) => round._id.toString() === args.secondRoundId,
  );

  if (firstIndex === -1 || secondIndex === -1) {
    return [];
  }

  const firstRound = sortedRounds[firstIndex];
  const secondRound = sortedRounds[secondIndex];

  if (
    !isSwappableRoundScheduleStatus(firstRound.status) ||
    !isSwappableRoundScheduleStatus(secondRound.status)
  ) {
    return [];
  }

  const swappedSlots = new Map<string, ReturnType<typeof getRoundScheduleSlot>>(
    [
      [
        firstRound._id.toString(),
        getRoundScheduleSlot(
          secondRound,
          secondIndex,
          args.submissionDurationMinutes,
        ),
      ],
      [
        secondRound._id.toString(),
        getRoundScheduleSlot(
          firstRound,
          firstIndex,
          args.submissionDurationMinutes,
        ),
      ],
    ],
  );

  const patches: RoundScheduleSwapPatch[] = [];

  sortedRounds.forEach((round, index) => {
    const roundId = round._id.toString();
    const swappedSlot = swappedSlots.get(roundId);

    if (swappedSlot) {
      patches.push({
        roundId,
        patch: swappedSlot,
      });
      return;
    }

    if (round.order !== index) {
      patches.push({
        roundId,
        patch: { order: index },
      });
    }
  });

  return patches;
}

export function buildScheduledRoundResequencePatches<
  TRound extends RoundScheduleShape & { _id: string },
>(args: {
  rounds: TRound[];
  submissionDurationMinutes: number;
  votingDurationMinutes: number;
  gapMs?: number;
}): Array<{
  roundId: string;
  patch: {
    submissionStartsAt: number;
    submissionDeadline: number;
    votingDeadline: number;
  };
}> {
  const sortedRounds = sortRoundsInLeagueOrder(args.rounds);
  const gapMs = args.gapMs ?? ROUND_GAP_MS;
  const patches: Array<{
    roundId: string;
    patch: {
      submissionStartsAt: number;
      submissionDeadline: number;
      votingDeadline: number;
    };
  }> = [];

  let nextSubmissionStartsAt: number | null = null;

  for (const round of sortedRounds) {
    if (round.status === "scheduled") {
      const submissionDurationMs = minutesToMs(
        round.submissionDurationMinutes ?? args.submissionDurationMinutes,
      );
      const votingDurationMs = minutesToMs(
        round.votingDurationMinutes ?? args.votingDurationMinutes,
      );
      const submissionStartsAt: number =
        nextSubmissionStartsAt ??
        getSubmissionStart(
          round,
          round.submissionDurationMinutes ?? args.submissionDurationMinutes,
        );
      const submissionDeadline: number =
        submissionStartsAt + submissionDurationMs;
      const votingDeadline: number = submissionDeadline + votingDurationMs;

      patches.push({
        roundId: round._id,
        patch: {
          submissionStartsAt,
          submissionDeadline,
          votingDeadline,
        },
      });

      nextSubmissionStartsAt = votingDeadline + gapMs;
      continue;
    }

    nextSubmissionStartsAt = round.votingDeadline + gapMs;
  }

  return patches;
}
