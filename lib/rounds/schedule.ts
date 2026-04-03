const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const ROUND_GAP_HOURS = 24;
export const ROUND_GAP_MS = ROUND_GAP_HOURS * HOUR_MS;

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
};

export type BuiltRoundSchedule = {
  order: number;
  status: Extract<RoundLifecycleStatus, "scheduled" | "submissions">;
  submissionStartsAt: number;
  submissionDeadline: number;
  votingDeadline: number;
};

export function hoursToMs(hours: number): number {
  return hours * HOUR_MS;
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
  submissionHours: number,
): number {
  return (
    round.submissionStartsAt ??
    round.submissionDeadline - hoursToMs(submissionHours)
  );
}

export function buildLeagueRoundSchedule(args: {
  roundCount: number;
  startsAt: number;
  submissionHours: number;
  votingHours: number;
  gapMs?: number;
}): BuiltRoundSchedule[] {
  const gapMs = args.gapMs ?? ROUND_GAP_MS;
  const submissionDurationMs = hoursToMs(args.submissionHours);
  const votingDurationMs = hoursToMs(args.votingHours);
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
}): Array<{
  roundId: string;
  patch: {
    submissionStartsAt?: number;
    submissionDeadline: number;
    votingDeadline: number;
  };
}> {
  const sortedRounds = sortRoundsInLeagueOrder(args.rounds);
  const targetIndex = sortedRounds.findIndex(
    (round) => round._id.toString() === args.roundId,
  );

  if (targetIndex === -1) {
    return [];
  }

  return sortedRounds.slice(targetIndex).map((round, index) => {
    if (index === 0) {
      if (round.status === "submissions") {
        return {
          roundId: round._id,
          patch: {
            submissionDeadline: round.submissionDeadline + args.adjustmentMs,
            votingDeadline: round.votingDeadline + args.adjustmentMs,
          },
        };
      }

      if (round.status === "voting") {
        return {
          roundId: round._id,
          patch: {
            submissionDeadline: round.submissionDeadline,
            votingDeadline: round.votingDeadline + args.adjustmentMs,
          },
        };
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

    return {
      roundId: round._id,
      patch,
    };
  });
}

export function buildRoundStartNowPatches<
  TRound extends RoundScheduleShape & { _id: string },
>(args: {
  rounds: TRound[];
  roundId: string;
  now: number;
  submissionHours: number;
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

  const scheduledStart = getSubmissionStart(targetRound, args.submissionHours);
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
  submissionHours: number;
}):
  | {
      nextRoundId: string;
      patches: Array<{
        roundId: string;
        patch: {
          submissionStartsAt?: number;
          submissionDeadline: number;
          votingDeadline: number;
        };
      }>;
    }
  | null {
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
      submissionHours: args.submissionHours,
    }),
  };
}

export function buildScheduledRoundResequencePatches<
  TRound extends RoundScheduleShape & { _id: string },
>(args: {
  rounds: TRound[];
  submissionHours: number;
  votingHours: number;
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
  const submissionDurationMs = hoursToMs(args.submissionHours);
  const votingDurationMs = hoursToMs(args.votingHours);
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
      const submissionStartsAt: number =
        nextSubmissionStartsAt ??
        getSubmissionStart(round, args.submissionHours);
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
