import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";
import { getSubmissionFileProcessingStatus } from "../../submission/file-processing";
import { sortRoundsInLeagueOrder } from "../../rounds/schedule";
import { getPendingSubmissionParticipantIds } from "../../rounds/pending-participation";
import { transitionRoundToVotingWithSideEffects } from "./transitions";

function hasIncompleteFileSubmissions(
  submissions: Array<
    Pick<
      Doc<"submissions">,
      "submissionType" | "songFileKey" | "fileProcessingStatus"
    >
  >,
) {
  return submissions.some((submission) => {
    if (submission.submissionType !== "file") {
      return false;
    }

    return getSubmissionFileProcessingStatus(submission) !== "ready";
  });
}

export async function maybeAutoStartVotingAfterSubmissionCompletion(
  ctx: MutationCtx,
  roundId: Id<"rounds">,
  triggeringUserId?: Id<"users">,
): Promise<boolean> {
  const round = await ctx.db.get("rounds", roundId);
  if (!round || round.status !== "submissions") {
    return false;
  }

  const league = await ctx.db.get("leagues", round.leagueId);
  if (!league) {
    return false;
  }

  const [leagueRounds, memberships, submissions] = await Promise.all([
    ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", round.leagueId))
      .collect(),
    ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", round.leagueId))
      .collect(),
    ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", roundId))
      .collect(),
  ]);

  const sortedRounds = sortRoundsInLeagueOrder(leagueRounds);
  if (sortedRounds[0]?._id === roundId) {
    return false;
  }

  if (hasIncompleteFileSubmissions(submissions)) {
    return false;
  }

  const activeMembers = memberships.filter(
    (membership) => !membership.isBanned && !membership.isSpectator,
  );
  const pendingParticipantIds = getPendingSubmissionParticipantIds(
    activeMembers.map((membership) => ({ _id: membership.userId })),
    submissions,
    round.submissionsPerUser ?? 1,
    round.submissionMode ?? "single",
  );

  if (pendingParticipantIds.length > 0) {
    return false;
  }

  return transitionRoundToVotingWithSideEffects(
    ctx,
    round,
    league,
    triggeringUserId,
  );
}
