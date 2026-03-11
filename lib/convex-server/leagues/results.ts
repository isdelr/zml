import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";
import { getVoteLimits } from "../voteLimits";

export async function recalculateAndStoreRoundResults(
  ctx: MutationCtx,
  roundId: Id<"rounds">,
) {
  const round = await ctx.db.get("rounds", roundId);
  if (!round) return;

  const league = await ctx.db.get("leagues", round.leagueId);
  if (!league) return;

  const submissions = await ctx.db
    .query("submissions")
    .withIndex("by_round_and_user", (q) => q.eq("roundId", roundId))
    .collect();
  if (submissions.length === 0) {
    return;
  }

  const allVotes = await ctx.db
    .query("votes")
    .withIndex("by_round_and_user", (q) => q.eq("roundId", roundId))
    .collect();
  const adminAdjustments = await ctx.db
    .query("adminVoteAdjustments")
    .withIndex("by_round", (q) => q.eq("roundId", roundId))
    .collect();

  const budgetByUser = new Map<string, { up: number; down: number }>();
  for (const vote of allVotes) {
    const key = vote.userId.toString();
    const entry = budgetByUser.get(key) ?? { up: 0, down: 0 };
    if (vote.vote > 0) entry.up += vote.vote;
    else if (vote.vote < 0) entry.down += Math.abs(vote.vote);
    budgetByUser.set(key, entry);
  }

  const { maxUp, maxDown } = getVoteLimits(round, league);
  const finalizedVoters = new Set<string>();
  for (const [userId, { up, down }] of budgetByUser.entries()) {
    if (up === maxUp && down === maxDown) {
      finalizedVoters.add(userId);
    }
  }

  const votesBySubmission = new Map<string, Doc<"votes">[]>();
  for (const vote of allVotes) {
    const submissionKey = vote.submissionId.toString();
    const existing = votesBySubmission.get(submissionKey);
    if (existing) existing.push(vote);
    else votesBySubmission.set(submissionKey, [vote]);
  }

  const adminAdjustmentsBySubmission = new Map<
    string,
    Doc<"adminVoteAdjustments">[]
  >();
  for (const adjustment of adminAdjustments) {
    const submissionKey = adjustment.submissionId.toString();
    const existing = adminAdjustmentsBySubmission.get(submissionKey);
    if (existing) existing.push(adjustment);
    else adminAdjustmentsBySubmission.set(submissionKey, [adjustment]);
  }

  const previousResults = await ctx.db
    .query("roundResults")
    .withIndex("by_round", (q) => q.eq("roundId", roundId))
    .collect();

  const previousPointsByUser = new Map<Id<"users">, number>();
  const previousWinsByUser = new Map<Id<"users">, number>();
  for (const result of previousResults) {
    previousPointsByUser.set(
      result.userId,
      (previousPointsByUser.get(result.userId) ?? 0) + result.points,
    );
    if (result.isWinner) {
      previousWinsByUser.set(
        result.userId,
        (previousWinsByUser.get(result.userId) ?? 0) + 1,
      );
    }
  }

  await Promise.all(
    previousResults.map((result) => ctx.db.delete("roundResults", result._id)),
  );

  const perSubmission = new Map<
    string,
    { points: number; penaltyApplied: boolean }
  >();
  for (const submission of submissions) {
    const submissionKey = submission._id.toString();
    const standardVotes = votesBySubmission.get(submissionKey) ?? [];
    const adminVotes = adminAdjustmentsBySubmission.get(submissionKey) ?? [];
    const submitterFinalized = finalizedVoters.has(submission.userId.toString());
    const isTrollSubmission = submission.isTrollSubmission ?? false;

    let points = 0;
    if (!submitterFinalized || isTrollSubmission) {
      for (const vote of standardVotes) {
        if (vote.vote < 0) points += vote.vote;
      }
    } else {
      for (const vote of standardVotes) {
        points += vote.vote;
      }
    }
    for (const vote of adminVotes) {
      points += vote.vote;
    }

    perSubmission.set(submissionKey, {
      points,
      penaltyApplied: !submitterFinalized || isTrollSubmission,
    });
  }

  let bestPoints = -Infinity;
  for (const submission of submissions) {
    const submissionResult = perSubmission.get(submission._id.toString());
    if (submissionResult && submissionResult.points > bestPoints) {
      bestPoints = submissionResult.points;
    }
  }

  await Promise.all(
    submissions.map((submission) => {
      const submissionResult = perSubmission.get(submission._id.toString());
      if (!submissionResult) {
        throw new Error("Missing computed submission result.");
      }
      return ctx.db.insert("roundResults", {
        roundId,
        submissionId: submission._id,
        userId: submission.userId,
        points: submissionResult.points,
        isWinner: submissionResult.points === bestPoints,
        penaltyApplied: submissionResult.penaltyApplied,
      });
    }),
  );

  const newPointsByUser = new Map<Id<"users">, number>();
  const newWinsByUser = new Map<Id<"users">, number>();
  for (const submission of submissions) {
    const submissionResult = perSubmission.get(submission._id.toString());
    if (!submissionResult) continue;
    newPointsByUser.set(
      submission.userId,
      (newPointsByUser.get(submission.userId) ?? 0) + submissionResult.points,
    );
    if (submissionResult.points === bestPoints) {
      newWinsByUser.set(
        submission.userId,
        (newWinsByUser.get(submission.userId) ?? 0) + 1,
      );
    }
  }

  const allUsers = new Set<Id<"users">>([
    ...newPointsByUser.keys(),
    ...previousPointsByUser.keys(),
    ...newWinsByUser.keys(),
    ...previousWinsByUser.keys(),
  ]);

  const standingsInLeague = await ctx.db
    .query("leagueStandings")
    .withIndex("by_league_and_user", (q) => q.eq("leagueId", league._id))
    .collect();
  const standingByUserId = new Map(
    standingsInLeague.map((standing) => [standing.userId.toString(), standing]),
  );

  const standingWriteOps: Promise<Id<"leagueStandings"> | void>[] = [];
  for (const userId of allUsers) {
    const previousPoints = previousPointsByUser.get(userId) ?? 0;
    const newPoints = newPointsByUser.get(userId) ?? 0;
    const pointsDelta = newPoints - previousPoints;

    const previousWins = previousWinsByUser.get(userId) ?? 0;
    const newWins = newWinsByUser.get(userId) ?? 0;
    const winsDelta = newWins - previousWins;

    if (pointsDelta === 0 && winsDelta === 0) {
      continue;
    }

    const existingStanding = standingByUserId.get(userId.toString());
    if (existingStanding) {
      standingWriteOps.push(
        ctx.db.patch(existingStanding._id, {
          totalPoints: existingStanding.totalPoints + pointsDelta,
          totalWins: existingStanding.totalWins + winsDelta,
        }),
      );
      continue;
    }

    standingWriteOps.push(
      ctx.db.insert("leagueStandings", {
        leagueId: league._id,
        userId,
        totalPoints: pointsDelta,
        totalWins: winsDelta,
      }),
    );
  }

  await Promise.all(standingWriteOps);
}
