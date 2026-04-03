import { internal } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";
import {
  buildNextRoundStartNowPatchesAfterFinish,
  getSubmissionStart,
} from "../../rounds/schedule";
import { getVoteLimitSnapshotPatch } from "../voteLimits";
import { maybeAutoStartVotingAfterSubmissionCompletion } from "./auto-transition";

type TriggeringUserId = Id<"users"> | undefined;

export async function transitionRoundToSubmissionsWithSideEffects(
  ctx: MutationCtx,
  round: Doc<"rounds">,
  league: Doc<"leagues">,
  triggeringUserId?: TriggeringUserId,
  suppressDiscordMentions?: boolean,
): Promise<boolean> {
  if (round.status !== "scheduled") {
    return false;
  }

  await ctx.db.patch("rounds", round._id, { status: "submissions" });
  await ctx.scheduler.runAfter(0, internal.notifications.createForLeagueAndDispatchDiscord, {
    leagueId: league._id,
    roundId: round._id,
    roundStatus: "submissions",
    notificationType: "round_submission",
    discordNotificationKind: "transition",
    message: `Submissions are now open for the round "${round.title}" in "${league.name}"!`,
    link: `/leagues/${league._id}/round/${round._id}`,
    deadlineMs: round.submissionDeadline,
    triggeringUserId,
    suppressDiscordMentions,
    metadata: {
      source: `round-transition:${round._id}:submissions`,
    },
  });

  return true;
}

export async function transitionRoundToVotingWithSideEffects(
  ctx: MutationCtx,
  round: Doc<"rounds">,
  league: Doc<"leagues">,
  triggeringUserId?: TriggeringUserId,
): Promise<boolean> {
  if (round.status !== "submissions") {
    return false;
  }

  await ctx.db.patch("rounds", round._id, {
    status: "voting",
    ...getVoteLimitSnapshotPatch(round, league),
  });
  await ctx.scheduler.runAfter(0, internal.notifications.createForLeagueAndDispatchDiscord, {
    leagueId: league._id,
    roundId: round._id,
    roundStatus: "voting",
    notificationType: "round_voting",
    discordNotificationKind: "transition",
    message: `Voting has begun for the round "${round.title}" in "${league.name}"!`,
    link: `/leagues/${league._id}/round/${round._id}`,
    deadlineMs: round.votingDeadline,
    triggeringUserId,
    metadata: {
      source: `round-transition:${round._id}:voting`,
    },
  });

  return true;
}

type FinishRoundOptions = {
  triggeringUserId?: TriggeringUserId;
  notificationMessage?: string;
};

async function maybeStartNextScheduledRoundAfterFinish(
  ctx: MutationCtx,
  round: Doc<"rounds">,
  league: Doc<"leagues">,
  triggeringUserId?: TriggeringUserId,
) {
  const leagueRounds = await ctx.db
    .query("rounds")
    .withIndex("by_league", (q) => q.eq("leagueId", league._id))
    .collect();

  const nextRoundTransition = buildNextRoundStartNowPatchesAfterFinish({
    rounds: leagueRounds.map((leagueRound) => ({
      ...leagueRound,
      _id: leagueRound._id.toString(),
    })),
    finishedRoundId: round._id.toString(),
    now: Date.now(),
    submissionHours: league.submissionDeadline,
  });

  if (!nextRoundTransition) {
    return;
  }

  const nextRound = leagueRounds.find(
    (leagueRound) =>
      leagueRound._id.toString() === nextRoundTransition.nextRoundId,
  );

  if (!nextRound || nextRound.status !== "scheduled") {
    return;
  }

  if (nextRoundTransition.patches.length > 0) {
    await Promise.all(
      nextRoundTransition.patches.map(({ roundId, patch }) =>
        ctx.db.patch("rounds", roundId as Id<"rounds">, patch),
      ),
    );
  }

  const nextRoundPatch = nextRoundTransition.patches.find(
    ({ roundId }) => roundId === nextRoundTransition.nextRoundId,
  )?.patch;
  const didTransition = await transitionRoundToSubmissionsWithSideEffects(
    ctx,
    nextRoundPatch
      ? {
          ...nextRound,
          submissionStartsAt:
            nextRoundPatch.submissionStartsAt ??
            getSubmissionStart(nextRound, league.submissionDeadline),
          submissionDeadline: nextRoundPatch.submissionDeadline,
          votingDeadline: nextRoundPatch.votingDeadline,
        }
      : nextRound,
    league,
    triggeringUserId,
    true,
  );

  if (didTransition) {
    await maybeAutoStartVotingAfterSubmissionCompletion(
      ctx,
      nextRound._id,
      triggeringUserId,
    );
  }
}

export async function transitionRoundToFinishedWithSideEffects(
  ctx: MutationCtx,
  round: Doc<"rounds">,
  league: Doc<"leagues">,
  options: FinishRoundOptions = {},
): Promise<boolean> {
  if (round.status !== "voting") {
    return false;
  }

  const notificationMessage =
    options.notificationMessage ??
    `The round "${round.title}" in "${league.name}" has finished! Check out the results.`;

  await ctx.db.patch("rounds", round._id, { status: "finished" });
  await ctx.scheduler.runAfter(0, internal.leagues.calculateAndStoreResults, {
    roundId: round._id,
  });
  await ctx.scheduler.runAfter(0, internal.submissions.notifyRevealedCommentsForRound, {
    roundId: round._id,
  });
  await ctx.scheduler.runAfter(0, internal.extensionPolls.closeOpenForRound, {
    roundId: round._id,
  });
  await ctx.scheduler.runAfter(0, internal.notifications.createForLeagueAndDispatchDiscord, {
    leagueId: league._id,
    roundId: round._id,
    roundStatus: "finished",
    notificationType: "round_finished",
    discordNotificationKind: "transition",
    message: notificationMessage,
    link: `/leagues/${league._id}/round/${round._id}`,
    triggeringUserId: options.triggeringUserId,
    metadata: {
      source: `round-transition:${round._id}:finished`,
    },
  });
  await maybeStartNextScheduledRoundAfterFinish(
    ctx,
    round,
    league,
    options.triggeringUserId,
  );

  return true;
}
