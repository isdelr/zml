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
  transitionRoundToSubmissionsWithSideEffects,
  transitionRoundToFinishedWithSideEffects,
  transitionRoundToVotingWithSideEffects,
} from "../lib/convex-server/rounds/transitions";
import { maybeAutoStartVotingAfterSubmissionCompletion } from "../lib/convex-server/rounds/auto-transition";
import { resolveSubmissionMediaUrls } from "../lib/convex-server/submissions/media";
import { B2Storage } from "./b2Storage";
import { resolveUserAvatarUrl } from "./userAvatar";
import { getSubmissionFileProcessingStatus } from "../lib/submission/file-processing";
import {
  buildRoundDeadlineReminderMessage,
  buildRoundDeadlineReminderSource,
  buildRoundDeadlineReminderTitle,
  getRoundDeadlineReminderCandidates,
} from "../lib/rounds/deadline-reminders";
import {
  getPendingRoundParticipantIds,
  getPendingSubmissionParticipantIds,
  getPendingVotingParticipantIds,
} from "../lib/rounds/pending-participation";
import { getVoteLimits } from "../lib/convex-server/voteLimits";
import {
  buildLeagueRoundSchedule,
  buildRoundStartNowPatches,
  buildRoundShiftPatches,
  buildScheduledRoundResequencePatches,
  getSubmissionStart,
  hoursToMs,
  ROUND_GAP_MS,
  sortRoundsInLeagueOrder,
} from "../lib/rounds/schedule";
import {
  buildRoundImageMediaUrl,
  resolveMediaAccessScope,
} from "../lib/media/delivery";

const storage = new B2Storage();
type DeadlineReminderContext = {
  roundId: Id<"rounds">;
  leagueId: Id<"leagues">;
  leagueName: string;
  roundTitle: string;
  status: "scheduled" | "submissions" | "voting" | "finished";
  submissionStartsAt: number;
  submissionDeadline: number;
  votingDeadline: number;
  targetUserIds: Id<"users">[];
};

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

function buildRoundImageScope(
  allowPublic: boolean,
  viewerUserId: Id<"users"> | null,
) {
  return resolveMediaAccessScope(allowPublic, viewerUserId);
}

async function hasIncompleteFileSubmissions(
  ctx: Pick<QueryCtx, "db">,
  roundId: Id<"rounds">,
) {
  const submissions = await ctx.db
    .query("submissions")
    .withIndex("by_round_and_user", (q) => q.eq("roundId", roundId))
    .collect();

  return submissions.some((submission) => {
    if (submission.submissionType !== "file") {
      return false;
    }
    return getSubmissionFileProcessingStatus(submission) !== "ready";
  });
}

function getNextRoundOrder(rounds: Array<Pick<Doc<"rounds">, "order">>) {
  return (
    rounds.reduce(
      (maxOrder, round) => Math.max(maxOrder, round.order ?? -1),
      -1,
    ) + 1
  );
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
    const imageScope = buildRoundImageScope(league.isPublic, userId);
    const imageUrl = round.imageKey
      ? includeImageUrl && imageScope
        ? await buildRoundImageMediaUrl({
            roundId: round._id,
            storageKey: round.imageKey,
            scope: imageScope,
          })
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

export const getPublicImageKey = query({
  args: { roundId: v.id("rounds") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const round = await ctx.db.get("rounds", args.roundId);
    return round?.imageKey ?? null;
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
      .order("asc")
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
              const winnerImage = await resolveUserAvatarUrl(
                storage,
                winnerUser,
              );
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
            ? await buildRoundImageMediaUrl({
                roundId: round._id,
                storageKey: round.imageKey,
                scope: buildRoundImageScope(league.isPublic, userId) ?? {
                  type: "public",
                },
              })
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
          submissionCount: round.status === "scheduled" ? 0 : submissionCount,
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

    return {
      ...paginationResult,
      page: sortRoundsInLeagueOrder(roundsWithDetails),
    };
  },
});

export const manageRoundState = mutation({
  args: {
    roundId: v.id("rounds"),
    action: v.union(
      v.literal("startSubmissions"),
      v.literal("startVoting"),
      v.literal("endVoting"),
    ),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) throw new Error("Round not found");
    const { league, userId } = await requireOwnerOrGlobalAdmin(
      ctx,
      round.leagueId,
    );

    switch (args.action) {
      case "startSubmissions": {
        if (round.status !== "scheduled") {
          throw new Error("Round is not scheduled.");
        }

        const leagueRounds = await ctx.db
          .query("rounds")
          .withIndex("by_league", (q) => q.eq("leagueId", round.leagueId))
          .collect();
        const sortedRounds = sortRoundsInLeagueOrder(leagueRounds);
        const roundIndex = sortedRounds.findIndex(
          (leagueRound) => leagueRound._id === round._id,
        );

        if (roundIndex === -1) {
          throw new Error("Round not found in league schedule.");
        }

        const earlierActiveRound = sortedRounds
          .slice(0, roundIndex)
          .find((leagueRound) => leagueRound.status !== "finished");

        if (earlierActiveRound) {
          throw new Error(
            "Cannot start this round while an earlier round in the league is still active.",
          );
        }

        const shiftPatches = buildRoundStartNowPatches({
          rounds: sortedRounds.map((leagueRound) => ({
            ...leagueRound,
            _id: leagueRound._id.toString(),
          })),
          roundId: round._id.toString(),
          now: Date.now(),
          submissionHours: league.submissionDeadline,
        });
        const currentRoundPatch = shiftPatches.find(
          ({ roundId }) => roundId === round._id.toString(),
        )?.patch;

        if (shiftPatches.length > 0) {
          await Promise.all(
            shiftPatches.map(({ roundId, patch }) =>
              ctx.db.patch("rounds", roundId as Id<"rounds">, patch),
            ),
          );
        }

        const didTransition = await transitionRoundToSubmissionsWithSideEffects(
          ctx,
          currentRoundPatch
            ? {
                ...round,
                submissionStartsAt:
                  currentRoundPatch.submissionStartsAt ??
                  getSubmissionStart(round, league.submissionDeadline),
                submissionDeadline: currentRoundPatch.submissionDeadline,
                votingDeadline: currentRoundPatch.votingDeadline,
              }
            : round,
          league,
          userId,
        );
        if (didTransition) {
          await maybeAutoStartVotingAfterSubmissionCompletion(
            ctx,
            round._id,
            userId,
          );
        }
        break;
      }
      case "startVoting": {
        if (round.status !== "submissions")
          throw new Error("Round is not in submission phase.");
        if (await hasIncompleteFileSubmissions(ctx, args.roundId)) {
          throw new Error(
            "Cannot start voting while some file uploads are still being prepared or need attention.",
          );
        }
        await transitionRoundToVotingWithSideEffects(
          ctx,
          round,
          league,
          userId,
        );
        break;
      }
      case "endVoting": {
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
    const { league } = await requireOwnerManagerOrGlobalAdmin(ctx, round.leagueId);

    const now = Date.now();
    const timeAdjustment = hoursToMs(args.hours);
    const leagueRounds = await ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", round.leagueId))
      .collect();
    const sortedRounds = sortRoundsInLeagueOrder(leagueRounds);
    const shiftPatches = buildRoundShiftPatches({
      rounds: sortedRounds.map((leagueRound) => ({
        ...leagueRound,
        _id: leagueRound._id.toString(),
      })),
      roundId: args.roundId.toString(),
      adjustmentMs: timeAdjustment,
    });
    const currentRoundPatch = shiftPatches.find(
      ({ roundId }) => roundId === args.roundId.toString(),
    )?.patch;

    if (!currentRoundPatch) {
      throw new Error("Could not determine the updated round schedule.");
    }

    if (round.status === "scheduled") {
      const roundIndex = sortedRounds.findIndex(
        (leagueRound) => leagueRound._id === round._id,
      );
      const previousRound = roundIndex > 0 ? sortedRounds[roundIndex - 1] : null;
      const newSubmissionStartsAt =
        currentRoundPatch.submissionStartsAt ?? round.submissionStartsAt;

      if (newSubmissionStartsAt === undefined) {
        throw new Error("Scheduled round is missing a submission start time.");
      }
      if (newSubmissionStartsAt < now) {
        throw new Error("Cannot move a scheduled round to start in the past.");
      }
      if (
        previousRound &&
        newSubmissionStartsAt < previousRound.votingDeadline + ROUND_GAP_MS
      ) {
        throw new Error(
          "Cannot move this round earlier because it would overlap the previous round.",
        );
      }
    }

    if (round.status === "submissions") {
      const [memberships, submissions] = await Promise.all([
        ctx.db
          .query("memberships")
          .withIndex("by_league", (q) => q.eq("leagueId", round.leagueId))
          .collect(),
        ctx.db
          .query("submissions")
          .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
          .collect(),
      ]);
      const activeMembers = memberships
        .filter((membership) => !membership.isBanned && !membership.isSpectator)
        .map((membership) => ({ _id: membership.userId }));
      const targetUserIds = getPendingSubmissionParticipantIds(
        activeMembers,
        submissions,
        round.submissionsPerUser ?? 1,
        round.submissionMode ?? "single",
      );
      const newSubmissionDeadline = currentRoundPatch.submissionDeadline;
      if (newSubmissionDeadline < now) {
        throw new Error(
          "Cannot set submission deadline to a time in the past.",
        );
      }
      await Promise.all(
        shiftPatches.map(({ roundId, patch }) =>
          ctx.db.patch("rounds", roundId as Id<"rounds">, patch),
        ),
      );
      await ctx.scheduler.runAfter(0, internal.notifications.createForLeagueAndDispatchDiscord, {
        leagueId: round.leagueId,
        roundId: round._id,
        roundStatus: "submissions",
        notificationType: "round_submission",
        discordNotificationKind: "deadline_changed",
        message: `The submission deadline for "${round.title}" in "${league.name}" was updated.`,
        link: `/leagues/${round.leagueId}/round/${round._id}`,
        deadlineMs: newSubmissionDeadline,
        metadata: {
          source: `round-deadline-change:${round._id}:submissions:${newSubmissionDeadline}:${currentRoundPatch.votingDeadline}`,
        },
        targetUserIds: targetUserIds.map(
          (targetUserId) => targetUserId as Id<"users">,
        ),
        pushNotificationOverride: {
          title: "Submission Deadline Changed",
          body: `The submission deadline for "${round.title}" in "${league.name}" was updated.`,
        },
      });
    } else if (round.status === "voting") {
      const [memberships, submissions, votes] = await Promise.all([
        ctx.db
          .query("memberships")
          .withIndex("by_league", (q) => q.eq("leagueId", round.leagueId))
          .collect(),
        ctx.db
          .query("submissions")
          .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
          .collect(),
        ctx.db
          .query("votes")
          .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
          .collect(),
      ]);
      const activeMembers = memberships
        .filter((membership) => !membership.isBanned && !membership.isSpectator)
        .map((membership) => ({ _id: membership.userId }));
      const { maxUp, maxDown } = getVoteLimits(round, league);
      const targetUserIds = getPendingVotingParticipantIds(
        activeMembers,
        submissions,
        votes,
        maxUp,
        maxDown,
      );
      const newVotingDeadline = currentRoundPatch.votingDeadline;
      if (newVotingDeadline < now) {
        throw new Error("Cannot set voting deadline to a time in the past.");
      }
      await Promise.all(
        shiftPatches.map(({ roundId, patch }) =>
          ctx.db.patch("rounds", roundId as Id<"rounds">, patch),
        ),
      );
      await ctx.scheduler.runAfter(0, internal.notifications.createForLeagueAndDispatchDiscord, {
        leagueId: round.leagueId,
        roundId: round._id,
        roundStatus: "voting",
        notificationType: "round_voting",
        discordNotificationKind: "deadline_changed",
        message: `The voting deadline for "${round.title}" in "${league.name}" was updated.`,
        link: `/leagues/${round.leagueId}/round/${round._id}`,
        deadlineMs: newVotingDeadline,
        metadata: {
          source: `round-deadline-change:${round._id}:voting:${newVotingDeadline}`,
        },
        targetUserIds: targetUserIds.map(
          (targetUserId) => targetUserId as Id<"users">,
        ),
        pushNotificationOverride: {
          title: "Voting Deadline Changed",
          body: `The voting deadline for "${round.title}" in "${league.name}" was updated.`,
        },
      });
    } else if (round.status === "scheduled") {
      await Promise.all(
        shiftPatches.map(({ roundId, patch }) =>
          ctx.db.patch("rounds", roundId as Id<"rounds">, patch),
        ),
      );
    } else {
      throw new Error("Cannot adjust time for a finished round.");
    }
  },
});

export const sendParticipationReminder = mutation({
  args: {
    roundId: v.id("rounds"),
  },
  returns: v.object({
    notifiedCount: v.number(),
    status: v.union(v.literal("submissions"), v.literal("voting")),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ notifiedCount: number; status: "submissions" | "voting" }> => {
    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) {
      throw new Error("Round not found");
    }

    if (round.status === "finished") {
      throw new Error("Cannot send reminders for a finished round.");
    }

    if (round.status === "scheduled") {
      throw new Error("Cannot send reminders before a round has started.");
    }

    const { league, userId } = await requireOwnerManagerOrGlobalAdmin(
      ctx,
      round.leagueId,
    );

    const [memberships, submissions] = await Promise.all([
      ctx.db
        .query("memberships")
        .withIndex("by_league", (q) => q.eq("leagueId", league._id))
        .collect(),
      ctx.db
        .query("submissions")
        .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
        .collect(),
    ]);

    const activeMembers = memberships
      .filter((membership) => !membership.isBanned && !membership.isSpectator)
      .map((membership) => ({ _id: membership.userId }));

    let targetUserIds: string[] = [];
    let type: "round_submission" | "round_voting";
    let message: string;
    let title: string;
    let status: "submissions" | "voting";

    if (round.status === "submissions") {
      targetUserIds = getPendingSubmissionParticipantIds(
        activeMembers,
        submissions,
        round.submissionsPerUser ?? 1,
        round.submissionMode ?? "single",
      );
      type = "round_submission";
      message = `Reminder: submit your song${(round.submissionsPerUser ?? 1) > 1 ? "s" : ""} for "${round.title}" in "${league.name}".`;
      title = "Reminder to submit";
      status = "submissions";
    } else {
      const votes = await ctx.db
        .query("votes")
        .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
        .collect();
      const { maxUp, maxDown } = getVoteLimits(round, league);
      targetUserIds = getPendingVotingParticipantIds(
        activeMembers,
        submissions,
        votes,
        maxUp,
        maxDown,
      );
      type = "round_voting";
      message = `Reminder: finish voting for "${round.title}" in "${league.name}".`;
      title = "Reminder to vote";
      status = "voting";
    }

    if (targetUserIds.length === 0) {
      return { notifiedCount: 0, status };
    }

    const targetUserIdSet = new Set(targetUserIds);
    const notificationsToCreate = memberships
      .filter((membership) => targetUserIdSet.has(membership.userId.toString()))
      .map((membership) => ({
        userId: membership.userId,
        type,
        message,
        link: `/leagues/${league._id}/round/${round._id}`,
        triggeringUserId: userId,
        pushNotificationOverride: {
          title,
          body: message,
        },
      }));

    const createdIds: Id<"notifications">[] =
      notificationsToCreate.length > 0
        ? await ctx.runMutation(internal.notifications.createMany, {
            notifications: notificationsToCreate,
          })
        : [];

    if (createdIds.length > 0) {
      await ctx.scheduler.runAfter(0, internal.discordBot.dispatchRoundNotification, {
        leagueId: league._id,
        roundId: round._id,
        roundStatus: status,
        reminderKind: "participation",
        message,
        deadlineMs:
          status === "submissions"
            ? round.submissionDeadline
            : round.votingDeadline,
        targetUserIds: targetUserIds.map((targetUserId) => targetUserId as Id<"users">),
      });
    }

    return { notifiedCount: createdIds.length, status };
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
    const oneDayMs = hoursToMs(24);
    const newSubmissionDeadline = now + oneDayMs;
    const newVotingDeadline = newSubmissionDeadline + hoursToMs(league.votingDeadline);
    const downstreamShiftMs = newVotingDeadline - round.votingDeadline;
    const leagueRounds = await ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", round.leagueId))
      .collect();
    const downstreamPatches = buildRoundShiftPatches({
      rounds: leagueRounds.map((leagueRound) => ({
        ...leagueRound,
        _id: leagueRound._id.toString(),
      })),
      roundId: round._id.toString(),
      adjustmentMs: downstreamShiftMs,
    }).filter(({ roundId }) => roundId !== round._id.toString());

    await ctx.db.patch("rounds", round._id, {
      status: "submissions",
      submissionStartsAt: now,
      submissionDeadline: newSubmissionDeadline,
      votingDeadline: newVotingDeadline,
    });
    await Promise.all(
      downstreamPatches.map(({ roundId, patch }) =>
        ctx.db.patch("rounds", roundId as Id<"rounds">, patch),
      ),
    );

    // Notify league members that submissions have been reopened
    await ctx.scheduler.runAfter(0, internal.notifications.createForLeagueAndDispatchDiscord, {
      leagueId: league._id,
      roundId: round._id,
      roundStatus: "submissions",
      notificationType: "round_submission",
      discordNotificationKind: "transition",
      message: `The round "${round.title}" has been reopened for submissions for 24 hours in "${league.name}"!`,
      link: `/leagues/${league._id}/round/${round._id}`,
      deadlineMs: newSubmissionDeadline,
      triggeringUserId: userId,
      metadata: {
        source: `round-transition:${round._id}:reopened:${newSubmissionDeadline}:${newVotingDeadline}`,
      },
      pushNotificationOverride: {
        title: "Submissions Reopened",
        body: `The round "${round.title}" has been reopened for submissions in "${league.name}".`,
      },
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
        const submissionKeysToDelete = submissions.flatMap((submission) =>
          [
            submission.albumArtKey,
            submission.songFileKey,
            submission.originalSongFileKey,
            submission.songFileLegacyKey,
          ].filter((key): key is string => Boolean(key)),
        );
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
        if (submissionKeysToDelete.length > 0) {
          await ctx.scheduler.runAfter(0, internal.submissions.deleteSubmissionFiles, {
            keys: [...new Set(submissionKeysToDelete)],
            failureLabel: "deleted round submission file",
          });
          await ctx.scheduler.runAfter(0, internal.files.markStorageUploadsDeleted, {
            keys: [...new Set(submissionKeysToDelete)],
          });
        }
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.createForLeagueAndDispatchDiscord,
          {
            leagueId: league._id,
            roundId: round._id,
            roundStatus: "submissions",
            notificationType: "round_submission",
            discordNotificationKind: "transition",
            message: `The round "${round.title}" in "${league.name}" was updated. Please submit your song again.`,
            link: `/leagues/${league._id}/round/${round._id}`,
            deadlineMs: round.submissionDeadline,
            triggeringUserId: adminUserId,
            metadata: {
              source: `round-transition:${round._id}:updated-resubmit`,
            },
            pushNotificationOverride: {
              title: "Round Updated",
              body: `The round "${round.title}" in "${league.name}" was updated. Please submit again.`,
            },
          },
        );
      }
    }

    const { roundId, ...updates } = args;
    await ctx.db.patch("rounds", roundId, updates);
    return "Round updated successfully.";
  },
});

export const createRound = mutation({
  args: {
    leagueId: v.id("leagues"),
    title: v.string(),
    description: v.string(),
    submissionsPerUser: v.number(),
    genres: v.array(v.string()),
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
    const { league, userId } = await requireOwnerManagerOrGlobalAdmin(
      ctx,
      args.leagueId,
    );

    const title = args.title.trim();
    const description = args.description.trim();
    const submissionInstructions = args.submissionInstructions?.trim() || "";
    const genres = [...new Set(args.genres.map((genre) => genre.trim()))].filter(
      (genre) => genre.length > 0,
    );

    if (title.length < 3) {
      throw new Error("Title must be at least 3 characters.");
    }
    if (description.length < 10) {
      throw new Error("Description must be at least 10 characters.");
    }
    if (args.submissionsPerUser < 1 || args.submissionsPerUser > 5) {
      throw new Error("Submissions per user must be between 1 and 5.");
    }
    if (
      args.submissionMode === "album" &&
      args.albumConfig?.minTracks !== undefined &&
      args.albumConfig?.maxTracks !== undefined &&
      args.albumConfig.minTracks > args.albumConfig.maxTracks
    ) {
      throw new Error("Minimum tracks cannot exceed maximum tracks.");
    }

    const leagueRounds = await ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    const sortedRounds = sortRoundsInLeagueOrder(leagueRounds);
    const nextOrder = getNextRoundOrder(sortedRounds);
    const existingLastRound =
      sortedRounds.length > 0 ? sortedRounds[sortedRounds.length - 1] : null;

    const schedule = existingLastRound
      ? {
          order: nextOrder,
          status: "scheduled" as const,
          submissionStartsAt: existingLastRound.votingDeadline + ROUND_GAP_MS,
          submissionDeadline:
            existingLastRound.votingDeadline +
            ROUND_GAP_MS +
            hoursToMs(league.submissionDeadline),
          votingDeadline:
            existingLastRound.votingDeadline +
            ROUND_GAP_MS +
            hoursToMs(league.submissionDeadline) +
            hoursToMs(league.votingDeadline),
        }
      : buildLeagueRoundSchedule({
          roundCount: 1,
          startsAt: Date.now(),
          submissionHours: league.submissionDeadline,
          votingHours: league.votingDeadline,
        })[0];

    const roundId = await ctx.db.insert("rounds", {
      leagueId: args.leagueId,
      order: schedule.order,
      title,
      description,
      genres,
      status: schedule.status,
      submissionStartsAt: schedule.submissionStartsAt,
      submissionDeadline: schedule.submissionDeadline,
      votingDeadline: schedule.votingDeadline,
      submissionsPerUser: args.submissionsPerUser,
      submissionMode: args.submissionMode ?? "single",
      submissionInstructions,
      albumConfig: args.albumConfig,
    });

    const activeMemberships = (
      await ctx.db
        .query("memberships")
        .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
        .collect()
    ).filter((membership) => !membership.isBanned && !membership.isSpectator);

    const scheduleMessage =
      schedule.status === "submissions"
        ? `A new round "${title}" was added to "${league.name}" and is now open for submissions.`
        : `A new round "${title}" was added to "${league.name}".`;

    await ctx.scheduler.runAfter(0, internal.discordBot.dispatchRoundNotification, {
      leagueId: args.leagueId,
      roundId,
      roundTitle: title,
      roundStatus: schedule.status,
      reminderKind: "schedule_changed",
      message: scheduleMessage,
      deadlineMs:
        schedule.status === "scheduled"
          ? schedule.submissionStartsAt
          : schedule.submissionDeadline,
      source: `round-schedule:${args.leagueId}:added:${roundId}`,
      targetUserIds: activeMemberships
        .filter((membership) => membership.userId !== userId)
        .map((membership) => membership.userId),
    });

    return roundId;
  },
});

export const deleteRound = mutation({
  args: {
    roundId: v.id("rounds"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) {
      throw new Error("Round not found.");
    }

    const { league, userId } = await requireOwnerManagerOrGlobalAdmin(
      ctx,
      round.leagueId,
    );

    if (round.status !== "scheduled") {
      throw new Error(
        "Only scheduled rounds can be removed from a league.",
      );
    }

    const leagueRounds = await ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", round.leagueId))
      .collect();
    const remainingRounds = sortRoundsInLeagueOrder(leagueRounds).filter(
      (leagueRound) => leagueRound._id !== round._id,
    );
    const schedulePatches = buildScheduledRoundResequencePatches({
      rounds: remainingRounds.map((leagueRound) => ({
        ...leagueRound,
        _id: leagueRound._id.toString(),
      })),
      submissionHours: league.submissionDeadline,
      votingHours: league.votingDeadline,
    });
    const patchByRoundId = new Map<
      string,
      {
        order?: number;
        submissionStartsAt?: number;
        submissionDeadline?: number;
        votingDeadline?: number;
      }
    >();

    remainingRounds.forEach((leagueRound, index) => {
      if (leagueRound.order !== index) {
        patchByRoundId.set(leagueRound._id.toString(), { order: index });
      }
    });
    schedulePatches.forEach(({ roundId, patch }) => {
      patchByRoundId.set(roundId, {
        ...(patchByRoundId.get(roundId) ?? {}),
        ...patch,
      });
    });

    await ctx.db.delete("rounds", round._id);
    if (round.imageKey) {
      await ctx.scheduler.runAfter(0, internal.submissions.deleteSubmissionFiles, {
        keys: [round.imageKey],
        failureLabel: "deleted round image",
      });
      await ctx.scheduler.runAfter(0, internal.files.markStorageUploadsDeleted, {
        keys: [round.imageKey],
      });
    }

    await Promise.all(
      Array.from(patchByRoundId.entries()).map(([roundId, patch]) =>
        ctx.db.patch("rounds", roundId as Id<"rounds">, patch),
      ),
    );

    const activeMemberships = (
      await ctx.db
        .query("memberships")
        .withIndex("by_league", (q) => q.eq("leagueId", round.leagueId))
        .collect()
    ).filter((membership) => !membership.isBanned && !membership.isSpectator);

    await ctx.scheduler.runAfter(0, internal.discordBot.dispatchRoundNotification, {
      leagueId: round.leagueId,
      roundId: round._id,
      roundTitle: round.title,
      roundStatus: "scheduled",
      reminderKind: "schedule_changed",
      message: `The scheduled round "${round.title}" was removed from "${league.name}". Any later scheduled rounds were moved up to keep the timeline intact.`,
      source: `round-schedule:${round.leagueId}:removed:${round._id}`,
      actionUrl: `/leagues/${round.leagueId}`,
      targetUserIds: activeMemberships
        .filter((membership) => membership.userId !== userId)
        .map((membership) => membership.userId),
    });

    return { success: true };
  },
});

const songVoteDetailValidator = v.object({
  voterId: v.id("users"),
  voterName: v.string(),
  voterImage: v.union(v.string(), v.null()),
  score: v.number(),
  isAdminAdjustment: v.optional(v.boolean()),
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
    const league = await ctx.db.get("leagues", round.leagueId);
    if (!league) {
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
    const adminAdjustments = await ctx.db
      .query("adminVoteAdjustments")
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .collect();
    if (votes.length === 0 && adminAdjustments.length === 0) return [];

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
      .collect();
    const allUserIds = new Set<Id<"users">>();
    votes.forEach((v) => allUserIds.add(v.userId));
    adminAdjustments.forEach((adjustment) => allUserIds.add(adjustment.userId));
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
    const adminAdjustmentsBySubmission = new Map<
      string,
      Doc<"adminVoteAdjustments">[]
    >();
    for (const adjustment of adminAdjustments) {
      const subId = adjustment.submissionId.toString();
      if (!adminAdjustmentsBySubmission.has(subId)) {
        adminAdjustmentsBySubmission.set(subId, []);
      }
      adminAdjustmentsBySubmission.get(subId)!.push(adjustment);
    }
    const summary = await Promise.all(
      submissions.map(async (submission) => {
        const submitter = userMap.get(submission.userId.toString());
        const submissionVotes =
          votesBySubmission.get(submission._id.toString()) || [];
        const submissionAdminAdjustments =
          adminAdjustmentsBySubmission.get(submission._id.toString()) || [];
        const standardVoteDetails = await Promise.all(
          submissionVotes.map(async (vote) => {
            const voter = userMap.get(vote.userId.toString());
            const voterImage = await resolveUserAvatarUrl(storage, voter);
            return {
              voterId: vote.userId,
              voterName: voter?.name ?? "Unknown",
              voterImage,
              score: vote.vote,
            };
          }),
        );
        const adminVoteDetails = submissionAdminAdjustments.map((adjustment) => ({
          voterId: adjustment.userId,
          voterName: "Admin adjustment",
          voterImage: null,
          score: adjustment.vote,
          isAdminAdjustment: true,
        }));
        const voteDetails = [...standardVoteDetails, ...adminVoteDetails];

        const { albumArtUrl } = await resolveSubmissionMediaUrls(
          storage,
          submission,
          {
            allowPublic: league.isPublic,
            viewerUserId: userId,
          },
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
    await ctx.runMutation(internal.rounds.normalizeRoundSchedules, {});
    await ctx.runMutation(internal.extensionPolls.resolveDuePolls, { now });

    const dueForSubmissions = await ctx.runQuery(
      internal.rounds.getDueForSubmissions,
      { now },
    );
    const submissionTransitions = await Promise.allSettled(
      dueForSubmissions.map((round: Doc<"rounds">) =>
        ctx.runMutation(internal.rounds.transitionRoundToSubmissions, {
          roundId: round._id,
        }),
      ),
    );
    for (const [index, transition] of submissionTransitions.entries()) {
      if (transition.status === "rejected") {
        const round = dueForSubmissions[index];
        console.error(
          `Failed to transition round ${round._id} to submissions:`,
          transition.reason,
        );
      }
    }

    const dueForVoting = await ctx.runQuery(internal.rounds.getDueForVoting, {
      now,
    });
    const votingTransitions = await Promise.allSettled(
      dueForVoting.map((round: Doc<"rounds">) =>
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
      dueForFinishing.map((round: Doc<"rounds">) =>
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

    const deadlineReminderContexts: DeadlineReminderContext[] = await ctx.runQuery(
      internal.rounds.getDeadlineReminderContexts,
      {
        now,
      },
    );

    const deadlineReminderDispatches: {
      source: string;
      leagueId: Id<"leagues">;
      roundId: Id<"rounds">;
      roundStatus: "submissions" | "voting";
      message: string;
      deadlineMs: number;
      targetUserIds: Id<"users">[];
    }[] = [];

    const notificationsToCreate = deadlineReminderContexts.flatMap((context: DeadlineReminderContext) => {
      const status = context.status;
      if (status !== "submissions" && status !== "voting") {
        return [];
      }

      const reminderCandidates = getRoundDeadlineReminderCandidates(
        {
          status,
          submissionStartsAt: context.submissionStartsAt,
          submissionDeadline: context.submissionDeadline,
          votingDeadline: context.votingDeadline,
        },
        now,
      );

      return reminderCandidates.flatMap((candidate) => {
        const message = buildRoundDeadlineReminderMessage({
          status,
          roundTitle: context.roundTitle,
          leagueName: context.leagueName,
          label: candidate.window.label,
          windowKey: candidate.window.key,
        });
        const source = buildRoundDeadlineReminderSource({
          roundId: context.roundId,
          status,
          deadline: candidate.deadline,
          windowKey: candidate.window.key,
        });

        deadlineReminderDispatches.push({
          source,
          leagueId: context.leagueId,
          roundId: context.roundId,
          roundStatus: status,
          message,
          deadlineMs: candidate.deadline,
          targetUserIds: [...context.targetUserIds],
        });

        return context.targetUserIds.map((userId: Id<"users">) => ({
          userId,
          type: candidate.type,
          message,
          link: `/leagues/${context.leagueId}/round/${context.roundId}`,
          metadata: {
            source,
          },
          pushNotificationOverride: {
            title: buildRoundDeadlineReminderTitle({
              status,
              label: candidate.window.label,
            }),
            body: message,
          },
        }));
      });
    });

    if (notificationsToCreate.length > 0) {
      const createdNotifications: {
        notificationId: Id<"notifications">;
        userId: Id<"users">;
        type:
          | "new_comment"
          | "round_submission"
          | "round_voting"
          | "round_extension_poll"
          | "round_finished";
        source: string | null;
      }[] = await ctx.runMutation(
        internal.notifications.createManyUniqueBySource,
        {
          notifications: notificationsToCreate,
        },
      );
      const createdNotificationKeys = new Set(
        createdNotifications.map(
          (notification: {
            userId: Id<"users">;
            type:
              | "new_comment"
              | "round_submission"
              | "round_voting"
              | "round_extension_poll"
              | "round_finished";
            source: string | null;
          }) =>
            `${notification.userId}:${notification.type}:${notification.source ?? ""}`,
        ),
      );

      for (const dispatch of deadlineReminderDispatches) {
        const notificationType =
          dispatch.roundStatus === "submissions"
            ? "round_submission"
            : "round_voting";
        const targetUserIds = dispatch.targetUserIds.filter((userId) =>
          createdNotificationKeys.has(
            `${userId}:${notificationType}:${dispatch.source}`,
          ),
        );
        if (targetUserIds.length === 0) {
          continue;
        }

        await ctx.scheduler.runAfter(0, internal.discordBot.dispatchRoundNotification, {
          leagueId: dispatch.leagueId,
          roundId: dispatch.roundId,
          roundStatus: dispatch.roundStatus,
          reminderKind: "deadline",
          message: dispatch.message,
          deadlineMs: dispatch.deadlineMs,
          source: dispatch.source,
          targetUserIds,
        });
      }
    }
  },
});

export const getDeadlineReminderContexts = internalQuery({
  args: {
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const [submissionRounds, votingRounds] = await Promise.all([
      ctx.db
        .query("rounds")
        .withIndex("by_status_and_submission_deadline", (q) =>
          q
            .eq("status", "submissions")
            .gt("submissionDeadline", args.now),
        )
        .collect(),
      ctx.db
        .query("rounds")
        .withIndex("by_status_and_voting_deadline", (q) =>
          q
            .eq("status", "voting")
            .gt("votingDeadline", args.now),
        )
        .collect(),
    ]);

    const rounds = [...submissionRounds, ...votingRounds];
    const leagueIds = [...new Set(rounds.map((round) => round.leagueId))];
    const [leagues, membershipsByLeague, submissionsByRound, votesByRound] = await Promise.all([
      Promise.all(leagueIds.map((leagueId) => ctx.db.get("leagues", leagueId))),
      Promise.all(
        leagueIds.map((leagueId) =>
          ctx.db
            .query("memberships")
            .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
            .collect(),
        ),
      ),
      Promise.all(
        rounds.map((round) =>
          ctx.db
            .query("submissions")
            .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
            .collect(),
        ),
      ),
      Promise.all(
        rounds.map((round) =>
          round.status === "voting"
            ? ctx.db
                .query("votes")
                .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
                .collect()
            : Promise.resolve([]),
        ),
      ),
    ]);

    const leagueMap = new Map(
      leagues
        .filter((league): league is NonNullable<typeof league> => league !== null)
        .map((league) => [league._id.toString(), league]),
    );
    const activeMembersByLeague = new Map(
      leagueIds.map((leagueId, index) => [
        leagueId.toString(),
        membershipsByLeague[index]
          .filter((membership) => !membership.isBanned && !membership.isSpectator)
          .map((membership) => ({ _id: membership.userId })),
      ]),
    );
    const submissionsByRoundId = new Map(
      rounds.map((round, index) => [round._id.toString(), submissionsByRound[index]]),
    );
    const votesByRoundId = new Map(
      rounds.map((round, index) => [round._id.toString(), votesByRound[index]]),
    );

    return rounds.flatMap((round) => {
      const league = leagueMap.get(round.leagueId.toString());
      if (!league) {
        return [];
      }
      const status: "submissions" | "voting" =
        round.status === "submissions" ? "submissions" : "voting";

      const targetUserIds = getPendingRoundParticipantIds({
        status,
        members: activeMembersByLeague.get(round.leagueId.toString()) ?? [],
        submissions: submissionsByRoundId.get(round._id.toString()) ?? [],
        submissionsPerUser: round.submissionsPerUser ?? 1,
        submissionMode: round.submissionMode ?? "single",
        votes: votesByRoundId.get(round._id.toString()) ?? [],
        ...getVoteLimits(round, league),
      }).map((userId) => userId as Id<"users">);

      return [
        {
          roundId: round._id,
          leagueId: round.leagueId,
          leagueName: league.name,
          roundTitle: round.title,
          status,
          submissionStartsAt:
            round.submissionStartsAt ??
            getSubmissionStart(round, league.submissionDeadline),
          submissionDeadline: round.submissionDeadline,
          votingDeadline: round.votingDeadline,
          targetUserIds,
        },
      ];
    });
  },
});

export const normalizeRoundSchedules = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rounds = await ctx.db.query("rounds").collect();
    if (rounds.length === 0) {
      return;
    }

    const roundsByLeague = new Map<string, Doc<"rounds">[]>();
    for (const round of rounds) {
      const key = round.leagueId.toString();
      const existing = roundsByLeague.get(key) ?? [];
      existing.push(round);
      roundsByLeague.set(key, existing);
    }

    const leagues = await Promise.all(
      [...roundsByLeague.keys()].map((leagueId) =>
        ctx.db.get("leagues", leagueId as Id<"leagues">),
      ),
    );
    const leagueMap = new Map(
      leagues
        .filter((league): league is NonNullable<typeof league> => league !== null)
        .map((league) => [league._id.toString(), league]),
    );

    for (const [leagueId, leagueRounds] of roundsByLeague.entries()) {
      const league = leagueMap.get(leagueId);
      if (!league) {
        continue;
      }

      const sortedRounds = sortRoundsInLeagueOrder(leagueRounds);
      const firstNonFinishedIndex = sortedRounds.findIndex(
        (round) => round.status !== "finished",
      );
      let nextSubmissionStartsAt: number | null = null;

      for (const [index, round] of sortedRounds.entries()) {
        const patch: Partial<Doc<"rounds">> = {};
        const defaultSubmissionStartsAt =
          round.submissionStartsAt ??
          round.submissionDeadline - hoursToMs(league.submissionDeadline);

        if (round.order !== index) {
          patch.order = index;
        }
        if (round.submissionStartsAt === undefined) {
          patch.submissionStartsAt = defaultSubmissionStartsAt;
        }

        if (
          firstNonFinishedIndex !== -1 &&
          index > firstNonFinishedIndex &&
          round.status !== "finished"
        ) {
          const submissionStartsAt: number =
            nextSubmissionStartsAt ?? defaultSubmissionStartsAt;
          const submissionDeadline: number =
            submissionStartsAt + hoursToMs(league.submissionDeadline);
          const votingDeadline: number =
            submissionDeadline + hoursToMs(league.votingDeadline);

          patch.status = "scheduled";
          patch.submissionStartsAt = submissionStartsAt;
          patch.submissionDeadline = submissionDeadline;
          patch.votingDeadline = votingDeadline;
          nextSubmissionStartsAt = votingDeadline + ROUND_GAP_MS;
        } else if (index === firstNonFinishedIndex) {
          nextSubmissionStartsAt = round.votingDeadline + ROUND_GAP_MS;
        }

        if (Object.keys(patch).length > 0) {
          await ctx.db.patch("rounds", round._id, patch);
        }
      }
    }
  },
});

export const getDueForSubmissions = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    return await ctx.db
      .query("rounds")
      .withIndex("by_status_and_submission_start", (q) =>
        q.eq("status", "scheduled").lte("submissionStartsAt", now),
      )
      .collect();
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

export const transitionRoundToSubmissions = internalMutation({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const round = await ctx.db.get("rounds", roundId);
    if (!round || round.status !== "scheduled") return;
    const submissionStartsAt =
      round.submissionStartsAt ?? round.submissionDeadline;
    if (submissionStartsAt > Date.now()) return;

    const league = await ctx.db.get("leagues", round.leagueId);
    if (league) {
      const didTransition = await transitionRoundToSubmissionsWithSideEffects(
        ctx,
        round,
        league,
      );
      if (didTransition) {
        await maybeAutoStartVotingAfterSubmissionCompletion(ctx, roundId);
      }
    }
  },
});

export const transitionRoundToVoting = internalMutation({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const round = await ctx.db.get("rounds", roundId);
    if (!round || round.status !== "submissions") return;
    if (round.submissionDeadline > Date.now()) return;
    if (await hasIncompleteFileSubmissions(ctx, roundId)) return;

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
