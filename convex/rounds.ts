import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalAction,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { submissionCounter, voterCounter } from "./counters";
import { paginationOptsValidator } from "convex/server";
import { submissionsByUser } from "./aggregates";
import {
  requireOwnerManagerOrGlobalAdmin,
  requireOwnerOrGlobalAdmin,
} from "../lib/convex-server/rounds/permissions";
import {
  transitionRoundToFinishedWithSideEffects,
  transitionRoundToVotingWithSideEffects,
} from "../lib/convex-server/rounds/transitions";
import { resolveSubmissionMediaUrls } from "../lib/convex-server/submissions/media";
import { B2Storage } from "./b2Storage";
import { resolveUserAvatarUrl } from "./userAvatar";

const storage = new B2Storage();

async function canViewLeague(
  ctx: Pick<QueryCtx, "db">,
  leagueId: Id<"leagues">,
  userId: Id<"users"> | null,
) {
  const league = await ctx.db.get("leagues", leagueId);
  if (!league) {
    return { league: null, canView: false as const };
  }

  if (league.isPublic) {
    return { league, canView: true as const };
  }

  if (!userId) {
    return { league, canView: false as const };
  }

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_league_and_user", (q) =>
      q.eq("leagueId", leagueId).eq("userId", userId),
    )
    .first();

  return { league, canView: Boolean(membership) };
}

export const get = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) {
      return null;
    }

    const { canView } = await canViewLeague(ctx, round.leagueId, userId);
    if (!canView) {
      return null;
    }

    return round;
  },
});

export const getRoundMetadata = query({
  args: {
    roundId: v.id("rounds"),
    includeImageUrl: v.optional(v.boolean()),
  },
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
    const userId = await getAuthUserId(ctx);
    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) {
      return null;
    }

    const { league, canView } = await canViewLeague(
      ctx,
      round.leagueId,
      userId,
    );
    if (!league || !canView) {
      return null;
    }
    const includeImageUrl = args.includeImageUrl ?? true;
    const imageUrl = round.imageKey
      ? includeImageUrl
        ? await storage.getUrl(round.imageKey)
        : null
      : null;
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
    includeArt: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const { league, canView } = await canViewLeague(ctx, args.leagueId, userId);
    if (!league || !canView) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    const includeArt = args.includeArt ?? false;
    const artStorage = includeArt ? storage : null;
    const paginationResult = await ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .order("desc")
      .paginate(args.paginationOpts);

    const leagueName = league?.name ?? "Unknown League";

    // Count only non-spectator members for submission/voting tracking
    const allMemberships = await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    const leagueMemberCount = allMemberships.filter(
      (m) => !m.isSpectator,
    ).length;

    const finishedRounds = paginationResult.page.filter(
      (round) => round.status === "finished",
    );
    const winnerInfosByRound = new Map<
      string,
      {
        name: string;
        image: string | null;
        songTitle: string;
        points: number;
      }[]
    >();
    if (finishedRounds.length > 0) {
      const winnerResultsByRound = await Promise.all(
        finishedRounds.map((round) =>
          ctx.db
            .query("roundResults")
            .withIndex("by_round_and_winner", (q) =>
              q.eq("roundId", round._id).eq("isWinner", true),
            )
            .collect(),
        ),
      );

      const allWinnerResults = winnerResultsByRound.flat();
      const winnerUserIds = [
        ...new Set(allWinnerResults.map((result) => result.userId)),
      ];
      const winnerSubmissionIds = [
        ...new Set(allWinnerResults.map((result) => result.submissionId)),
      ];
      const [winnerUsers, winnerSubmissions] = await Promise.all([
        Promise.all(winnerUserIds.map((userId) => ctx.db.get("users", userId))),
        Promise.all(
          winnerSubmissionIds.map((submissionId) =>
            ctx.db.get("submissions", submissionId),
          ),
        ),
      ]);

      const winnerUserById = new Map(
        winnerUsers
          .filter((user): user is NonNullable<typeof user> => user !== null)
          .map((user) => [user._id.toString(), user]),
      );
      const winnerSubmissionById = new Map(
        winnerSubmissions
          .filter(
            (submission): submission is NonNullable<typeof submission> =>
              submission !== null,
          )
          .map((submission) => [submission._id.toString(), submission]),
      );

      const winnerInfosByRoundEntries = await Promise.all(
        winnerResultsByRound.map(async (winnerResults, index) => {
          const roundId = finishedRounds[index]._id.toString();
          const winnerInfos = await Promise.all(
            winnerResults.map(async (winnerResult) => {
              const winnerUser = winnerUserById.get(
                winnerResult.userId.toString(),
              );
              const winnerSubmission = winnerSubmissionById.get(
                winnerResult.submissionId.toString(),
              );
              if (!winnerUser || !winnerSubmission) {
                return null;
              }
              const winnerImage = await resolveUserAvatarUrl(storage, winnerUser);
              return {
                name: winnerUser.name ?? "Unknown",
                image: winnerImage,
                songTitle: winnerSubmission.songTitle,
                points: winnerResult.points,
              };
            }),
          );
          return [
            roundId,
            winnerInfos.filter(
              (winner): winner is NonNullable<typeof winner> => winner !== null,
            ),
          ] as const;
        }),
      );
      winnerInfosByRoundEntries.forEach(([roundId, winnerInfos]) => {
        winnerInfosByRound.set(roundId, winnerInfos);
      });
    }

    const roundsWithDetails = await Promise.all(
      paginationResult.page.map(async (round) => {
        const isVoting = round.status === "voting";

        // Lightweight counts using sharded counters
        const [submissionCount, voterCount] = await Promise.all([
          submissionCounter.count(ctx, round._id),
          isVoting ? voterCounter.count(ctx, round._id) : Promise.resolve(0),
        ]);

        const requiredPerUser = round.submissionsPerUser ?? 1;

        // Winners (small result set)
        let winnerInfo: {
          name: string;
          image: string | null;
          songTitle: string;
          points: number;
        } | null = null;
        let winnersInfo: {
          name: string;
          image: string | null;
          songTitle: string;
          points: number;
        }[] = [];

        if (round.status === "finished") {
          winnersInfo = winnerInfosByRound.get(round._id.toString()) ?? [];
          if (winnersInfo.length > 0) {
            winnerInfo = winnersInfo[0]; // backward-compatible single winner for existing UI
          }
        }

        const artUrl =
          includeArt && round.imageKey && artStorage
            ? await artStorage.getUrl(round.imageKey)
            : null;
        const expectedTrackCount = leagueMemberCount * requiredPerUser;

        const voters: {
          name: string | null | undefined;
          image: string | null | undefined;
        }[] = [];

        return {
          ...round,
          art: artUrl,
          leagueName,
          submissionCount, // total submitted tracks from counter
          expectedTrackCount,
          leagueMemberCount,
          voterCount,
          submitters: [],
          voters,
          winner: winnerInfo,
          winners: winnersInfo,
        };
      }),
    );

    const sortedRounds = roundsWithDetails.sort((a, b) => {
      const aIsActive = a.status === "submissions" || a.status === "voting";
      const bIsActive = b.status === "submissions" || b.status === "voting";

      if (aIsActive !== bIsActive) {
        return aIsActive ? -1 : 1;
      }

      const getRelevantDeadline = (
        round: (typeof roundsWithDetails)[number],
      ) => {
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

      if (aIsActive && bIsActive) {
        return aDeadline - bDeadline;
      }

      return bDeadline - aDeadline;
    });

    return { ...paginationResult, page: sortedRounds };
  },
});

export const getActiveForUser = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<Doc<"rounds"> & { leagueName: string; art: string | null }>
  > => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (memberships.length === 0) return [];
    const leagueIds = [
      ...new Set(memberships.map((membership) => membership.leagueId)),
    ];
    const userLeagues = (
      await Promise.all(
        leagueIds.map((leagueId) => ctx.db.get("leagues", leagueId)),
      )
    ).filter((l): l is Doc<"leagues"> => l !== null);
    if (userLeagues.length === 0) return [];
    const activeRoundGroups = await Promise.all(
      userLeagues.map(async (league) => {
        const [submissionRounds, votingRounds] = await Promise.all([
          ctx.db
            .query("rounds")
            .withIndex("by_league_and_status", (q) =>
              q.eq("leagueId", league._id).eq("status", "submissions"),
            )
            .collect(),
          ctx.db
            .query("rounds")
            .withIndex("by_league_and_status", (q) =>
              q.eq("leagueId", league._id).eq("status", "voting"),
            )
            .collect(),
        ]);
        return Promise.all(
          [...submissionRounds, ...votingRounds].map(async (round) => {
            const artUrl = round.imageKey
              ? await storage.getUrl(round.imageKey)
              : null;
            return {
              ...round,
              leagueName: league.name,
              art: artUrl,
            };
          }),
        );
      }),
    );
    const allActiveRounds = activeRoundGroups.flat();
    allActiveRounds.sort((a, b) => {
      const aDeadline =
        a.status === "submissions" ? a.submissionDeadline : a.votingDeadline;
      const bDeadline =
        b.status === "submissions" ? b.submissionDeadline : b.votingDeadline;
      return aDeadline - bDeadline;
    });
    return allActiveRounds;
  },
});

export const manageRoundState = mutation({
  args: {
    roundId: v.id("rounds"),
    action: v.union(v.literal("startVoting"), v.literal("endVoting")),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) throw new Error("Round not found");
    const { league, userId } = await requireOwnerOrGlobalAdmin(
      ctx,
      round.leagueId,
    );

    switch (args.action) {
      case "startVoting":
        if (round.status !== "submissions")
          throw new Error("Round is not in submission phase.");
        await transitionRoundToVotingWithSideEffects(
          ctx,
          round,
          league,
          userId,
        );
        break;
      case "endVoting":
        if (round.status !== "voting")
          throw new Error("Round is not in voting phase.");
        const submission = await ctx.db
          .query("submissions")
          .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
          .first();
        const vote = await ctx.db
          .query("votes")
          .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
          .first();
        if (!submission) {
          throw new Error(
            "Cannot end round: at least one song must be submitted.",
          );
        }
        if (!vote) {
          throw new Error("Cannot end round: at least one vote must be cast.");
        }
        await transitionRoundToFinishedWithSideEffects(ctx, round, league, {
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
    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) throw new Error("Round not found");
    await requireOwnerManagerOrGlobalAdmin(ctx, round.leagueId);

    const now = Date.now();
    const timeAdjustment = args.hours * 60 * 60 * 1000;

    if (round.status === "submissions") {
      const newSubmissionDeadline = round.submissionDeadline + timeAdjustment;
      if (newSubmissionDeadline < now) {
        throw new Error(
          "Cannot set submission deadline to a time in the past.",
        );
      }
      await ctx.db.patch("rounds", round._id, {
        submissionDeadline: newSubmissionDeadline,
        votingDeadline: round.votingDeadline + timeAdjustment,
      });
    } else if (round.status === "voting") {
      const newVotingDeadline = round.votingDeadline + timeAdjustment;
      if (newVotingDeadline < now) {
        throw new Error("Cannot set voting deadline to a time in the past.");
      }
      await ctx.db.patch("rounds", round._id, {
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
    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) throw new Error("Round not found");
    const { league, userId } = await requireOwnerManagerOrGlobalAdmin(
      ctx,
      round.leagueId,
    );

    // Only allow rollback from voting -> submissions
    if (round.status !== "voting") {
      throw new Error(
        "Can only rollback a round that is currently in the voting phase.",
      );
    }

    // Reopen submissions for 24 hours from now, and shift voting deadline accordingly
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const newSubmissionDeadline = now + oneDayMs;
    const newVotingDeadline =
      newSubmissionDeadline + league.votingDeadline * 60 * 60 * 1000;

    await ctx.db.patch("rounds", round._id, {
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
    maxPositiveVotes: v.optional(v.union(v.number(), v.null())),
    maxNegativeVotes: v.optional(v.union(v.number(), v.null())),
    submissionMode: v.optional(
      v.union(v.literal("single"), v.literal("multi"), v.literal("album")),
    ),
    submissionInstructions: v.optional(v.string()),
    albumConfig: v.optional(
      v.object({
        allowPartial: v.optional(v.boolean()),
        requireReleaseYear: v.optional(v.boolean()),
        minTracks: v.optional(v.number()),
        maxTracks: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) throw new Error("Round not found.");
    const { userId: adminUserId, league } = await requireOwnerOrGlobalAdmin(
      ctx,
      round.leagueId,
    );

    if (round.status === "finished") {
      throw new Error("Cannot edit a finished round.");
    }

    // Compare effective values (default undefined to 1) so changing only vote limits doesn't wipe submissions
    const prevSubmissionsPerUser = round.submissionsPerUser ?? 1;
    const nextSubmissionsPerUser = args.submissionsPerUser ?? 1;
    const submissionsPerUserChanged =
      prevSubmissionsPerUser !== nextSubmissionsPerUser;
    if (submissionsPerUserChanged && round.status === "voting") {
      throw new Error(
        "Cannot change the number of submissions for a round that is in the voting phase.",
      );
    }

    if (submissionsPerUserChanged && round.status === "submissions") {
      const submissions = await ctx.db
        .query("submissions")
        .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
        .collect();
      if (submissions.length > 0) {
        const commentsBySubmission = await Promise.all(
          submissions.map((submission) =>
            ctx.db
              .query("comments")
              .withIndex("by_submission", (q) =>
                q.eq("submissionId", submission._id),
              )
              .collect(),
          ),
        );
        const commentDeleteOps = commentsBySubmission
          .flat()
          .map((comment) => ctx.db.delete("comments", comment._id));
        await Promise.all(commentDeleteOps);

        await Promise.all(
          submissions.map(async (submission) => {
            await Promise.all([
              ctx.db.delete("submissions", submission._id),
              submissionsByUser.delete(ctx, submission),
              submissionCounter.dec(ctx, round._id),
            ]);
          }),
        );
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.createForLeague,
          {
            leagueId: league._id,
            type: "round_submission",
            message: `The round "${round.title}" in "${league.name}" was updated. Please submit your song again.`,
            link: `/leagues/${league._id}/round/${round._id}`,
            triggeringUserId: adminUserId,
          },
        );
      }
    }

    const { roundId, ...updates } = args;
    await ctx.db.patch("rounds", roundId, updates);
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
    const userId = await getAuthUserId(ctx);
    const round = await ctx.db.get("rounds", args.roundId);
    if (!round || round.status !== "finished") {
      return [];
    }

    const { canView } = await canViewLeague(ctx, round.leagueId, userId);
    if (!canView) {
      return [];
    }

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
      .collect();
    if (votes.length === 0) return [];

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
      .collect();
    const allUserIds = new Set<Id<"users">>();
    votes.forEach((v) => allUserIds.add(v.userId));
    submissions.forEach((s) => allUserIds.add(s.userId));

    const users = await Promise.all(
      Array.from(allUserIds).map((userId) => ctx.db.get("users", userId)),
    );
    const userMap = new Map(
      users
        .filter((u): u is Doc<"users"> => u !== null)
        .map((user) => [user._id.toString(), user]),
    );

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
        const submissionVotes =
          votesBySubmission.get(submission._id.toString()) || [];
        const voteDetails = await Promise.all(submissionVotes.map(async (vote) => {
          const voter = userMap.get(vote.userId.toString());
          const voterImage = await resolveUserAvatarUrl(storage, voter);
          return {
            voterId: vote.userId,
            voterName: voter?.name ?? "Unknown",
            voterImage,
            score: vote.vote,
          };
        }));

        const { albumArtUrl } = await resolveSubmissionMediaUrls(
          storage,
          submission,
        );

        const submittedByImage = await resolveUserAvatarUrl(storage, submitter);
        return {
          submissionId: submission._id,
          songTitle: submission.songTitle,
          artist: submission.artist,
          submittedById: submission.userId,
          submittedByName: submitter?.name ?? "Unknown",
          submittedByImage,
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

    const dueForVoting = await ctx.runQuery(internal.rounds.getDueForVoting, {
      now,
    });
    const votingTransitions = await Promise.allSettled(
      dueForVoting.map((round) =>
        ctx.runMutation(internal.rounds.transitionRoundToVoting, {
          roundId: round._id,
        }),
      ),
    );
    for (const [index, transition] of votingTransitions.entries()) {
      if (transition.status === "rejected") {
        const round = dueForVoting[index];
        console.error(
          `Failed to transition round ${round._id} to voting:`,
          transition.reason,
        );
      }
    }

    const dueForFinishing = await ctx.runQuery(
      internal.rounds.getDueForFinishing,
      { now },
    );
    const finishingTransitions = await Promise.allSettled(
      dueForFinishing.map((round) =>
        ctx.runMutation(internal.rounds.transitionRoundToFinished, {
          roundId: round._id,
        }),
      ),
    );
    for (const [index, transition] of finishingTransitions.entries()) {
      if (transition.status === "rejected") {
        const round = dueForFinishing[index];
        console.error(
          `Failed to transition round ${round._id} to finished:`,
          transition.reason,
        );
      }
    }
  },
});

export const getDueForVoting = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    return await ctx.db
      .query("rounds")
      .withIndex("by_status_and_submission_deadline", (q) =>
        q.eq("status", "submissions").lte("submissionDeadline", now),
      )
      .collect();
  },
});

export const getDueForFinishing = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    return await ctx.db
      .query("rounds")
      .withIndex("by_status_and_voting_deadline", (q) =>
        q.eq("status", "voting").lte("votingDeadline", now),
      )
      .collect();
  },
});

export const transitionRoundToVoting = internalMutation({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const round = await ctx.db.get("rounds", roundId);
    if (!round || round.status !== "submissions") return;
    if (round.submissionDeadline > Date.now()) return;

    const league = await ctx.db.get("leagues", round.leagueId);
    if (league) {
      await transitionRoundToVotingWithSideEffects(ctx, round, league);
    }
  },
});

export const transitionRoundToFinished = internalMutation({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const round = await ctx.db.get("rounds", roundId);
    if (!round || round.status !== "voting") return;
    if (round.votingDeadline > Date.now()) return;

    const league = await ctx.db.get("leagues", round.leagueId);
    if (league) {
      await transitionRoundToFinishedWithSideEffects(ctx, round, league);
    }
  },
});
