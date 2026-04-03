import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getVoteLimits } from "../lib/convex-server/voteLimits";
import {
  buildRoundShiftPatches,
  sortRoundsInLeagueOrder,
} from "../lib/rounds/schedule";
import {
  EXTENSION_POLL_APPROVED_EXTENSION_MS,
  EXTENSION_POLL_TIE_EXTENSION_MS,
  EXTENSION_REASON_MIN_LENGTH,
  getExtensionPollResolution,
  getFinalizedVotingParticipantIds,
  getRemainingExtensionRequests,
  isExtensionPollRequestWindowOpen,
} from "../lib/rounds/extension-polls";
import { getPendingVotingParticipantIds } from "../lib/rounds/pending-participation";

type ExtensionPollStatus = "open" | "resolved";
type ExtensionPollResult =
  | "pending"
  | "approved"
  | "tie"
  | "rejected"
  | "insufficient_turnout"
  | "closed";
type ExtensionPollVoteChoice = "grant" | "deny";
type ExtensionPollRequestEligibilityReason =
  | "not_authenticated"
  | "not_member"
  | "spectator"
  | "round_not_voting"
  | "outside_window"
  | "already_exists"
  | "already_used_limit"
  | "not_pending_voter"
  | "no_eligible_voters"
  | "unavailable";

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

async function getLeagueMembership(
  ctx: Pick<QueryCtx, "db">,
  leagueId: Id<"leagues">,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("memberships")
    .withIndex("by_league_and_user", (q) =>
      q.eq("leagueId", leagueId).eq("userId", userId),
    )
    .first();
}

function getActiveMembers(memberships: Doc<"memberships">[]) {
  return memberships
    .filter((membership) => !membership.isBanned && !membership.isSpectator)
    .map((membership) => ({ _id: membership.userId }));
}

function isActiveMembership(membership: Doc<"memberships"> | null) {
  return Boolean(membership && !membership.isBanned && !membership.isSpectator);
}

async function getRequestContext(
  ctx: Pick<QueryCtx, "db">,
  round: Doc<"rounds">,
  league: Doc<"leagues">,
) {
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

  const activeMembers = getActiveMembers(memberships);
  const { maxUp, maxDown } = getVoteLimits(round, league);
  const finalizedVoterIds = getFinalizedVotingParticipantIds(
    activeMembers,
    submissions,
    votes,
    maxUp,
    maxDown,
  );

  return {
    memberships,
    submissions,
    votes,
    finalizedVoterIds,
    finalizedVoterIdSet: new Set(finalizedVoterIds),
  };
}

async function patchResolvedPoll(
  ctx: Pick<MutationCtx, "db">,
  poll: Doc<"extensionPolls">,
  args: {
    result: ExtensionPollResult;
    appliedExtensionMs: number;
    resolvedAt: number;
  },
) {
  await ctx.db.patch(poll._id, {
    status: "resolved" satisfies ExtensionPollStatus,
    result: args.result,
    appliedExtensionMs: args.appliedExtensionMs,
    resolvedAt: args.resolvedAt,
  });
}

async function resolvePoll(
  ctx: MutationCtx,
  poll: Doc<"extensionPolls">,
  now: number,
) {
  if (poll.status !== "open") {
    return null;
  }

  const round = await ctx.db.get("rounds", poll.roundId);
  if (!round || round.status !== "voting") {
    await patchResolvedPoll(ctx, poll, {
      result: "closed",
      appliedExtensionMs: 0,
      resolvedAt: now,
    });
    return { result: "closed" as const, appliedExtensionMs: 0 };
  }

  const resolution = getExtensionPollResolution({
    yesVotes: poll.yesVotes,
    noVotes: poll.noVotes,
    eligibleVoterCount: poll.eligibleVoterCount,
  });
  const league = await ctx.db.get("leagues", poll.leagueId);
  if (!league) {
    await patchResolvedPoll(ctx, poll, {
      result: "closed",
      appliedExtensionMs: 0,
      resolvedAt: now,
    });
    return { result: "closed" as const, appliedExtensionMs: 0 };
  }

  if (resolution.appliedExtensionMs > 0) {
    const [leagueRounds, memberships, submissions, votes] = await Promise.all([
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
        .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
        .collect(),
      ctx.db
        .query("votes")
        .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
        .collect(),
    ]);
    const shiftPatches = buildRoundShiftPatches({
      rounds: sortRoundsInLeagueOrder(leagueRounds).map((leagueRound) => ({
        ...leagueRound,
        _id: leagueRound._id.toString(),
      })),
      roundId: round._id.toString(),
      adjustmentMs: resolution.appliedExtensionMs,
    });

    await Promise.all(
      shiftPatches.map(({ roundId, patch }) =>
        ctx.db.patch(roundId as Id<"rounds">, patch),
      ),
    );

    const activeMembers = getActiveMembers(memberships);
    const { maxUp, maxDown } = getVoteLimits(round, league);
    const pendingUserIds = getPendingVotingParticipantIds(
      activeMembers,
      submissions,
      votes,
      maxUp,
      maxDown,
    ).map((userId) => userId as Id<"users">);
    const newVotingDeadline = round.votingDeadline + resolution.appliedExtensionMs;

    if (pendingUserIds.length > 0) {
      const durationLabel =
        resolution.appliedExtensionMs === EXTENSION_POLL_APPROVED_EXTENSION_MS
          ? "24 hours"
          : resolution.appliedExtensionMs === EXTENSION_POLL_TIE_EXTENSION_MS
            ? "8 hours"
            : `${Math.round(resolution.appliedExtensionMs / (60 * 60 * 1000))} hours`;

      await ctx.scheduler.runAfter(
        0,
        internal.notifications.createForLeagueAndDispatchDiscord,
        {
          leagueId: round.leagueId,
          roundId: round._id,
          roundStatus: "voting",
          notificationType: "round_voting",
          discordNotificationKind: "deadline_changed",
          message: `The voting deadline for "${round.title}" in "${league.name}" was extended by ${durationLabel} after an anonymous extension poll.`,
          link: `/leagues/${round.leagueId}/round/${round._id}`,
          deadlineMs: newVotingDeadline,
          targetUserIds: pendingUserIds,
          metadata: {
            source: `round-extension-poll:${poll._id}:deadline:${newVotingDeadline}`,
          },
          pushNotificationOverride: {
            title: "Voting Deadline Extended",
            body: `The voting deadline for "${round.title}" was extended by ${durationLabel}.`,
          },
        },
      );
    }
  }

  await patchResolvedPoll(ctx, poll, {
    result: resolution.result,
    appliedExtensionMs: resolution.appliedExtensionMs,
    resolvedAt: now,
  });

  const resultMessage =
    resolution.result === "approved"
      ? `The anonymous extension poll for "${round.title}" in "${league.name}" passed. Voting was extended by 24 hours.`
      : resolution.result === "tie"
        ? `The anonymous extension poll for "${round.title}" in "${league.name}" tied. Voting was extended by 8 hours.`
        : resolution.result === "insufficient_turnout"
          ? `The anonymous extension poll for "${round.title}" in "${league.name}" closed without effect because fewer than 50% of eligible voters participated.`
          : `The anonymous extension poll for "${round.title}" in "${league.name}" was rejected. The voting deadline stayed the same.`;

  await ctx.scheduler.runAfter(0, internal.discordBot.dispatchRoundNotification, {
    leagueId: round.leagueId,
    roundId: round._id,
    roundStatus: "voting",
    reminderKind: "extension_poll_result",
    message: resultMessage,
    deadlineMs:
      resolution.appliedExtensionMs > 0
        ? round.votingDeadline + resolution.appliedExtensionMs
        : round.votingDeadline,
    source: `round-extension-poll:${poll._id}:result:${resolution.result}`,
    targetUserIds: [],
  });

  return {
    result: resolution.result,
    appliedExtensionMs: resolution.appliedExtensionMs,
  };
}

export const getForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) {
      return null;
    }

    const { league, canView } = await canViewLeague(ctx, round.leagueId, userId);
    if (!league || !canView) {
      return null;
    }

    const now = Date.now();
    const poll = await ctx.db
      .query("extensionPolls")
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .first();

    const membership =
      userId !== null ? await getLeagueMembership(ctx, round.leagueId, userId) : null;
    const activeMembership = isActiveMembership(membership);

    let requestEligibilityReason: ExtensionPollRequestEligibilityReason =
      "unavailable";
    let canRequest = false;
    let remainingRequests = 0;
    let eligibleVoterCount = poll?.eligibleVoterCount ?? 0;

    if (!userId) {
      requestEligibilityReason = "not_authenticated";
    } else if (!membership || membership.isBanned) {
      requestEligibilityReason = "not_member";
    } else if (membership.isSpectator) {
      requestEligibilityReason = "spectator";
    } else {
      const requesterPolls = await ctx.db
        .query("extensionPolls")
        .withIndex("by_league_and_requester", (q) =>
          q.eq("leagueId", round.leagueId).eq("requesterUserId", userId),
        )
        .collect();
      remainingRequests = getRemainingExtensionRequests(requesterPolls.length);

      if (poll) {
        requestEligibilityReason = "already_exists";
      } else if (round.status !== "voting") {
        requestEligibilityReason = "round_not_voting";
      } else if (!isExtensionPollRequestWindowOpen(round.votingDeadline, now)) {
        requestEligibilityReason = "outside_window";
      } else if (remainingRequests === 0) {
        requestEligibilityReason = "already_used_limit";
      } else {
        const requestContext = await getRequestContext(ctx, round, league);
        eligibleVoterCount = requestContext.finalizedVoterIds.length;
        const hasSubmitted = requestContext.submissions.some(
          (submission) => submission.userId === userId,
        );
        const isPendingVoter =
          hasSubmitted && !requestContext.finalizedVoterIdSet.has(userId.toString());

        if (!isPendingVoter) {
          requestEligibilityReason = "not_pending_voter";
        } else if (eligibleVoterCount === 0) {
          requestEligibilityReason = "no_eligible_voters";
        } else {
          requestEligibilityReason = "unavailable";
          canRequest = true;
        }
      }
    }

    const currentUserVote =
      userId && poll
        ? await ctx.db
            .query("extensionPollVotes")
            .withIndex("by_poll_and_voter", (q) =>
              q.eq("pollId", poll._id).eq("voterUserId", userId),
            )
            .first()
        : null;
    const currentUserEligibleToVote = Boolean(
      userId && poll && poll.eligibleVoterIds.includes(userId),
    );

    return {
      poll: poll
        ? {
            _id: poll._id,
            reason: poll.reason,
            status: poll.status,
            result: poll.result,
            openedAt: poll.openedAt,
            resolvesAt: poll.resolvesAt,
            eligibleVoterCount: poll.eligibleVoterCount,
            yesVotes: poll.yesVotes,
            noVotes: poll.noVotes,
            totalVotes: poll.yesVotes + poll.noVotes,
            appliedExtensionMs: poll.appliedExtensionMs ?? 0,
            resolvedAt: poll.resolvedAt ?? null,
            currentUserVote:
              (currentUserVote?.vote as ExtensionPollVoteChoice | undefined) ?? null,
            currentUserEligibleToVote,
            canCurrentUserVote:
              poll.status === "open" &&
              currentUserEligibleToVote &&
              currentUserVote === null,
          }
        : null,
      request: {
        canRequest,
        remainingRequests,
        eligibilityReason: requestEligibilityReason,
        eligibleVoterCount,
        isWithinWindow:
          round.status === "voting" &&
          isExtensionPollRequestWindowOpen(round.votingDeadline, now),
        isActiveMember: activeMembership,
      },
    };
  },
});

export const create = mutation({
  args: {
    roundId: v.id("rounds"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to request an extension.");
    }

    const trimmedReason = args.reason.trim();
    if (trimmedReason.length < EXTENSION_REASON_MIN_LENGTH) {
      throw new Error(
        `Extension reasons must be at least ${EXTENSION_REASON_MIN_LENGTH} characters.`,
      );
    }

    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) {
      throw new Error("Round not found.");
    }
    if (round.status !== "voting") {
      throw new Error("Extensions can only be requested while voting is open.");
    }

    const league = await ctx.db.get("leagues", round.leagueId);
    if (!league) {
      throw new Error("League not found.");
    }

    const membership = await getLeagueMembership(ctx, round.leagueId, userId);
    if (!membership || membership.isBanned) {
      throw new Error("You must be an active league member to request an extension.");
    }
    if (membership.isSpectator) {
      throw new Error("Spectators cannot request voting extensions.");
    }

    const now = Date.now();
    if (!isExtensionPollRequestWindowOpen(round.votingDeadline, now)) {
      throw new Error(
        "Voting extensions can only be requested during the final 24 hours.",
      );
    }

    const existingPoll = await ctx.db
      .query("extensionPolls")
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .first();
    if (existingPoll) {
      throw new Error("This round already has an extension poll.");
    }

    const requesterPolls = await ctx.db
      .query("extensionPolls")
      .withIndex("by_league_and_requester", (q) =>
        q.eq("leagueId", round.leagueId).eq("requesterUserId", userId),
      )
      .collect();
    if (getRemainingExtensionRequests(requesterPolls.length) === 0) {
      throw new Error("You have used all extension requests for this league.");
    }

    const requestContext = await getRequestContext(ctx, round, league);
    const hasSubmitted = requestContext.submissions.some(
      (submission) => submission.userId === userId,
    );
    const isPendingVoter =
      hasSubmitted && !requestContext.finalizedVoterIdSet.has(userId.toString());
    if (!isPendingVoter) {
      throw new Error(
        "Only participants who are still voting can request an extension.",
      );
    }

    if (requestContext.finalizedVoterIds.length === 0) {
      throw new Error(
        "An extension poll cannot start until at least one voter has finished voting.",
      );
    }

    const pollId = await ctx.db.insert("extensionPolls", {
      leagueId: round.leagueId,
      roundId: round._id,
      requesterUserId: userId,
      reason: trimmedReason,
      status: "open",
      result: "pending",
      openedAt: now,
      resolvesAt: round.votingDeadline,
      eligibleVoterIds: requestContext.finalizedVoterIds.map(
        (voterId) => voterId as Id<"users">,
      ),
      eligibleVoterCount: requestContext.finalizedVoterIds.length,
      yesVotes: 0,
      noVotes: 0,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.notifications.createForLeagueAndDispatchDiscord,
      {
        leagueId: round.leagueId,
        roundId: round._id,
        roundStatus: "voting",
        notificationType: "round_extension_poll",
        discordNotificationKind: "extension_poll",
        message: `An anonymous extension poll is open for "${round.title}" in "${league.name}". Reason: ${trimmedReason} At least 50% of eligible voters must respond for the result to count.`,
        link: `/leagues/${round.leagueId}/round/${round._id}`,
        deadlineMs: round.votingDeadline,
        targetUserIds: requestContext.finalizedVoterIds.map(
          (voterId) => voterId as Id<"users">,
        ),
        metadata: {
          source: `round-extension-poll:${pollId}:opened`,
        },
        pushNotificationOverride: {
          title: "Extension Poll Open",
          body: `An anonymous voter requested more time in "${round.title}". At least 50% turnout is required.`,
        },
      },
    );

    return {
      pollId,
      eligibleVoterCount: requestContext.finalizedVoterIds.length,
    };
  },
});

export const castVote = mutation({
  args: {
    pollId: v.id("extensionPolls"),
    vote: v.union(v.literal("grant"), v.literal("deny")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to vote in an extension poll.");
    }

    const poll = await ctx.db.get("extensionPolls", args.pollId);
    if (!poll) {
      throw new Error("Extension poll not found.");
    }
    if (poll.status !== "open") {
      throw new Error("This extension poll is already closed.");
    }
    if (!poll.eligibleVoterIds.includes(userId)) {
      throw new Error("You are not eligible to vote in this extension poll.");
    }

    const existingVote = await ctx.db
      .query("extensionPollVotes")
      .withIndex("by_poll_and_voter", (q) =>
        q.eq("pollId", poll._id).eq("voterUserId", userId),
      )
      .first();
    if (existingVote) {
      throw new Error("You have already voted in this extension poll.");
    }

    await ctx.db.insert("extensionPollVotes", {
      pollId: poll._id,
      voterUserId: userId,
      vote: args.vote,
      createdAt: Date.now(),
    });
    await ctx.db.patch(poll._id, {
      yesVotes: poll.yesVotes + (args.vote === "grant" ? 1 : 0),
      noVotes: poll.noVotes + (args.vote === "deny" ? 1 : 0),
    });

    const updatedPoll = await ctx.db.get("extensionPolls", poll._id);
    if (
      updatedPoll &&
      updatedPoll.status === "open" &&
      updatedPoll.yesVotes + updatedPoll.noVotes >= updatedPoll.eligibleVoterCount
    ) {
      await resolvePoll(ctx, updatedPoll, Date.now());
      return { resolved: true };
    }

    return { resolved: false };
  },
});

export const resolveDuePolls = internalMutation({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const duePolls = await ctx.db
      .query("extensionPolls")
      .withIndex("by_status_and_resolves_at", (q) =>
        q.eq("status", "open").lte("resolvesAt", args.now),
      )
      .collect();

    for (const poll of duePolls) {
      await resolvePoll(ctx, poll, args.now);
    }
  },
});

export const closeOpenForRound = internalMutation({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const poll = await ctx.db
      .query("extensionPolls")
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .first();
    if (!poll || poll.status !== "open") {
      return;
    }

    await patchResolvedPoll(ctx, poll, {
      result: "closed",
      appliedExtensionMs: 0,
      resolvedAt: Date.now(),
    });
  },
});
