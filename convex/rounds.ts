import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { R2 } from "@convex-dev/r2";
import { components, internal } from "./_generated/api";
import { submissionCounter } from "./counters";
import { paginationOptsValidator } from "convex/server";
import { submissionsByUser } from "./aggregates";

const r2 = new R2(components.r2);

const checkOwnership = async (ctx: MutationCtx | QueryCtx, leagueId: Id<"leagues">) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated.");
  }
  const league = await ctx.db.get(leagueId);
  if (!league) {
    throw new Error("League not found.");
  }
  if (league.creatorId !== userId) {
    throw new Error("You are not the owner of this league.");
  }
  return { league, userId };
};

export const get = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.roundId);
  },
});

export const getRoundMetadata = query({
  args: { roundId: v.id("rounds") },
  returns: v.union(
    v.null(),
    v.object({
      roundTitle: v.string(),
      roundDescription: v.string(),
      imageUrl: v.union(v.string(), v.null()),
      leagueName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round) {
      return null;
    }
    const league = await ctx.db.get(round.leagueId);
    if (!league) {
      return null;
    }
    const imageUrl = round.imageKey ? await r2.getUrl(round.imageKey) : null;
    return {
      roundTitle: round.title,
      roundDescription: round.description,
      imageUrl,
      leagueName: league.name,
    };
  },
});

export const getForLeague = query({
  args: {
    leagueId: v.id("leagues"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const paginationResult = await ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .order("desc")
      .paginate(args.paginationOpts);

    const roundsWithDetails = await Promise.all(
      paginationResult.page.map(async (round) => {
        const league = await ctx.db.get(round.leagueId);

        const submissions = await ctx.db
          .query("submissions")
          .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
          .collect();

        const allUserIds = new Set(submissions.map((s) => s.userId));

        let winnerInfo: {
          name: string;
          image: string | null;
          songTitle: string;
          points: number;
        } | null = null;

        let voters: Doc<"users">[] = [];

        if (round.status === "finished") {
          const results = await ctx.db
            .query("roundResults")
            .withIndex("by_round", (q) => q.eq("roundId", round._id))
            .filter((q) => q.eq(q.field("isWinner"), true))
            .collect();

          if (results.length > 0) {
            const winnerResult = results[0];
            const [winnerUser, winningSubmission] = await Promise.all([ctx.db.get(winnerResult.userId), ctx.db.get(winnerResult.submissionId)]);
            if (winnerUser && winningSubmission) {
              winnerInfo = {
                name: winnerUser.name ?? "Unknown",
                image: winnerUser.image ?? null,
                songTitle: winningSubmission.songTitle,
                points: winnerResult.points,
              };
            }
          }
        }

        if (round.status === "voting" || round.status === "finished") {
          const votes = await ctx.db.query("votes").withIndex("by_round_and_user", (q) => q.eq("roundId", round._id)).collect();

          const finalizedVoterIds: Id<"users">[] = [];
          if (league) {
            const sums = new Map<string, { up: number; down: number }>();
            for (const vte of votes) {
              const key = vte.userId.toString();
              const entry = sums.get(key) ?? { up: 0, down: 0 };
              if (vte.vote > 0) entry.up += vte.vote;
              else if (vte.vote < 0) entry.down += Math.abs(vte.vote);
              sums.set(key, entry);
            }
            for (const [userIdStr, { up, down }] of sums.entries()) {
              if (up === league.maxPositiveVotes && down === league.maxNegativeVotes) {
                finalizedVoterIds.push(userIdStr as unknown as Id<"users">);
              }
            }
          }
          finalizedVoterIds.forEach((id) => allUserIds.add(id));
          const voterDocs = await Promise.all(finalizedVoterIds.map((id) => ctx.db.get(id)));
          voters = voterDocs.filter((u): u is Doc<"users"> => u !== null);
        }

        const userDocs = await Promise.all(Array.from(allUserIds).map((id) => ctx.db.get(id)));
        const userMap = new Map(userDocs.filter(Boolean).map((u) => [u!._id, u! as Doc<"users">]));

        // Compute per-user submission counts
        const perUserCounts = new Map<Id<"users">, number>();
        for (const s of submissions) {
          const cnt = perUserCounts.get(s.userId) ?? 0;
          perUserCounts.set(s.userId, cnt + 1);
        }
        const requiredPerUser = (round as any).submissionsPerUser ?? 1;
        const completedUserIds = Array.from(perUserCounts.entries())
          .filter(([, count]) => count >= requiredPerUser)
          .map(([uid]) => uid);
        const completedSubmitters = completedUserIds
          .map((uid) => userMap.get(uid))
          .filter(Boolean) as Doc<"users">[];

        const artUrl = round.imageKey ? await r2.getUrl(round.imageKey) : null;

        // Member count for denominator in voting and to compute expected tracks
        const leagueMemberCount = (await ctx.db
          .query("memberships")
          .withIndex("by_league", (q) => q.eq("leagueId", round.leagueId))
          .collect()).length;
        const expectedTrackCount = leagueMemberCount * requiredPerUser;

        return {
          ...round,
          art: artUrl,
          leagueName: league?.name ?? "Unknown League",
          submissionCount: submissions.length, // total submitted tracks
          expectedTrackCount,
          leagueMemberCount,
          voterCount: voters.length,
          submitters: completedSubmitters.map((u) => ({ name: u.name, image: u.image })),
          voters: voters.map((u) => ({ name: u.name, image: u.image })),
          winner: winnerInfo,
        };
      }),
    );

    const sortedRounds = roundsWithDetails.sort((a, b) => {
      const getRelevantDeadline = (round: (typeof roundsWithDetails)[number]) => {
        switch (round.status) {
          case "submissions":
            return round.submissionDeadline;
          case "voting":
            return round.votingDeadline;
          case "finished":
            return round.votingDeadline;
          default:
            return round.submissionDeadline;
        }
      };
      const aDeadline = getRelevantDeadline(a);
      const bDeadline = getRelevantDeadline(b);
      return aDeadline - bDeadline;
    });

    return { ...paginationResult, page: sortedRounds };
  },
});

export const getActiveForUser = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"rounds"> & { leagueName: string; art: string | null }>> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const memberships = await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    if (memberships.length === 0) return [];
    const leagueIds = memberships.map((m) => m.leagueId);
    const userLeagues = (await Promise.all(leagueIds.map((leagueId) => ctx.db.get(leagueId)))).filter((l): l is Doc<"leagues"> => l !== null);
    if (userLeagues.length === 0) return [];
    const allActiveRounds: Array<Doc<"rounds"> & { leagueName: string; art: string | null }> = [];
    for (const league of userLeagues) {
      const rounds = await ctx.db
        .query("rounds")
        .withIndex("by_league", (q) => q.eq("leagueId", league._id))
        .filter((q) => q.neq(q.field("status"), "finished"))
        .collect();
      for (const round of rounds) {
        const artUrl = (round.imageKey && (await r2.getUrl(round.imageKey))) || null;
        allActiveRounds.push({
          ...round,
          leagueName: league.name,
          art: artUrl,
        });
      }
    }
    allActiveRounds.sort((a, b) => a.submissionDeadline - b.submissionDeadline);
    return allActiveRounds;
  },
});

export const manageRoundState = mutation({
  args: {
    roundId: v.id("rounds"),
    action: v.union(v.literal("startVoting"), v.literal("endVoting")),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round) throw new Error("Round not found");
    const { league, userId } = await checkOwnership(ctx, round.leagueId);

    switch (args.action) {
      case "startVoting":
        if (round.status !== "submissions") throw new Error("Round is not in submission phase.");
        await ctx.db.patch(args.roundId, { status: "voting" });
        await ctx.scheduler.runAfter(0, internal.notifications.createForLeague, {
          leagueId: league._id,
          type: "round_voting",
          message: `Voting has begun for the round "${round.title}" in "${league.name}"!`,
          link: `/leagues/${league._id}/round/${round._id}`,
          triggeringUserId: userId,
        });
        break;
      case "endVoting":
        if (round.status !== "voting") throw new Error("Round is not in voting phase.");
        const submissions = await ctx.db
          .query("submissions")
          .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
          .collect();
        const votes = await ctx.db.query("votes").withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId)).collect();
        if (submissions.length === 0) {
          throw new Error("Cannot end round: at least one song must be submitted.");
        }
        if (votes.length === 0) {
          throw new Error("Cannot end round: at least one vote must be cast.");
        }
        await ctx.db.patch(args.roundId, { status: "finished" });
        await ctx.scheduler.runAfter(0, internal.leagues.calculateAndStoreResults, {
          roundId: args.roundId,
        });
        await ctx.scheduler.runAfter(0, internal.leagues.updateLeagueStats, {
          leagueId: round.leagueId,
        });
        await ctx.scheduler.runAfter(0, internal.notifications.createForLeague, {
          leagueId: league._id,
          type: "round_finished",
          message: `The round "${round.title}" in "${league.name}" has finished! Check out the results.`,
          link: `/leagues/${league._id}/round/${round._id}`,
          triggeringUserId: userId,
        });
        break;
    }
  },
});

export const adjustRoundTime = mutation({
  args: {
    roundId: v.id("rounds"),
    hours: v.number(),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round) throw new Error("Round not found");
    await checkOwnership(ctx, round.leagueId);

    const now = Date.now();
    const timeAdjustment = args.hours * 60 * 60 * 1000;

    if (round.status === "submissions") {
      const newSubmissionDeadline = round.submissionDeadline + timeAdjustment;
      if (newSubmissionDeadline < now) {
        throw new Error("Cannot set submission deadline to a time in the past.");
      }
      await ctx.db.patch(round._id, {
        submissionDeadline: newSubmissionDeadline,
        votingDeadline: round.votingDeadline + timeAdjustment,
      });
    } else if (round.status === "voting") {
      const newVotingDeadline = round.votingDeadline + timeAdjustment;
      if (newVotingDeadline < now) {
        throw new Error("Cannot set voting deadline to a time in the past.");
      }
      await ctx.db.patch(round._id, {
        votingDeadline: newVotingDeadline,
      });
    } else {
      throw new Error("Cannot adjust time for a finished round.");
    }
  },
});

export const rollbackRoundToSubmissions = mutation({
  args: {
    roundId: v.id("rounds"),
  },
  handler: async (ctx, args) => {
    // Load round and league
    const round = await ctx.db.get(args.roundId);
    if (!round) throw new Error("Round not found");
    const league = await ctx.db.get(round.leagueId);
    if (!league) throw new Error("League not found");

    // Permission: allow league owner, league managers, or global admins
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");
    const user = await ctx.db.get(userId);
    const isManager = (league.managers && league.managers.includes(userId)) || false;
    const isOwner = league.creatorId === userId;
    const isGlobalAdmin = !!user?.isGlobalAdmin;
    if (!(isOwner || isManager || isGlobalAdmin)) {
      throw new Error("You do not have permission to manage this league.");
    }

    // Only allow rollback from voting -> submissions
    if (round.status !== "voting") {
      throw new Error("Can only rollback a round that is currently in the voting phase.");
    }

    // Reopen submissions for 24 hours from now, and shift voting deadline accordingly
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const newSubmissionDeadline = now + oneDayMs;
    const newVotingDeadline = newSubmissionDeadline + league.votingDeadline * 60 * 60 * 1000;

    await ctx.db.patch(round._id, {
      status: "submissions",
      submissionDeadline: newSubmissionDeadline,
      votingDeadline: newVotingDeadline,
    });

    // Notify league members that submissions have been reopened
    await ctx.scheduler.runAfter(0, internal.notifications.createForLeague, {
      leagueId: league._id,
      type: "round_submission",
      message: `The round "${round.title}" has been reopened for submissions for 24 hours in "${league.name}"!`,
      link: `/leagues/${league._id}/round/${round._id}`,
      triggeringUserId: userId,
    });

    return { success: true };
  },
});

export const updateRound = mutation({
  args: {
    roundId: v.id("rounds"),
    title: v.string(),
    description: v.string(),
    submissionsPerUser: v.number(),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round) throw new Error("Round not found.");
    const { league, userId: adminUserId } = await checkOwnership(ctx, round.leagueId);

    if (round.status === "finished") {
      throw new Error("Cannot edit a finished round.");
    }

    const submissionsPerUserChanged = round.submissionsPerUser !== args.submissionsPerUser;
    if (submissionsPerUserChanged && round.status === "voting") {
      throw new Error("Cannot change the number of submissions for a round that is in the voting phase.");
    }

    if (submissionsPerUserChanged && round.status === "submissions") {
      const submissions = await ctx.db.query("submissions").withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId)).collect();
      if (submissions.length > 0) {
        for (const submission of submissions) {
          await ctx.db.delete(submission._id);
          await submissionsByUser.delete(ctx, submission);
          await submissionCounter.dec(ctx, round._id);
          const comments = await ctx.db.query("comments").withIndex("by_submission", (q) => q.eq("submissionId", submission._id)).collect();
          for (const comment of comments) {
            await ctx.db.delete(comment._id);
          }
        }
        await ctx.scheduler.runAfter(0, internal.notifications.createForLeague, {
          leagueId: league._id,
          type: "round_submission",
          message: `The round "${round.title}" in "${league.name}" was updated. Please submit your song again.`,
          link: `/leagues/${league._id}/round/${round._id}`,
          triggeringUserId: adminUserId,
        });
      }
    }

    const { roundId, ...updates } = args;
    await ctx.db.patch(roundId, updates);
    return "Round updated successfully.";
  },
});

const songVoteDetailValidator = v.object({
  voterId: v.id("users"),
  voterName: v.string(),
  voterImage: v.union(v.string(), v.null()),
  score: v.number(),
});

const voteSummaryValidator = v.array(
  v.object({
    submissionId: v.id("submissions"),
    songTitle: v.string(),
    artist: v.string(),
    submittedById: v.id("users"),
    submittedByName: v.string(),
    submittedByImage: v.union(v.string(), v.null()),
    albumArtUrl: v.union(v.string(), v.null()),
    votes: v.array(songVoteDetailValidator),
  }),
);

export const getVoteSummary = query({
  args: { roundId: v.id("rounds") },
  returns: voteSummaryValidator,
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round || round.status !== "finished") {
      return [];
    }
    const votes = await ctx.db.query("votes").withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId)).collect();
    if (votes.length === 0) return [];

    const submissions = await ctx.db.query("submissions").withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId)).collect();
    const allUserIds = new Set<Id<"users">>();
    votes.forEach((v) => allUserIds.add(v.userId));
    submissions.forEach((s) => allUserIds.add(s.userId));

    const users = await Promise.all(Array.from(allUserIds).map((userId) => ctx.db.get(userId)));
    const userMap = new Map(users.filter((u): u is Doc<"users"> => u !== null).map((user) => [user._id.toString(), user]));

    const votesBySubmission = new Map<string, Doc<"votes">[]>();
    for (const vote of votes) {
      const subId = vote.submissionId.toString();
      if (!votesBySubmission.has(subId)) {
        votesBySubmission.set(subId, []);
      }
      votesBySubmission.get(subId)!.push(vote);
    }

    const summary = await Promise.all(
      submissions.map(async (submission) => {
        const submitter = userMap.get(submission.userId.toString());
        const submissionVotes = votesBySubmission.get(submission._id.toString()) || [];
        const voteDetails = submissionVotes.map((vote) => {
          const voter = userMap.get(vote.userId.toString());
          return {
            voterId: vote.userId,
            voterName: voter?.name ?? "Unknown",
            voterImage: voter?.image ?? null,
            score: vote.vote,
          };
        });

        let albumArtUrl: string | null = null;
        if (submission.submissionType === "file" && submission.albumArtKey) {
          albumArtUrl = await r2.getUrl(submission.albumArtKey);
        } else {
          albumArtUrl = submission.albumArtUrlValue ?? null;
        }

        return {
          submissionId: submission._id,
          songTitle: submission.songTitle,
          artist: submission.artist,
          submittedById: submission.userId,
          submittedByName: submitter?.name ?? "Unknown",
          submittedByImage: submitter?.image ?? null,
          albumArtUrl: albumArtUrl,
          votes: voteDetails,
        };
      }),
    );

    return summary;
  },
});

export const transitionDueRounds = internalAction({
  handler: async (ctx) => {
    const now = Date.now();

    const dueForVoting = await ctx.runQuery(internal.rounds.getDueForVoting, { now });
    for (const round of dueForVoting) {
      try {
        await ctx.runMutation(internal.rounds.transitionRoundToVoting, { roundId: round._id });
      } catch (error) {
        console.error(`Failed to transition round ${round._id} to voting:`, error);
      }
    }

    const dueForFinishing = await ctx.runQuery(internal.rounds.getDueForFinishing, { now });
    for (const round of dueForFinishing) {
      try {
        await ctx.runMutation(internal.rounds.transitionRoundToFinished, { roundId: round._id });
      } catch (error) {
        console.error(`Failed to transition round ${round._id} to finished:`, error);
      }
    }
  },
});

export const getDueForVoting = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    return await ctx.db
      .query("rounds")
      .filter((q) => q.eq(q.field("status"), "submissions"))
      .filter((q) => q.lte(q.field("submissionDeadline"), now))
      .collect();
  },
});

export const getDueForFinishing = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    return await ctx.db
      .query("rounds")
      .filter((q) => q.eq(q.field("status"), "voting"))
      .filter((q) => q.lte(q.field("votingDeadline"), now))
      .collect();
  },
});

export const transitionRoundToVoting = internalMutation({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const round = await ctx.db.get(roundId);
    if (!round || round.status !== "submissions") return;
    if (round.submissionDeadline > Date.now()) return;

    await ctx.db.patch(roundId, { status: "voting" });

    const league = await ctx.db.get(round.leagueId);
    if (league) {
      await ctx.scheduler.runAfter(0, internal.notifications.createForLeague, {
        leagueId: league._id,
        type: "round_voting",
        message: `Voting has begun for the round "${round.title}" in "${league.name}"!`,
        link: `/leagues/${league._id}/round/${round._id}`,
      });
    }
  },
});

export const transitionRoundToFinished = internalMutation({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const round = await ctx.db.get(roundId);
    if (!round || round.status !== "voting") return;
    if (round.votingDeadline > Date.now()) return;

    await ctx.db.patch(roundId, { status: "finished" });

    await ctx.scheduler.runAfter(0, internal.leagues.calculateAndStoreResults, { roundId });
    await ctx.scheduler.runAfter(0, internal.leagues.updateLeagueStats, { leagueId: round.leagueId });

    const league = await ctx.db.get(round.leagueId);
    if (league) {
      await ctx.scheduler.runAfter(0, internal.notifications.createForLeague, {
        leagueId: league._id,
        type: "round_finished",
        message: `The round "${round.title}" in "${league.name}" has finished! Check out the results.`,
        link: `/leagues/${league._id}/round/${round._id}`,
      });
    }
  },
});