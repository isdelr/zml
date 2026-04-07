import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
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
  getSubmissionStart,
  sortRoundsInLeagueOrder,
} from "../lib/rounds/schedule";
import {
  EXTENSION_POLL_APPROVED_EXTENSION_MS,
  EXTENSION_POLL_TIE_EXTENSION_MS,
  EXTENSION_REASON_MIN_LENGTH,
  formatExtensionPollRequestWindowLabel,
  getExtensionPollResolution,
  getExtensionPollRequestWindowMs,
  getFinalizedVotingParticipantIds,
  getRemainingExtensionRequests,
  getSubmittedParticipantIds,
  isExtensionPollRequestWindowOpen,
  type ExtensionPollType,
} from "../lib/rounds/extension-polls";
import {
  getPendingSubmissionParticipantIds,
  getPendingVotingParticipantIds,
} from "../lib/rounds/pending-participation";

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
  | "outside_window"
  | "already_exists"
  | "already_used_limit"
  | "not_pending_participant"
  | "no_eligible_voters"
  | "unavailable";

const DEFAULT_EXTENSION_POLL_TYPE: ExtensionPollType = "voting";

function getPollType(
  poll: Pick<Doc<"extensionPolls">, "type"> | null | undefined,
): ExtensionPollType {
  return poll?.type ?? DEFAULT_EXTENSION_POLL_TYPE;
}

function getPollRoundStatus(
  pollType: ExtensionPollType,
): "submissions" | "voting" {
  return pollType === "submission" ? "submissions" : "voting";
}

function getPollPhaseLabel(
  pollType: ExtensionPollType,
  options: { capitalized?: boolean } = {},
) {
  const label = pollType === "submission" ? "submission" : "voting";
  return options.capitalized
    ? `${label.charAt(0).toUpperCase()}${label.slice(1)}`
    : label;
}

function getPollDeadlineLabel(pollType: ExtensionPollType) {
  return `${getPollPhaseLabel(pollType)} deadline`;
}

function getPollHistoryLabel(pollType: ExtensionPollType) {
  return `${getPollPhaseLabel(pollType)} extension poll`;
}

function getPollRequesterErrorMessage(pollType: ExtensionPollType) {
  return pollType === "submission"
    ? "Only participants who are still submitting can request a submission extension."
    : "Only participants who are still voting can request a voting extension.";
}

function getPollNoEligibleVoterMessage(pollType: ExtensionPollType) {
  return pollType === "submission"
    ? "A submission extension poll cannot start until at least one member has submitted."
    : "A voting extension poll cannot start until at least one voter has finished voting.";
}

function getPollPhaseTiming(
  round: Doc<"rounds">,
  league: Doc<"leagues">,
  pollType: ExtensionPollType,
) {
  if (pollType === "submission") {
    return {
      phaseStart:
        round.submissionStartsAt ??
        getSubmissionStart(round, league.submissionDeadline),
      phaseDeadline: round.submissionDeadline,
    };
  }

  return {
    phaseStart: round.submissionDeadline,
    phaseDeadline: round.votingDeadline,
  };
}

function getExistingPollForType(
  polls: Doc<"extensionPolls">[],
  pollType: ExtensionPollType,
) {
  return polls.find((poll) => getPollType(poll) === pollType) ?? null;
}

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
  ctx: Pick<QueryCtx | MutationCtx, "db">,
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
  ctx: Pick<QueryCtx | MutationCtx, "db">,
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
  const submittedMemberIds = getSubmittedParticipantIds(activeMembers, submissions);
  const pendingSubmitterIds = getPendingSubmissionParticipantIds(
    activeMembers,
    submissions,
    round.submissionsPerUser ?? 1,
    round.submissionMode ?? "single",
  );
  const { maxUp, maxDown } = getVoteLimits(round, league);
  const finalizedVoterIds = getFinalizedVotingParticipantIds(
    activeMembers,
    submissions,
    votes,
    maxUp,
    maxDown,
  );
  const pendingVoterIds = getPendingVotingParticipantIds(
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
    submittedMemberIds,
    submittedMemberIdSet: new Set(submittedMemberIds),
    pendingSubmitterIds,
    pendingSubmitterIdSet: new Set(pendingSubmitterIds),
    finalizedVoterIds,
    finalizedVoterIdSet: new Set(finalizedVoterIds),
    pendingVoterIds,
    pendingVoterIdSet: new Set(pendingVoterIds),
  };
}

function formatAppliedExtensionDurationLabel(extensionMs: number) {
  return extensionMs === EXTENSION_POLL_APPROVED_EXTENSION_MS
    ? "24 hours"
    : extensionMs === EXTENSION_POLL_TIE_EXTENSION_MS
      ? "8 hours"
      : `${Math.round(extensionMs / (60 * 60 * 1000))} hours`;
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

  const pollType = getPollType(poll);
  const round = await ctx.db.get("rounds", poll.roundId);
  if (!round || round.status !== getPollRoundStatus(pollType)) {
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

  const { phaseDeadline } = getPollPhaseTiming(round, league, pollType);

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
    const pendingUserIds =
      pollType === "submission"
        ? getPendingSubmissionParticipantIds(
            activeMembers,
            submissions,
            round.submissionsPerUser ?? 1,
            round.submissionMode ?? "single",
          )
        : (() => {
            const { maxUp, maxDown } = getVoteLimits(round, league);
            return getPendingVotingParticipantIds(
              activeMembers,
              submissions,
              votes,
              maxUp,
              maxDown,
            );
          })();
    const newDeadline = phaseDeadline + resolution.appliedExtensionMs;

    if (pendingUserIds.length > 0) {
      const durationLabel = formatAppliedExtensionDurationLabel(
        resolution.appliedExtensionMs,
      );
      const phaseTitle = getPollPhaseLabel(pollType, { capitalized: true });
      const deadlineLabel = getPollDeadlineLabel(pollType);

      await ctx.scheduler.runAfter(
        0,
        internal.notifications.createForLeagueAndDispatchDiscord,
        {
          leagueId: round.leagueId,
          roundId: round._id,
          roundStatus: getPollRoundStatus(pollType),
          notificationType:
            pollType === "submission" ? "round_submission" : "round_voting",
          discordNotificationKind: "deadline_changed",
          message: `The ${deadlineLabel} for "${round.title}" in "${league.name}" was extended by ${durationLabel} after an anonymous ${getPollHistoryLabel(pollType)}.`,
          link: `/leagues/${round.leagueId}/round/${round._id}`,
          deadlineMs: newDeadline,
          targetUserIds: pendingUserIds.map((userId) => userId as Id<"users">),
          metadata: {
            source: `round-extension-poll:${poll._id}:${pollType}:deadline:${newDeadline}`,
          },
          pushNotificationOverride: {
            title: `${phaseTitle} Deadline Extended`,
            body: `The ${deadlineLabel} for "${round.title}" was extended by ${durationLabel}.`,
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

  const historyLabel = getPollHistoryLabel(pollType);
  const deadlineLabel = getPollDeadlineLabel(pollType);
  const resultMessage =
    resolution.result === "approved"
      ? `The anonymous ${historyLabel} for "${round.title}" in "${league.name}" passed. The ${deadlineLabel} was extended by 24 hours.`
      : resolution.result === "tie"
        ? `The anonymous ${historyLabel} for "${round.title}" in "${league.name}" tied. The ${deadlineLabel} was extended by 8 hours.`
        : resolution.result === "insufficient_turnout"
          ? `The anonymous ${historyLabel} for "${round.title}" in "${league.name}" closed without effect because fewer than 50% of eligible members participated.`
          : `The anonymous ${historyLabel} for "${round.title}" in "${league.name}" was rejected. The ${deadlineLabel} stayed the same.`;

  await ctx.scheduler.runAfter(0, internal.discordBot.dispatchRoundNotification, {
    leagueId: round.leagueId,
    roundId: round._id,
    roundStatus: getPollRoundStatus(pollType),
    reminderKind: "extension_poll_result",
    message: resultMessage,
    deadlineMs:
      resolution.appliedExtensionMs > 0
        ? phaseDeadline + resolution.appliedExtensionMs
        : phaseDeadline,
    source: `round-extension-poll:${poll._id}:${pollType}:result:${resolution.result}`,
    targetUserIds: [],
  });

  return {
    result: resolution.result,
    appliedExtensionMs: resolution.appliedExtensionMs,
  };
}

export const getForRound = query({
  args: {
    roundId: v.id("rounds"),
    type: v.union(v.literal("submission"), v.literal("voting")),
  },
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

    const polls = await ctx.db
      .query("extensionPolls")
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .collect();
    const poll = getExistingPollForType(polls, args.type);
    const isActivePhase = round.status === getPollRoundStatus(args.type);

    if (round.status === "finished") {
      if (!poll) {
        return null;
      }
    } else if (!isActivePhase) {
      return null;
    }

    const now = Date.now();
    const membership =
      userId !== null ? await getLeagueMembership(ctx, round.leagueId, userId) : null;
    const activeMembership = isActiveMembership(membership);
    const { phaseStart, phaseDeadline } = getPollPhaseTiming(round, league, args.type);
    const requestWindowMs = getExtensionPollRequestWindowMs(
      phaseStart,
      phaseDeadline,
    );

    let requestEligibilityReason: ExtensionPollRequestEligibilityReason =
      "unavailable";
    let canRequest = false;
    let remainingRequests = 0;
    let eligibleVoterCount = poll?.eligibleVoterCount ?? 0;

    if (isActivePhase) {
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
        } else if (
          !isExtensionPollRequestWindowOpen(phaseStart, phaseDeadline, now)
        ) {
          requestEligibilityReason = "outside_window";
        } else if (remainingRequests === 0) {
          requestEligibilityReason = "already_used_limit";
        } else {
          const requestContext = await getRequestContext(ctx, round, league);
          const isPendingParticipant =
            args.type === "submission"
              ? requestContext.pendingSubmitterIdSet.has(userId.toString())
              : requestContext.pendingVoterIdSet.has(userId.toString());

          eligibleVoterCount =
            args.type === "submission"
              ? requestContext.submittedMemberIds.length
              : requestContext.finalizedVoterIds.length;

          if (!isPendingParticipant) {
            requestEligibilityReason = "not_pending_participant";
          } else if (eligibleVoterCount === 0) {
            requestEligibilityReason = "no_eligible_voters";
          } else {
            canRequest = true;
          }
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
      type: args.type,
      poll: poll
        ? {
            _id: poll._id,
            type: getPollType(poll),
            reason: poll.reason,
            status: poll.status,
            result: poll.result,
            openedAt: poll.openedAt,
            resolvesAt: poll.resolvesAt,
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
        requestWindowMs,
        isWithinWindow:
          isActivePhase &&
          isExtensionPollRequestWindowOpen(phaseStart, phaseDeadline, now),
        isActiveMember: activeMembership,
      },
    };
  },
});

export const create = mutation({
  args: {
    roundId: v.id("rounds"),
    type: v.union(v.literal("submission"), v.literal("voting")),
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
    if (round.status !== getPollRoundStatus(args.type)) {
      throw new Error(
        args.type === "submission"
          ? "Submission extensions can only be requested while submissions are open."
          : "Voting extensions can only be requested while voting is open.",
      );
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
      throw new Error(
        args.type === "submission"
          ? "Spectators cannot request submission extensions."
          : "Spectators cannot request voting extensions.",
      );
    }

    const now = Date.now();
    const { phaseStart, phaseDeadline } = getPollPhaseTiming(round, league, args.type);
    const requestWindowMs = getExtensionPollRequestWindowMs(
      phaseStart,
      phaseDeadline,
    );
    if (!isExtensionPollRequestWindowOpen(phaseStart, phaseDeadline, now)) {
      throw new Error(
        `${getPollPhaseLabel(args.type, { capitalized: true })} extensions can only be requested during the last ${formatExtensionPollRequestWindowLabel(requestWindowMs)} of ${getPollPhaseLabel(args.type)}.`,
      );
    }

    const existingPoll = getExistingPollForType(
      await ctx.db
        .query("extensionPolls")
        .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
        .collect(),
      args.type,
    );
    if (existingPoll) {
      throw new Error(
        `This round already has or already used its ${getPollPhaseLabel(args.type)} extension poll.`,
      );
    }

    const requesterPolls = await ctx.db
      .query("extensionPolls")
      .withIndex("by_league_and_requester", (q) =>
        q.eq("leagueId", round.leagueId).eq("requesterUserId", userId),
      )
      .collect();
    if (getRemainingExtensionRequests(requesterPolls.length) === 0) {
      throw new Error(
        "You have used all shared extension requests for this league. Submission and voting extension polls spend from the same pool, even when they fail.",
      );
    }

    const requestContext = await getRequestContext(ctx, round, league);
    const isPendingParticipant =
      args.type === "submission"
        ? requestContext.pendingSubmitterIdSet.has(userId.toString())
        : requestContext.pendingVoterIdSet.has(userId.toString());
    if (!isPendingParticipant) {
      throw new Error(getPollRequesterErrorMessage(args.type));
    }

    const eligibleVoterIds =
      args.type === "submission"
        ? requestContext.submittedMemberIds
        : requestContext.finalizedVoterIds;
    if (eligibleVoterIds.length === 0) {
      throw new Error(getPollNoEligibleVoterMessage(args.type));
    }

    const pollId = await ctx.db.insert("extensionPolls", {
      leagueId: round.leagueId,
      roundId: round._id,
      requesterUserId: userId,
      type: args.type,
      reason: trimmedReason,
      status: "open",
      result: "pending",
      openedAt: now,
      resolvesAt: phaseDeadline,
      eligibleVoterIds: eligibleVoterIds.map((voterId) => voterId as Id<"users">),
      eligibleVoterCount: eligibleVoterIds.length,
      yesVotes: 0,
      noVotes: 0,
    });

    const phaseLabel = getPollPhaseLabel(args.type);
    const phaseTitle = getPollPhaseLabel(args.type, { capitalized: true });
    await ctx.scheduler.runAfter(
      0,
      internal.notifications.createForLeagueAndDispatchDiscord,
      {
        leagueId: round.leagueId,
        roundId: round._id,
        roundStatus: getPollRoundStatus(args.type),
        notificationType: "round_extension_poll",
        discordNotificationKind: "extension_poll",
        message: `A ${phaseLabel} extension poll is open for "${round.title}" in "${league.name}". Reason: ${trimmedReason}.`,
        link: `/leagues/${round.leagueId}/round/${round._id}`,
        deadlineMs: phaseDeadline,
        targetUserIds: eligibleVoterIds.map((voterId) => voterId as Id<"users">),
        metadata: {
          source: `round-extension-poll:${pollId}:${args.type}:opened`,
        },
        pushNotificationOverride: {
          title: `${phaseTitle} Extension Poll Open`,
          body: `A ${phaseLabel} extension poll is open for "${round.title}".`,
        },
      },
    );

    return {
      pollId,
      eligibleVoterCount: eligibleVoterIds.length,
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

export const getReminderContexts = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const openPolls = await ctx.db
      .query("extensionPolls")
      .withIndex("by_status_and_resolves_at", (q) =>
        q.eq("status", "open").gt("resolvesAt", args.now),
      )
      .collect();
    if (openPolls.length === 0) {
      return [];
    }

    const [rounds, leagues, votesByPoll] = await Promise.all([
      Promise.all(openPolls.map((poll) => ctx.db.get("rounds", poll.roundId))),
      Promise.all(openPolls.map((poll) => ctx.db.get("leagues", poll.leagueId))),
      Promise.all(
        openPolls.map((poll) =>
          ctx.db
            .query("extensionPollVotes")
            .withIndex("by_poll", (q) => q.eq("pollId", poll._id))
            .collect(),
        ),
      ),
    ]);

    return openPolls.flatMap((poll, index) => {
      const round = rounds[index];
      const league = leagues[index];
      const pollType = getPollType(poll);
      if (!round || round.status !== getPollRoundStatus(pollType) || !league) {
        return [];
      }

      const votedUserIds = new Set(
        votesByPoll[index].map((vote) => vote.voterUserId.toString()),
      );
      const targetUserIds = poll.eligibleVoterIds.filter(
        (userId) => !votedUserIds.has(userId.toString()),
      );
      if (targetUserIds.length === 0) {
        return [];
      }

      const { phaseStart, phaseDeadline } = getPollPhaseTiming(
        round,
        league,
        pollType,
      );

      return [
        {
          pollId: poll._id,
          pollType,
          roundId: round._id,
          roundStatus: getPollRoundStatus(pollType),
          leagueId: league._id,
          leagueName: league.name,
          roundTitle: round.title,
          phaseStart,
          phaseDeadline,
          targetUserIds,
        },
      ];
    });
  },
});

export const closeOpenForRound = internalMutation({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const polls = await ctx.db
      .query("extensionPolls")
      .withIndex("by_round", (q) => q.eq("roundId", args.roundId))
      .collect();

    for (const poll of polls) {
      if (poll.status !== "open") {
        continue;
      }

      await patchResolvedPoll(ctx, poll, {
        result: "closed",
        appliedExtensionMs: 0,
        resolvedAt: Date.now(),
      });
    }
  },
});
