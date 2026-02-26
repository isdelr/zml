import { internal } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";

type TriggeringUserId = Id<"users"> | undefined;

export async function transitionRoundToVotingWithSideEffects(
  ctx: MutationCtx,
  round: Doc<"rounds">,
  league: Doc<"leagues">,
  triggeringUserId?: TriggeringUserId,
): Promise<boolean> {
  if (round.status !== "submissions") {
    return false;
  }

  await ctx.db.patch("rounds", round._id, { status: "voting" });
  await ctx.scheduler.runAfter(0, internal.notifications.createForLeague, {
    leagueId: league._id,
    type: "round_voting",
    message: `Voting has begun for the round "${round.title}" in "${league.name}"!`,
    link: `/leagues/${league._id}/round/${round._id}`,
    triggeringUserId,
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
  await ctx.scheduler.runAfter(0, internal.leagues.updateLeagueStats, {
    leagueId: round.leagueId,
  });
  await ctx.scheduler.runAfter(0, internal.notifications.createForLeague, {
    leagueId: league._id,
    type: "round_finished",
    message: notificationMessage,
    link: `/leagues/${league._id}/round/${round._id}`,
    triggeringUserId: options.triggeringUserId,
  });

  return true;
}
