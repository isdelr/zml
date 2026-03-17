import { internal } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";
import { getVoteLimitSnapshotPatch } from "../voteLimits";

type TriggeringUserId = Id<"users"> | undefined;

export async function transitionRoundToSubmissionsWithSideEffects(
  ctx: MutationCtx,
  round: Doc<"rounds">,
  league: Doc<"leagues">,
  triggeringUserId?: TriggeringUserId,
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

  return true;
}
