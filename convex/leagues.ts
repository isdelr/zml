// convex/leagues.ts
import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  MutationCtx,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { R2 } from "@convex-dev/r2";
import { components, internal } from "./_generated/api";
import { memberCounter } from "./counters";
import { membershipsByUser } from "./aggregates";

const r2 = new R2(components.r2);

const hoursToMs = (hours: number) => hours * 60 * 60 * 1000;

const songAwardValidator = v.object({
  songTitle: v.string(),
  artist: v.string(),
  albumArtUrl: v.union(v.string(), v.null()),
  submittedBy: v.string(),
  count: v.number(),
});
const roundAwardValidator = v.object({
  roundId: v.id("rounds"),
  title: v.string(),
  imageUrl: v.union(v.string(), v.null()),
  metric: v.number(),
  submissions: v.number(),
  totalUpvotes: v.number(),
});
const userAdvStatValidator = v.object({
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  count: v.number(),
  meta: v.optional(
    v.object({
      rounds: v.number(),
      average: v.number(),
      totalRounds: v.optional(v.number()),
    }),
  ),
});

const generateInviteCode = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const checkLeagueOwnership = async (
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Authentication required.");
  const league = await ctx.db.get(leagueId);
  if (!league) throw new Error("League not found.");
  if (league.creatorId !== userId)
    throw new Error("You are not the owner of this league.");
  return league;
};

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    isPublic: v.boolean(),
    submissionDeadline: v.number(),
    votingDeadline: v.number(),
    maxPositiveVotes: v.number(),
    maxNegativeVotes: v.number(),
    enforceListenPercentage: v.boolean(),
    listenPercentage: v.optional(v.number()),
    listenTimeLimitMinutes: v.optional(v.number()),
    limitVotesPerSubmission: v.boolean(),
    maxPositiveVotesPerSubmission: v.optional(v.number()),
    maxNegativeVotesPerSubmission: v.optional(v.number()),
    rounds: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        submissionsPerUser: v.optional(v.number()),
        imageKey: v.optional(v.string()),
        genres: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be logged in to create a league.");
    }

    const maxHours = 30 * 24; // 30 days
    if (args.submissionDeadline < 1 || args.submissionDeadline > maxHours) {
      throw new Error(
        `Submission period must be between 1 and ${maxHours} hours.`,
      );
    }
    if (args.votingDeadline < 1 || args.votingDeadline > maxHours) {
      throw new Error(`Voting period must be between 1 and ${maxHours} hours.`);
    }
    if (args.maxPositiveVotes < 1 || args.maxPositiveVotes > 10) {
      throw new Error("Upvotes must be between 1 and 10.");
    }

    let inviteCode: string | undefined;
    let isUnique = false;
    while (!isUnique) {
      inviteCode = generateInviteCode();
      const existingLeague = await ctx.db
        .query("leagues")
        .withIndex("by_invite_code", (q) => q.eq("inviteCode", inviteCode!))
        .first();
      if (!existingLeague) {
        isUnique = true;
      }
    }

    const leagueId = await ctx.db.insert("leagues", {
      name: args.name,
      description: args.description,
      isPublic: args.isPublic,
      creatorId: userId,
      submissionDeadline: args.submissionDeadline,
      votingDeadline: args.votingDeadline,
      maxPositiveVotes: args.maxPositiveVotes,
      maxNegativeVotes: args.maxNegativeVotes,
      enforceListenPercentage: args.enforceListenPercentage,
      listenPercentage: args.listenPercentage,
      listenTimeLimitMinutes: args.listenTimeLimitMinutes,
      inviteCode: inviteCode!,
      limitVotesPerSubmission: args.limitVotesPerSubmission,
      maxPositiveVotesPerSubmission: args.maxPositiveVotesPerSubmission,
      maxNegativeVotesPerSubmission: args.maxNegativeVotesPerSubmission,
    });

    const membershipId = await ctx.db.insert("memberships", {
      userId,
      leagueId,
      joinDate: Date.now(),
    });
    const membershipDoc = await ctx.db.get(membershipId);
    await membershipsByUser.insert(ctx, membershipDoc!);
    await memberCounter.inc(ctx, leagueId);

    await ctx.db.insert("leagueStandings", {
      leagueId,
      userId,
      totalPoints: 0,
      totalWins: 0,
    });

    let submissionTime = Date.now();
    for (const round of args.rounds) {
      const submissionDeadlineTimestamp =
        submissionTime + hoursToMs(args.submissionDeadline);
      const votingDeadlineTimestamp =
        submissionDeadlineTimestamp + hoursToMs(args.votingDeadline);
      const roundId = await ctx.db.insert("rounds", {
        leagueId: leagueId,
        title: round.title,
        description: round.description,
        submissionsPerUser: round.submissionsPerUser ?? 1,
        imageKey: round.imageKey,
        genres: round.genres,
        status: "submissions",
        submissionDeadline: submissionDeadlineTimestamp,
        votingDeadline: votingDeadlineTimestamp,
      });

      await ctx.scheduler.runAfter(0, internal.notifications.create, {
        userId: userId,
        type: "round_submission",
        message: `Your new round, "${round.title}", is open for submissions in "${args.name}"!`,
        link: `/leagues/${leagueId}/round/${roundId}`,
        triggeringUserId: userId,
      });

      submissionTime = votingDeadlineTimestamp;
    }

    return leagueId;
  },
});

export const getPublicLeagues = query({
  handler: async (ctx) => {
    const publicLeagues = await ctx.db
      .query("leagues")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .order("desc")
      .collect();

    const leaguesWithDetails = await Promise.all(
      publicLeagues.map(async (league) => {
        const memberCount = await memberCounter.count(ctx, league._id);
        const rounds = await ctx.db
          .query("rounds")
          .withIndex("by_league", (q) => q.eq("leagueId", league._id))
          .collect();
        const genres = [...new Set(rounds.flatMap((r) => r.genres))];
        const firstRoundWithImage = rounds.find((r) => r.imageKey);
        const art = firstRoundWithImage?.imageKey
          ? await r2.getUrl(firstRoundWithImage.imageKey)
          : null;

        return {
          ...league,
          memberCount,
          genres,
          art,
        };
      }),
    );

    return leaguesWithDetails;
  },
});

export const getLeaguesForUser = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"leagues">>> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const leagueIds = memberships.map((m) => m.leagueId);
    const leagues = await Promise.all(
      leagueIds.map((leagueId) => ctx.db.get(leagueId)),
    );
    return leagues.filter(
      (league): league is Doc<"leagues"> => league !== null,
    );
  },
});

export const get = query({
  args: { id: v.id("leagues") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("leagues"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.string(),
      isPublic: v.boolean(),
      creatorId: v.id("users"),
      submissionDeadline: v.number(),
      votingDeadline: v.number(),
      maxPositiveVotes: v.number(),
      maxNegativeVotes: v.number(),
      creatorName: v.string(),
      memberCount: v.number(),
      isOwner: v.boolean(),
      isMember: v.boolean(),
      inviteCode: v.optional(v.union(v.string(), v.null())),
      creatorImage: v.optional(v.string()),
      members: v.array(
        v.object({
          _id: v.id("users"),
          name: v.optional(v.string()),
          image: v.optional(v.string()),
        }),
      ),
      enforceListenPercentage: v.optional(v.boolean()),
      listenPercentage: v.optional(v.number()),
      listenTimeLimitMinutes: v.optional(v.number()),
      limitVotesPerSubmission: v.optional(v.boolean()),
      maxPositiveVotesPerSubmission: v.optional(v.number()),
      maxNegativeVotesPerSubmission: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const league = await ctx.db.get(args.id);
    if (!league) {
      return null;
    }

    const membership =
      userId &&
      (await ctx.db
        .query("memberships")
        .withIndex("by_league_and_user", (q) =>
          q.eq("leagueId", league._id).eq("userId", userId),
        )
        .first());

    if (!league.isPublic && !membership) {
      return null;
    }

    const creator = await ctx.db.get(league.creatorId);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", league._id))
      .collect();
    const memberIds = memberships.map((m) => m.userId);
    const memberDocs = await Promise.all(memberIds.map((id) => ctx.db.get(id)));
    const memberCount = await memberCounter.count(ctx, league._id);

    const members = memberDocs
      .filter((u): u is Doc<"users"> => u !== null)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        image: u.image,
      }));

    const isOwner = userId === league.creatorId;
    const isMember = !!membership;

    return {
      ...league,
      creatorName: creator?.name ?? "Unknown",
      creatorImage: creator?.image,
      memberCount: memberCount,
      isOwner,
      isMember,
      inviteCode: isOwner ? league.inviteCode : undefined,
      members,
    };
  },
});

export const getInviteInfo = query({
  args: { inviteCode: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("leagues"),
      name: v.string(),
      description: v.string(),
      creatorName: v.string(),
      memberCount: v.number(),
      creatorImage: v.optional(v.string()),
      members: v.array(
        v.object({
          name: v.optional(v.string()),
          image: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.inviteCode))
      .first();
    if (!league) {
      return null;
    }
    const creator = await ctx.db.get(league.creatorId);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", league._id))
      .collect();
    const memberIds = memberships.map((m) => m.userId);
    const memberDocs = await Promise.all(memberIds.map((id) => ctx.db.get(id)));
    const members = memberDocs
      .filter((u): u is Doc<"users"> => u !== null)
      .map((u) => ({
        name: u.name,
        image: u.image,
      }));
    const memberCount = await memberCounter.count(ctx, league._id);
    return {
      _id: league._id,
      name: league.name,
      description: league.description,
      creatorName: creator?.name ?? "Unknown",
      creatorImage: creator?.image,
      memberCount,
      members,
    };
  },
});

export const joinWithInviteCode = mutation({
  args: { inviteCode: v.string() },
  returns: v.union(v.string(), v.id("leagues")),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be logged in to join a league.");
    }

    const league = await ctx.db
      .query("leagues")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.inviteCode))
      .first();
    if (!league) {
      return "not_found";
    }

    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_league_and_user", (q) =>
        q.eq("leagueId", league._id).eq("userId", userId),
      )
      .first();
    if (existingMembership) {
      return "already_joined";
    }

    const membershipId = await ctx.db.insert("memberships", {
      userId,
      leagueId: league._id,
      joinDate: Date.now(),
    });
    const membershipDoc = await ctx.db.get(membershipId);
    await membershipsByUser.insert(ctx, membershipDoc!);

    await memberCounter.inc(ctx, league._id);
    await ctx.db.insert("leagueStandings", {
      leagueId: league._id,
      userId,
      totalPoints: 0,
      totalWins: 0,
    });

    return league._id;
  },
});

export const joinPublicLeague = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.union(v.string(), v.id("leagues")),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be logged in to join a league.");
    }
    const league = await ctx.db.get(args.leagueId);
    if (!league) {
      return "not_found";
    }
    if (!league.isPublic) {
      throw new Error(
        "This is a private league. You can only join with an invite link.",
      );
    }
    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_league_and_user", (q) =>
        q.eq("leagueId", league._id).eq("userId", userId),
      )
      .first();
    if (existingMembership) {
      return "already_joined";
    }

    const membershipId = await ctx.db.insert("memberships", {
      userId,
      leagueId: league._id,
      joinDate: Date.now(),
    });
    const membershipDoc = await ctx.db.get(membershipId);
    await membershipsByUser.insert(ctx, membershipDoc!);

    await memberCounter.inc(ctx, league._id);
    await ctx.db.insert("leagueStandings", {
      leagueId: league._id,
      userId,
      totalPoints: 0,
      totalWins: 0,
    });

    return league._id;
  },
});

export const updateLeague = mutation({
  args: {
    leagueId: v.id("leagues"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    submissionDeadline: v.optional(v.number()),
    votingDeadline: v.optional(v.number()),
    maxPositiveVotes: v.optional(v.number()),
    maxNegativeVotes: v.optional(v.number()),
    limitVotesPerSubmission: v.optional(v.boolean()),
    maxPositiveVotesPerSubmission: v.optional(v.number()),
    maxNegativeVotesPerSubmission: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await checkLeagueOwnership(ctx, args.leagueId);
    const { leagueId, ...updates } = args;
    const maxHours = 30 * 24;

    if (
      updates.submissionDeadline !== undefined &&
      (updates.submissionDeadline < 1 || updates.submissionDeadline > maxHours)
    ) {
      throw new Error(
        `Submission period must be between 1 and ${maxHours} hours.`,
      );
    }
    if (
      updates.votingDeadline !== undefined &&
      (updates.votingDeadline < 1 || updates.votingDeadline > maxHours)
    ) {
      throw new Error(`Voting period must be between 1 and ${maxHours} hours.`);
    }

    await ctx.db.patch(leagueId, updates);
    return "League updated successfully.";
  },
});

export const manageInviteCode = mutation({
  args: {
    leagueId: v.id("leagues"),
    action: v.union(
      v.literal("regenerate"),
      v.literal("disable"),
      v.literal("enable"),
    ),
  },
  handler: async (ctx, args) => {
    await checkLeagueOwnership(ctx, args.leagueId);

    if (args.action === "disable") {
      await ctx.db.patch(args.leagueId, { inviteCode: null });
      return { newCode: null };
    } else {
      let inviteCode: string | undefined;
      let isUnique = false;
      while (!isUnique) {
        inviteCode = generateInviteCode();
        const existingLeague = await ctx.db
          .query("leagues")
          .withIndex("by_invite_code", (q) => q.eq("inviteCode", inviteCode!))
          .first();
        if (!existingLeague) isUnique = true;
      }
      await ctx.db.patch(args.leagueId, { inviteCode: inviteCode! });
      return { newCode: inviteCode };
    }
  },
});

export const kickMember = mutation({
  args: { leagueId: v.id("leagues"), memberIdToKick: v.id("users") },
  handler: async (ctx, args) => {
    const league = await checkLeagueOwnership(ctx, args.leagueId);
    if (args.memberIdToKick === league.creatorId) {
      throw new Error("The league owner cannot be kicked.");
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_league_and_user", (q) =>
        q.eq("leagueId", args.leagueId).eq("userId", args.memberIdToKick),
      )
      .first();
    if (!membership) {
      throw new Error("This user is not a member of the league.");
    }

    await ctx.db.delete(membership._id);
    await membershipsByUser.delete(ctx, membership);
    await memberCounter.dec(ctx, args.leagueId);

    const standing = await ctx.db
      .query("leagueStandings")
      .withIndex("by_league_and_user", (q) =>
        q.eq("leagueId", args.leagueId).eq("userId", args.memberIdToKick),
      )
      .first();
    if (standing) {
      await ctx.db.delete(standing._id);
    }
    return "Member kicked successfully.";
  },
});

export const getLeagueStandings = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      name: v.string(),
      image: v.optional(v.string()),
      totalPoints: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const standingsDocs = await ctx.db
      .query("leagueStandings")
      .withIndex("by_league_and_points", (q) => q.eq("leagueId", args.leagueId))
      .order("desc")
      .collect();

    const standings = await Promise.all(
      standingsDocs.map(async (standing) => {
        const user = await ctx.db.get(standing.userId);
        return {
          userId: standing.userId,
          name: user?.name ?? "Unknown User",
          image: user?.image ?? undefined,
          totalPoints: standing.totalPoints,
        };
      }),
    );

    return standings;
  },
});

const userStatValidator = v.object({
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  count: v.number(),
});

const topSongValidator = v.object({
  songTitle: v.string(),
  artist: v.string(),
  albumArtUrl: v.union(v.string(), v.null()),
  score: v.number(),
  submittedBy: v.string(),
});

export const getLeagueMetadata = query({
  args: { id: v.id("leagues") },
  returns: v.union(
    v.null(),
    v.object({
      name: v.string(),
      description: v.string(),
      memberCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.id);
    if (!league) {
      return null;
    }
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", league._id))
      .collect();
    return {
      name: league.name,
      description: league.description,
      memberCount: memberships.length,
    };
  },
});

export const updateLeagueStats = internalAction({
  args: { leagueId: v.id("leagues") },
  handler: async (ctx, args) => {
    const statsData = await ctx.runQuery(internal.leagues.getStatsData, {
      leagueId: args.leagueId,
    });
    if (!statsData) {
      console.log(
        `No finished rounds for league ${args.leagueId}, skipping stats update.`,
      );
      return;
    }
    await ctx.runMutation(internal.leagues.storeLeagueStats, {
      leagueId: args.leagueId,
      stats: statsData,
    });
  },
});

// Update getStatsData returns shape and logic
export const getStatsData = internalQuery({
  args: { leagueId: v.id("leagues") },
  handler: async (ctx, args) => {
    const finishedRounds = await ctx.db
      .query("rounds")
      .withIndex("by_league_and_status", (q) =>
        q.eq("leagueId", args.leagueId).eq("status", "finished"),
      )
      .collect();
    if (finishedRounds.length === 0) return null;

    const roundIds = finishedRounds.map((r) => r._id);
    const results = (
      await Promise.all(
        roundIds.map((roundId) =>
          ctx.db
            .query("roundResults")
            .withIndex("by_round", (q) => q.eq("roundId", roundId))
            .collect(),
        ),
      )
    ).flat();
    const votes = (
      await Promise.all(
        roundIds.map((roundId) =>
          ctx.db
            .query("votes")
            .withIndex("by_round_and_user", (q) => q.eq("roundId", roundId))
            .collect(),
        ),
      )
    ).flat();

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    const memberIds = memberships.map((m) => m.userId);
    const memberDocs = (
      await Promise.all(memberIds.map((id) => ctx.db.get(id)))
    ).filter(Boolean);
    const memberMap = new Map(
      memberDocs.map((m) => [
        m!._id.toString(),
        { name: m!.name, image: m!.image },
      ]),
    );

    const standings = await ctx.db
      .query("leagueStandings")
      .withIndex("by_league_and_user", (q) => q.eq("leagueId", args.leagueId))
      .collect();

    // Existing user awards
    const mostWins = standings.sort((a, b) => b.totalWins - a.totalWins);
    const overlord =
      mostWins.length > 0
        ? {
            userId: mostWins[0].userId.toString(),
            count: mostWins[0].totalWins,
          }
        : null;

    const submissionSubmitterMap = new Map(
      results.map((r) => [r.submissionId.toString(), r.userId]),
    );
    const userUpvotes = new Map<string, number>();
    const userDownvotes = new Map<string, number>();
    const userDownvotesCast = new Map<string, number>(); // NEW: downvotes cast by voter
    const posBySubmission = new Map<string, number>(); // NEW: upvotes per submission
    const negBySubmission = new Map<string, number>(); // NEW: downvotes per submission

    votes.forEach((v) => {
      const submitterId = submissionSubmitterMap.get(v.submissionId.toString());
      if (submitterId) {
        if (v.vote > 0)
          userUpvotes.set(
            submitterId.toString(),
            (userUpvotes.get(submitterId.toString()) ?? 0) + v.vote,
          );
        if (v.vote < 0)
          userDownvotes.set(
            submitterId.toString(),
            (userDownvotes.get(submitterId.toString()) ?? 0) + Math.abs(v.vote),
          );
      }
      if (v.vote < 0) {
        userDownvotesCast.set(
          v.userId.toString(),
          (userDownvotesCast.get(v.userId.toString()) ?? 0) + Math.abs(v.vote),
        );
      }
      if (v.vote > 0)
        posBySubmission.set(
          v.submissionId.toString(),
          (posBySubmission.get(v.submissionId.toString()) ?? 0) + v.vote,
        );
      if (v.vote < 0)
        negBySubmission.set(
          v.submissionId.toString(),
          (negBySubmission.get(v.submissionId.toString()) ?? 0) +
            Math.abs(v.vote),
        );
    });

    const mostUpvotes = [...userUpvotes.entries()].sort((a, b) => b[1] - a[1]);
    const peopleChampion =
      mostUpvotes.length > 0
        ? { userId: mostUpvotes[0][0], count: mostUpvotes[0][1] }
        : null;
    const mostDownvotes = [...userDownvotes.entries()].sort(
      (a, b) => b[1] - a[1],
    );
    const mostControversial =
      mostDownvotes.length > 0
        ? { userId: mostDownvotes[0][0], count: mostDownvotes[0][1] }
        : null;
    const userVoteCount = new Map<string, number>();
    votes.forEach((v) =>
      userVoteCount.set(
        v.userId.toString(),
        (userVoteCount.get(v.userId.toString()) ?? 0) + Math.abs(v.vote),
      ),
    );
    const mostVotesCast = [...userVoteCount.entries()].sort(
      (a, b) => b[1] - a[1],
    );
    const prolificVoter =
      mostVotesCast.length > 0
        ? { userId: mostVotesCast[0][0], count: mostVotesCast[0][1] }
        : null;

    // Highest scoring submission (existing topResult)
    const topResult =
      results.length > 0
        ? results.sort((a, b) => b.points - a.points)[0]
        : null;

    // Get all submissions for these rounds
    const submissions = (
      await Promise.all(
        roundIds.map((roundId) =>
          ctx.db
            .query("submissions")
            .withIndex("by_round_and_user", (q) => q.eq("roundId", roundId))
            .collect(),
        ),
      )
    ).flat();

    // Genre breakdown (existing)
    const genreCounts: Record<string, number> = {};
    const roundsMap = new Map(finishedRounds.map((r) => [r._id.toString(), r]));
    submissions.forEach((s) => {
      const round = roundsMap.get(s.roundId.toString());
      if (round)
        round.genres.forEach(
          (g) => (genreCounts[g] = (genreCounts[g] ?? 0) + 1),
        );
    });
    const genreBreakdown = Object.entries(genreCounts).map(([name, value]) => ({
      name,
      value,
    }));

    // Helpers
    const formatUserStat = (stat: { userId: string; count: number } | null) => {
      if (!stat) return null;
      const u = memberMap.get(stat.userId);
      if (!u) return null;
      return { ...u, count: stat.count };
    };
    async function formatSongAwardFromSubmissionId(
      subId: string,
      count: number,
    ) {
      const submission = await ctx.db.get(
        submissions.find((s) => s._id.toString() === subId)!._id,
      );
      if (!submission) return null;
      let albumArtUrl: string | null = null;
      if (submission.submissionType === "file" && submission.albumArtKey)
        albumArtUrl = await r2.getUrl(submission.albumArtKey);
      else albumArtUrl = submission.albumArtUrlValue ?? null;
      const submitter = memberMap.get(submission.userId.toString());
      return {
        songTitle: submission.songTitle,
        artist: submission.artist,
        albumArtUrl,
        submittedBy: submitter?.name ?? "Unknown",
        count,
      };
    }
    async function roundImageUrl(rid: Id<"rounds">) {
      const rnd = await ctx.db.get(rid);
      if (rnd?.imageKey) return await r2.getUrl(rnd.imageKey);
      return null;
    }

    // NEW song-level awards
    const mostUpvotedSongEntry = [...posBySubmission.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    const mostDownvotedSongEntry = [...negBySubmission.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];

    // NEW fan favorite: most bookmarks per submission
    let favorite: { subId: string; count: number } | null = null;
    for (const s of submissions) {
      const count = (
        await ctx.db
          .query("bookmarks")
          .withIndex("by_submission", (q) => q.eq("submissionId", s._id))
          .collect()
      ).length;
      if (!favorite || count > favorite.count)
        favorite = { subId: s._id.toString(), count };
    }

    // NEW attendance star: most rounds submitted (across all rounds in league)
    // fetch all rounds in league to know total
    const allRoundsInLeague = await ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    const totalRounds = allRoundsInLeague.length;
    const submittedRoundsByUser = new Map<string, Set<string>>();
    submissions.forEach((s) => {
      const key = s.userId.toString();
      if (!submittedRoundsByUser.has(key))
        submittedRoundsByUser.set(key, new Set());
      submittedRoundsByUser.get(key)!.add(s.roundId.toString());
    });
    const attArr = [...submittedRoundsByUser.entries()].map(([uid, set]) => ({
      uid,
      count: set.size,
    }));
    attArr.sort((a, b) => b.count - a.count);
    const attendanceStar = attArr.length
      ? { userId: attArr[0].uid, count: attArr[0].count, totalRounds }
      : null;

    // NEW golden ears & consistency king from results per user
    const resultsByUser = new Map<string, number[]>();
    results.forEach((r) => {
      const key = r.userId.toString();
      if (!resultsByUser.has(key)) resultsByUser.set(key, []);
      resultsByUser.get(key)!.push(r.points);
    });
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const stdev = (arr: number[]) => {
      const m = avg(arr);
      return Math.sqrt(
        arr.reduce((s, x) => s + (x - m) * (x - m), 0) / arr.length,
      );
    };
    const perUserAverages: { uid: string; average: number; rounds: number }[] =
      [];
    const perUserStdevs: {
      uid: string;
      dev: number;
      average: number;
      rounds: number;
    }[] = [];
    for (const [uid, arr] of resultsByUser.entries()) {
      if (arr.length === 0) continue;
      const average = avg(arr);
      const dev = arr.length >= 3 ? stdev(arr) : Number.POSITIVE_INFINITY; // require >=3 to be fair
      perUserAverages.push({ uid, average, rounds: arr.length });
      perUserStdevs.push({ uid, dev, average, rounds: arr.length });
    }
    perUserAverages.sort((a, b) => b.average - a.average);
    perUserStdevs.sort((a, b) => a.dev - b.dev);
    const golden = perUserAverages.length ? perUserAverages[0] : null;
    const consist =
      perUserStdevs[0]?.dev !== Number.POSITIVE_INFINITY
        ? perUserStdevs[0]
        : null;

    // NEW biggest downvoter
    const downvoter =
      [...userDownvotesCast.entries()].sort((a, b) => b[1] - a[1])[0] || null;

    // NEW round awards: worst (top-2 upvote share), closest/blowout (points diff)
    function roundUpvoteStats(roundId: Id<"rounds">) {
      const subs = submissions
        .filter((s) => s.roundId === roundId)
        .map((s) => s._id.toString());
      const pos = subs.map((sid) => posBySubmission.get(sid) ?? 0);
      const total = pos.reduce((a, b) => a + b, 0);
      const top2 = [...pos]
        .sort((a, b) => b - a)
        .slice(0, 2)
        .reduce((a, b) => a + b, 0);
      const share = total > 0 ? top2 / total : 0;
      return {
        totalUpvotes: total,
        top2Share: share,
        submissions: subs.length,
      };
    }
    function roundPointsDiff(roundId: Id<"rounds">) {
      const rr = results
        .filter((r) => r.roundId === roundId)
        .map((r) => r.points)
        .sort((a, b) => b - a);
      if (rr.length < 2) return 0;
      return rr[0] - rr[1];
    }
    let worstRound: any = null,
      closestRound: any = null,
      blowoutRound: any = null;
    for (const r of finishedRounds) {
      const up = roundUpvoteStats(r._id);
      const diff = roundPointsDiff(r._id);
      if (!worstRound || up.top2Share > worstRound.metric) {
        worstRound = {
          roundId: r._id,
          title: r.title,
          imageUrl: r.imageKey ? await r2.getUrl(r.imageKey) : null,
          metric: up.top2Share,
          submissions: up.submissions,
          totalUpvotes: up.totalUpvotes,
        };
      }
      if (!closestRound || diff < closestRound.metric) {
        closestRound = {
          roundId: r._id,
          title: r.title,
          imageUrl: r.imageKey ? await r2.getUrl(r.imageKey) : null,
          metric: diff,
          submissions: up.submissions,
          totalUpvotes: up.totalUpvotes,
        };
      }
      if (!blowoutRound || diff > blowoutRound.metric) {
        blowoutRound = {
          roundId: r._id,
          title: r.title,
          imageUrl: r.imageKey ? await r2.getUrl(r.imageKey) : null,
          metric: diff,
          submissions: up.submissions,
          totalUpvotes: up.totalUpvotes,
        };
      }
    }

    // Format final payload items
    const topSong = await (async () => {
      if (!topResult) return null;
      const submission = await ctx.db.get(topResult.submissionId);
      if (!submission) return null;
      const submitter = memberMap.get(submission.userId.toString());
      let albumArtUrl: string | null = null;
      if (submission.submissionType === "file" && submission.albumArtKey)
        albumArtUrl = await r2.getUrl(submission.albumArtKey);
      else albumArtUrl = submission.albumArtUrlValue ?? null;
      return {
        songTitle: submission.songTitle,
        artist: submission.artist,
        albumArtUrl,
        score: topResult.points,
        submittedBy: submitter?.name ?? "Unknown",
      };
    })();

    const mostUpvotedSong = mostUpvotedSongEntry
      ? await formatSongAwardFromSubmissionId(
          mostUpvotedSongEntry[0],
          mostUpvotedSongEntry[1],
        )
      : null;
    const mostDownvotedSong = mostDownvotedSongEntry
      ? await formatSongAwardFromSubmissionId(
          mostDownvotedSongEntry[0],
          mostDownvotedSongEntry[1],
        )
      : null;
    const fanFavoriteSong = favorite
      ? await formatSongAwardFromSubmissionId(favorite.subId, favorite.count)
      : null;

    return {
      overlord: formatUserStat(overlord),
      peopleChampion: formatUserStat(peopleChampion),
      mostControversial: formatUserStat(mostControversial),
      prolificVoter: formatUserStat(prolificVoter),
      topSong,
      mostUpvotedSong,
      mostDownvotedSong,
      fanFavoriteSong,
      attendanceStar: attendanceStar
        ? {
            ...(memberMap.get(attendanceStar.userId) ?? {}),
            count: attendanceStar.count,
            meta: { totalRounds },
          }
        : null,
      goldenEars: golden
        ? {
            ...(memberMap.get(golden.uid) ?? {}),
            count: Math.round(golden.average * 10) / 10,
            meta: { rounds: golden.rounds },
          }
        : null,
      consistencyKing: consist
        ? {
            ...(memberMap.get(consist.uid) ?? {}),
            count: Math.round(consist.dev * 10) / 10,
            meta: {
              rounds: consist.rounds,
              average: Math.round(consist.average * 10) / 10,
            },
          }
        : null,
      biggestDownvoter: downvoter
        ? { ...(memberMap.get(downvoter[0]) ?? {}), count: downvoter[1] }
        : null,
      worstRound,
      closestRound,
      blowoutRound,
      genreBreakdown,
    };
  },
});

// Update getLeagueStats return validator to include the new fields
export const getLeagueStats = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(
    v.null(),
    v.object({
      overlord: v.union(v.null(), userStatValidator),
      peopleChampion: v.union(v.null(), userStatValidator),
      mostControversial: v.union(v.null(), userStatValidator),
      prolificVoter: v.union(v.null(), userStatValidator),
      topSong: v.union(v.null(), topSongValidator),
      mostUpvotedSong: v.union(v.null(), songAwardValidator),
      mostDownvotedSong: v.union(v.null(), songAwardValidator),
      fanFavoriteSong: v.union(v.null(), songAwardValidator),
      attendanceStar: v.union(v.null(), userAdvStatValidator),
      goldenEars: v.union(v.null(), userAdvStatValidator),
      consistencyKing: v.union(v.null(), userAdvStatValidator),
      biggestDownvoter: v.union(v.null(), userStatValidator),
      worstRound: v.union(v.null(), roundAwardValidator),
      closestRound: v.union(v.null(), roundAwardValidator),
      blowoutRound: v.union(v.null(), roundAwardValidator),
      genreBreakdown: v.array(
        v.object({ name: v.string(), value: v.number() }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("leagueStats")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .first();
    return stats;
  },
});

export const searchInLeague = query({
  args: {
    leagueId: v.id("leagues"),
    searchText: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    rounds: v.array(
      v.object({
        _id: v.id("rounds"),
        title: v.string(),
      }),
    ),
    songs: v.array(
      v.object({
        _id: v.id("submissions"),
        songTitle: v.string(),
        artist: v.string(),
        albumArtUrl: v.union(v.string(), v.null()),
        songFileUrl: v.union(v.string(), v.null()),
        submissionType: v.union(
          v.literal("file"),
          v.literal("spotify"),
          v.literal("youtube"),
        ),
        songLink: v.union(v.string(), v.null()),
        leagueId: v.id("leagues"),
        leagueName: v.optional(v.string()),
        roundId: v.id("rounds"),
        roundTitle: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const league = await ctx.db.get(args.leagueId);
    if (!league) {
      return { rounds: [], songs: [] };
    }
    if (!league.isPublic) {
      const membership =
        userId &&
        (await ctx.db
          .query("memberships")
          .withIndex("by_league_and_user", (q) =>
            q.eq("leagueId", league._id).eq("userId", userId!),
          )
          .first());
      if (!membership) {
        return { rounds: [], songs: [] };
      }
    }

    const perCategoryLimit = Math.max(1, Math.min(args.limit ?? 5, 25));
    const needle = args.searchText.trim().toLowerCase();

    const allRoundsInLeague = await ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    const matchedRounds = allRoundsInLeague
      .filter((r) => {
        const t = r.title.toLowerCase();
        const d = r.description.toLowerCase();
        return t.includes(needle) || d.includes(needle);
      })
      .slice(0, perCategoryLimit)
      .map((r) => ({ _id: r._id, title: r.title }));

    const matchedSubs = await ctx.db
      .query("submissions")
      .withSearchIndex("by_text", (q) =>
        q.search("searchText", args.searchText).eq("leagueId", args.leagueId),
      )
      .take(perCategoryLimit);

    const roundIds = [...new Set(matchedSubs.map((s) => s.roundId))];
    const roundDocs = await Promise.all(roundIds.map((rid) => ctx.db.get(rid)));
    const roundMap = new Map<string, Doc<"rounds">>();
    roundDocs.forEach((rd) => {
      if (rd) roundMap.set(rd._id.toString(), rd);
    });

    const songs = await Promise.all(
      matchedSubs.map(async (sub) => {
        const round = roundMap.get(sub.roundId.toString());
        let albumArtUrl: string | null = null;
        let songFileUrl: string | null = null;
        if (sub.submissionType === "file") {
          [albumArtUrl, songFileUrl] = await Promise.all([
            sub.albumArtKey
              ? r2.getUrl(sub.albumArtKey)
              : Promise.resolve(null),
            sub.songFileKey
              ? r2.getUrl(sub.songFileKey)
              : Promise.resolve(null),
          ]);
        } else {
          albumArtUrl = sub.albumArtUrlValue ?? null;
          songFileUrl = sub.songLink ?? null;
        }
        return {
          _id: sub._id,
          songTitle: sub.songTitle,
          artist: sub.artist,
          albumArtUrl,
          songFileUrl,
          submissionType: sub.submissionType,
          songLink: sub.songLink ?? null,
          leagueId: sub.leagueId,
          leagueName: league.name,
          roundId: sub.roundId,
          roundTitle: round?.title,
        };
      }),
    );

    return { rounds: matchedRounds, songs };
  },
});
