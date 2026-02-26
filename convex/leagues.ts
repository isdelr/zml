// File: convex/leagues.ts
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
import { memberCounter } from "./counters";
import { membershipsByUser } from "./aggregates";
import { B2Storage } from "./b2Storage";
import {
  checkLeagueManagementPermission,
  checkLeagueOwnership,
  generateInviteCode,
  hoursToMs,
} from "../lib/convex-server/leagues/permissions";
import { getLeagueMembersSummary } from "../lib/convex-server/leagues/members";
import { getVoteLimits } from "../lib/convex-server/voteLimits";
import { resolveUserAvatarUrl } from "./userAvatar";

const storage = new B2Storage();

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

// Fine-grained stat validators to match schema precisely
const attendanceStatValidator = v.object({
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  count: v.number(),
  meta: v.optional(v.object({ totalRounds: v.number() })),
});

const goldenEarsStatValidator = v.object({
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  count: v.number(),
  meta: v.optional(v.object({ rounds: v.number() })),
});

const consistencyStatValidator = v.object({
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  count: v.number(),
  meta: v.optional(v.object({ rounds: v.number(), average: v.number() })),
});

const sortLeaguesForDisplay = (a: Doc<"leagues">, b: Doc<"leagues">) => {
  const nameCompare = a.name.localeCompare(b.name, undefined, {
    sensitivity: "base",
  });
  if (nameCompare !== 0) {
    return nameCompare;
  }
  return b._creationTime - a._creationTime;
};

async function canViewLeague(
  ctx: { db: QueryCtx["db"] },
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
      q.eq("leagueId", league._id).eq("userId", userId),
    )
    .first();

  return { league, canView: Boolean(membership) };
}

const publicLeaguePreviewValidator = v.object({
  _id: v.id("leagues"),
  _creationTime: v.number(),
  name: v.string(),
  description: v.string(),
  memberCount: v.number(),
  genres: v.array(v.string()),
  art: v.union(v.string(), v.null()),
  isActive: v.boolean(),
});

export const addLeagueManager = mutation({
  args: {
    leagueId: v.id("leagues"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Only league owners can add managers
    const league = await checkLeagueOwnership(ctx, args.leagueId);

    // Check if user exists
    const user = await ctx.db.get("users", args.userId);
    if (!user) throw new Error("User not found.");

    // Check if user is already a manager or the owner
    if (league.creatorId === args.userId) {
      throw new Error("League owner already has management permissions.");
    }

    const currentManagers = league.managers || [];
    if (currentManagers.includes(args.userId)) {
      throw new Error("User is already a league manager.");
    }

    // Add user to managers list
    await ctx.db.patch("leagues", args.leagueId, {
      managers: [...currentManagers, args.userId],
    });

    return { success: true };
  },
});

export const removeLeagueManager = mutation({
  args: {
    leagueId: v.id("leagues"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Only league owners can remove managers
    const league = await checkLeagueOwnership(ctx, args.leagueId);

    const currentManagers = league.managers || [];
    if (!currentManagers.includes(args.userId)) {
      throw new Error("User is not a league manager.");
    }

    // Remove user from managers list
    await ctx.db.patch("leagues", args.leagueId, {
      managers: currentManagers.filter((id) => id !== args.userId),
    });

    return { success: true };
  },
});

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

    // Generate a unique invite code for the league
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

    // Create the new league
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

    // Create the membership for the creator
    const membershipId = await ctx.db.insert("memberships", {
      userId,
      leagueId,
      joinDate: Date.now(),
    });
    const membershipDoc = await ctx.db.get("memberships", membershipId);
    await membershipsByUser.insert(ctx, membershipDoc!);
    await memberCounter.inc(ctx, leagueId);

    // Initialize standings for the creator
    await ctx.db.insert("leagueStandings", {
      leagueId,
      userId,
      totalPoints: 0,
      totalWins: 0,
    });

    // Create rounds with staggered deadlines
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
        submissionMode: round.submissionMode ?? "single",
        submissionInstructions: round.submissionInstructions,
        albumConfig: round.albumConfig,
      });

      // Notify creator that their round is open for submissions
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
  args: { limit: v.optional(v.number()) },
  returns: v.array(publicLeaguePreviewValidator),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 25, 50));
    const roundsPreviewLimit = 5;
    const publicLeagues = await ctx.db
      .query("leagues")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .order("desc")
      .take(limit);

    const leaguesWithDetails = await Promise.all(
      publicLeagues.map(async (league) => {
        const [memberCount, rounds] = await Promise.all([
          memberCounter.count(ctx, league._id),
          ctx.db
            .query("rounds")
            .withIndex("by_league", (q) => q.eq("leagueId", league._id))
            .order("desc")
            .take(roundsPreviewLimit),
        ]);

        const genres = [...new Set(rounds.flatMap((r) => r.genres))];
        const isActive = rounds.some(
          (round) =>
            round.status === "submissions" || round.status === "voting",
        );

        return {
          _id: league._id,
          _creationTime: league._creationTime,
          name: league.name,
          description: league.description,
          memberCount,
          genres,
          art: null,
          isActive,
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

    const leagueIds = [
      ...new Set(memberships.map((membership) => membership.leagueId)),
    ];
    const leagues = await Promise.all(
      leagueIds.map((leagueId) => ctx.db.get("leagues", leagueId)),
    );

    return leagues
      .filter((league): league is Doc<"leagues"> => league !== null)
      .sort(sortLeaguesForDisplay);
  },
});

// New query: same as getLeaguesForUser but supports filtering ended leagues
export const getLeaguesForUserFiltered = query({
  args: { includeEnded: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<Array<Doc<"leagues">>> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const leagueIds = [
      ...new Set(memberships.map((membership) => membership.leagueId)),
    ];
    const leagues = (
      await Promise.all(
        leagueIds.map((leagueId) => ctx.db.get("leagues", leagueId)),
      )
    ).filter((l): l is Doc<"leagues"> => l !== null);

    const includeEnded = args.includeEnded ?? false;
    if (includeEnded) return leagues.sort(sortLeaguesForDisplay);

    const activeLeagues = await Promise.all(
      leagues.map(async (league) => {
        const [submissionRound, votingRound] = await Promise.all([
          ctx.db
            .query("rounds")
            .withIndex("by_league_and_status", (q) =>
              q.eq("leagueId", league._id).eq("status", "submissions"),
            )
            .first(),
          ctx.db
            .query("rounds")
            .withIndex("by_league_and_status", (q) =>
              q.eq("leagueId", league._id).eq("status", "voting"),
            )
            .first(),
        ]);
        return submissionRound || votingRound ? league : null;
      }),
    );

    return activeLeagues
      .filter((league): league is Doc<"leagues"> => league !== null)
      .sort(sortLeaguesForDisplay);
  },
});

export const get = query({
  args: { leagueId: v.id("leagues") },
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
      canManageLeague: v.boolean(),
      isMember: v.boolean(),
      isSpectator: v.boolean(),
      inviteCode: v.optional(v.union(v.string(), v.null())),
      creatorImage: v.optional(v.string()),
      members: v.array(
        v.object({
          _id: v.id("users"),
          name: v.optional(v.string()),
          image: v.optional(v.string()),
        }),
      ),
      spectators: v.array(
        v.object({
          _id: v.id("users"),
          name: v.optional(v.string()),
          image: v.optional(v.string()),
        }),
      ),
      activeMemberCount: v.number(),
      spectatorCount: v.number(),
      managers: v.optional(v.array(v.id("users"))),
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

    const league = await ctx.db.get("leagues", args.leagueId);
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

    const creator = await ctx.db.get("users", league.creatorId);

    const {
      memberCount,
      activeMemberCount,
      spectatorCount,
      members,
      spectators,
    } = await getLeagueMembersSummary(ctx, league._id, {
      includeUserProfiles: true,
      includeUserProfilesLimit: 24,
    });

    const isOwner = userId === league.creatorId;
    const isMember = !!membership;
    const isSpectator = membership?.isSpectator ?? false;

    // Keep this query lightweight for high-frequency subscribers.
    const canManageLeague =
      Boolean(userId) &&
      (isOwner || Boolean(userId && league.managers?.includes(userId)));

    return {
      ...league,
      creatorName: creator?.name ?? "Unknown",
      creatorImage: (await resolveUserAvatarUrl(storage, creator)) ?? undefined,
      memberCount: memberCount,
      activeMemberCount,
      spectatorCount,
      isOwner,
      canManageLeague,
      isMember,
      isSpectator,
      inviteCode: canManageLeague ? league.inviteCode : undefined,
      members,
      spectators,
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
      activeMemberCount: v.number(),
      spectatorCount: v.number(),
      creatorImage: v.optional(v.string()),
      members: v.array(
        v.object({
          name: v.optional(v.string()),
          image: v.optional(v.string()),
        }),
      ),
      spectators: v.array(
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

    const creator = await ctx.db.get("users", league.creatorId);
    const {
      memberCount,
      activeMemberCount,
      spectatorCount,
      members,
      spectators,
    } = await getLeagueMembersSummary(ctx, league._id);

    return {
      _id: league._id,
      name: league.name,
      description: league.description,
      creatorName: creator?.name ?? "Unknown",
      creatorImage: (await resolveUserAvatarUrl(storage, creator)) ?? undefined,
      memberCount,
      activeMemberCount,
      spectatorCount,
      members: members.map((member) => ({
        name: member.name,
        image: member.image,
      })),
      spectators: spectators.map((spectator) => ({
        name: spectator.name,
        image: spectator.image,
      })),
    };
  },
});

export const joinWithInviteCode = mutation({
  args: { inviteCode: v.string(), asSpectator: v.optional(v.boolean()) },
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

    const isSpectator = args.asSpectator ?? false;

    const membershipId = await ctx.db.insert("memberships", {
      userId,
      leagueId: league._id,
      joinDate: Date.now(),
      isSpectator,
    });
    const membershipDoc = await ctx.db.get("memberships", membershipId);
    await membershipsByUser.insert(ctx, membershipDoc!);
    await memberCounter.inc(ctx, league._id);

    // Only create standings entry for non-spectators
    if (!isSpectator) {
      await ctx.db.insert("leagueStandings", {
        leagueId: league._id,
        userId,
        totalPoints: 0,
        totalWins: 0,
      });
    }

    return league._id;
  },
});

export const joinPublicLeague = mutation({
  args: { leagueId: v.id("leagues"), asSpectator: v.optional(v.boolean()) },
  returns: v.union(v.string(), v.id("leagues")),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be logged in to join a league.");
    }

    const league = await ctx.db.get("leagues", args.leagueId);
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

    const isSpectator = args.asSpectator ?? false;

    const membershipId = await ctx.db.insert("memberships", {
      userId,
      leagueId: league._id,
      joinDate: Date.now(),
      isSpectator,
    });
    const membershipDoc = await ctx.db.get("memberships", membershipId);
    await membershipsByUser.insert(ctx, membershipDoc!);
    await memberCounter.inc(ctx, league._id);

    // Only create standings entry for non-spectators
    if (!isSpectator) {
      await ctx.db.insert("leagueStandings", {
        leagueId: league._id,
        userId,
        totalPoints: 0,
        totalWins: 0,
      });
    }

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
    await checkLeagueManagementPermission(ctx, args.leagueId);
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

    await ctx.db.patch("leagues", leagueId, updates);
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
    await checkLeagueManagementPermission(ctx, args.leagueId);

    if (args.action === "disable") {
      await ctx.db.patch("leagues", args.leagueId, { inviteCode: null });
      return { newCode: null };
    } else {
      // regenerate or enable
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
      await ctx.db.patch("leagues", args.leagueId, { inviteCode: inviteCode! });
      return { newCode: inviteCode };
    }
  },
});

export const kickMember = mutation({
  args: { leagueId: v.id("leagues"), memberIdToKick: v.id("users") },
  handler: async (ctx, args) => {
    const league = await checkLeagueManagementPermission(ctx, args.leagueId);
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

    await ctx.db.delete("memberships", membership._id);
    await membershipsByUser.delete(ctx, membership);
    await memberCounter.dec(ctx, args.leagueId);

    // Also remove from standings if present
    const standing = await ctx.db
      .query("leagueStandings")
      .withIndex("by_league_and_user", (q) =>
        q.eq("leagueId", args.leagueId).eq("userId", args.memberIdToKick),
      )
      .first();
    if (standing) {
      await ctx.db.delete("leagueStandings", standing._id);
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
    const userId = await getAuthUserId(ctx);
    const { canView } = await canViewLeague(ctx, args.leagueId, userId);
    if (!canView) {
      return [];
    }

    const standingsDocs = await ctx.db
      .query("leagueStandings")
      .withIndex("by_league_and_points", (q) => q.eq("leagueId", args.leagueId))
      .order("desc")
      .collect();

    const userIds = [
      ...new Set(standingsDocs.map((standing) => standing.userId)),
    ];
    const users = await Promise.all(
      userIds.map((userId) => ctx.db.get("users", userId)),
    );
    const userById = new Map(
      users
        .filter((user): user is NonNullable<typeof user> => user !== null)
        .map((user) => [user._id.toString(), user]),
    );

    const standings = await Promise.all(standingsDocs.map(async (standing) => {
      const user = userById.get(standing.userId.toString());
      return {
        userId: standing.userId,
        name: user?.name ?? "Unknown User",
        image: (await resolveUserAvatarUrl(storage, user)) ?? undefined,
        totalPoints: standing.totalPoints,
      };
    }));

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

const roundSummaryValidator = v.object({
  roundId: v.id("rounds"),
  title: v.string(),
  imageUrl: v.union(v.string(), v.null()),
  status: v.string(),
  submissionCount: v.number(),
  totalVotes: v.number(),
});

export const getLeagueMetadata = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(
    v.null(),
    v.object({
      name: v.string(),
      description: v.string(),
      memberCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const { league, canView } = await canViewLeague(ctx, args.leagueId, userId);
    if (!league || !canView) {
      return null;
    }
    const memberCount = await memberCounter.count(ctx, league._id);
    return {
      name: league.name,
      description: league.description,
      memberCount,
    };
  },
});

export const updateLeagueStats = internalAction({
  args: { leagueId: v.id("leagues") },
  handler: async (ctx, args) => {
    const statsData = await ctx.runQuery(internal.leagueViews.getStatsData, {
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

// getStatsData moved to convex/leagueViews.ts to isolate AWS SDK cold-start cost.
// NEW: Persist computed league stats. Called by updateLeagueStats().
export const storeLeagueStats = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    stats: v.object({
      overlord: v.union(v.null(), userStatValidator),
      peopleChampion: v.union(v.null(), userStatValidator),
      mostControversial: v.union(v.null(), userStatValidator),
      prolificVoter: v.union(v.null(), userStatValidator),
      topSong: v.union(v.null(), topSongValidator),
      top10Songs: v.array(topSongValidator),
      allRounds: v.array(roundSummaryValidator),
      mostUpvotedSong: v.union(v.null(), songAwardValidator),
      mostDownvotedSong: v.union(v.null(), songAwardValidator),
      fanFavoriteSong: v.union(v.null(), songAwardValidator),
      attendanceStar: v.union(v.null(), attendanceStatValidator),
      goldenEars: v.union(v.null(), goldenEarsStatValidator),
      consistencyKing: v.union(v.null(), consistencyStatValidator),
      biggestDownvoter: v.union(v.null(), userStatValidator),
      worstRound: v.union(v.null(), roundAwardValidator),
      closestRound: v.union(v.null(), roundAwardValidator),
      blowoutRound: v.union(v.null(), roundAwardValidator),
      genreBreakdown: v.array(
        v.object({ name: v.string(), value: v.number() }),
      ),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("leagueStats")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .first();

    if (existing) {
      await ctx.db.patch("leagueStats", existing._id, {
        ...args.stats,
      });
    } else {
      await ctx.db.insert("leagueStats", {
        leagueId: args.leagueId,
        ...args.stats,
      });
    }
  },
});

// Return league stats for UI
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
      top10Songs: v.array(topSongValidator),
      allRounds: v.array(roundSummaryValidator),
      mostUpvotedSong: v.union(v.null(), songAwardValidator),
      mostDownvotedSong: v.union(v.null(), songAwardValidator),
      fanFavoriteSong: v.union(v.null(), songAwardValidator),
      attendanceStar: v.union(v.null(), attendanceStatValidator),
      goldenEars: v.union(v.null(), goldenEarsStatValidator),
      consistencyKing: v.union(v.null(), consistencyStatValidator),
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
    const userId = await getAuthUserId(ctx);
    const { canView } = await canViewLeague(ctx, args.leagueId, userId);
    if (!canView) {
      return null;
    }

    const statsDoc = await ctx.db
      .query("leagueStats")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .first();
    if (!statsDoc) return null;

    // Return exactly the shape specified in `returns` (exclude _id, _creationTime, leagueId)
    return {
      overlord: statsDoc.overlord ?? null,
      peopleChampion: statsDoc.peopleChampion ?? null,
      mostControversial: statsDoc.mostControversial ?? null,
      prolificVoter: statsDoc.prolificVoter ?? null,
      topSong: statsDoc.topSong ?? null,
      top10Songs: statsDoc.top10Songs ?? [],
      allRounds: statsDoc.allRounds ?? [],
      mostUpvotedSong: statsDoc.mostUpvotedSong ?? null,
      mostDownvotedSong: statsDoc.mostDownvotedSong ?? null,
      fanFavoriteSong: statsDoc.fanFavoriteSong ?? null,
      attendanceStar: statsDoc.attendanceStar ?? null,
      goldenEars: statsDoc.goldenEars ?? null,
      consistencyKing: statsDoc.consistencyKing ?? null,
      biggestDownvoter: statsDoc.biggestDownvoter ?? null,
      worstRound: statsDoc.worstRound ?? null,
      closestRound: statsDoc.closestRound ?? null,
      blowoutRound: statsDoc.blowoutRound ?? null,
      genreBreakdown: statsDoc.genreBreakdown ?? [],
    };
  },
});

// searchInLeague moved to convex/leagueViews.ts to isolate AWS SDK cold-start cost.

// NEW: Calculate round results, persist them, and update league standings.
// Called from rounds.ts and votes.ts using internal.leagues.calculateAndStoreResults.
export const calculateAndStoreResults = internalMutation({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const round = await ctx.db.get("rounds", roundId);
    if (!round) return;

    const league = await ctx.db.get("leagues", round.leagueId);
    if (!league) return;

    // Load submissions and votes for the round
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", roundId))
      .collect();
    if (submissions.length === 0) {
      // Nothing to do
      return;
    }

    const allVotes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", roundId))
      .collect();

    // Determine which users have "finalized" their votes (used full budgets)
    const budgetByUser = new Map<string, { up: number; down: number }>();
    for (const vte of allVotes) {
      const key = vte.userId.toString();
      const entry = budgetByUser.get(key) ?? { up: 0, down: 0 };
      if (vte.vote > 0) entry.up += vte.vote;
      else if (vte.vote < 0) entry.down += Math.abs(vte.vote);
      budgetByUser.set(key, entry);
    }

    const { maxUp, maxDown } = getVoteLimits(round, league);
    const finalizedVoters = new Set<string>();
    for (const [userId, { up, down }] of budgetByUser.entries()) {
      if (up === maxUp && down === maxDown) {
        finalizedVoters.add(userId);
      }
    }

    // Group votes by submission
    const votesBySubmission = new Map<string, Doc<"votes">[]>();
    for (const vte of allVotes) {
      const sid = vte.submissionId.toString();
      const arr = votesBySubmission.get(sid);
      if (arr) arr.push(vte);
      else votesBySubmission.set(sid, [vte]);
    }

    // Before computing, load previous results for idempotent updates
    const previousResults = await ctx.db
      .query("roundResults")
      .withIndex("by_round", (q) => q.eq("roundId", roundId))
      .collect();

    const previousPointsByUser = new Map<Id<"users">, number>();
    const previousWinsByUser = new Map<Id<"users">, number>();
    for (const res of previousResults) {
      const u = res.userId;
      previousPointsByUser.set(
        u,
        (previousPointsByUser.get(u) ?? 0) + res.points,
      );
      if (res.isWinner) {
        previousWinsByUser.set(u, (previousWinsByUser.get(u) ?? 0) + 1);
      }
    }

    // Clear old results (we re-compute from scratch)
    await Promise.all(
      previousResults.map((result) =>
        ctx.db.delete("roundResults", result._id),
      ),
    );

    // Compute points per submission with penalty:
    // If the submitter did NOT finalize their votes, annul positive votes on their own submission(s).
    // If submission is marked as troll, ignore positive votes but count negative votes.
    const perSubmission = new Map<
      string,
      { points: number; penaltyApplied: boolean }
    >();
    for (const sub of submissions) {
      const sid = sub._id.toString();
      const subVotes = votesBySubmission.get(sid) ?? [];
      const submitterFinalized = finalizedVoters.has(sub.userId.toString());
      const isTrollSubmission = sub.isTrollSubmission ?? false;

      let pts = 0;
      if (!submitterFinalized || isTrollSubmission) {
        // Annul positive votes, keep negatives
        // For troll submissions: positive votes are ignored, negative votes still count
        // For unfinalized submitters: same behavior as before
        for (const vte of subVotes) {
          if (vte.vote < 0) pts += vte.vote;
        }
      } else {
        // Count all votes (normal case)
        for (const vte of subVotes) {
          pts += vte.vote;
        }
      }
      perSubmission.set(sid, {
        points: pts,
        penaltyApplied: !submitterFinalized || isTrollSubmission,
      });
    }

    // Determine winning submissions: all with highest points (allow ties)
    let bestPoints = -Infinity;
    for (const sub of submissions) {
      const sid = sub._id.toString();
      const { points } = perSubmission.get(sid)!;
      if (points > bestPoints) {
        bestPoints = points;
      }
    }

    // Store fresh round results
    await Promise.all(
      submissions.map((sub) => {
        const submissionResult = perSubmission.get(sub._id.toString())!;
        return ctx.db.insert("roundResults", {
          roundId,
          submissionId: sub._id,
          userId: sub.userId,
          points: submissionResult.points,
          isWinner: submissionResult.points === bestPoints,
          penaltyApplied: submissionResult.penaltyApplied,
        });
      }),
    );

    // Compute deltas to apply to standings
    const newPointsByUser = new Map<Id<"users">, number>();
    const newWinsByUser = new Map<Id<"users">, number>();
    for (const sub of submissions) {
      const sid = sub._id.toString();
      const u = sub.userId;
      const r = perSubmission.get(sid)!;
      newPointsByUser.set(u, (newPointsByUser.get(u) ?? 0) + r.points);
      if (r.points === bestPoints) {
        newWinsByUser.set(u, (newWinsByUser.get(u) ?? 0) + 1);
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
      standingsInLeague.map((standing) => [
        standing.userId.toString(),
        standing,
      ]),
    );

    const standingWriteOps: Promise<Id<"leagueStandings"> | void>[] = [];
    for (const uid of allUsers) {
      const deltaPoints =
        (newPointsByUser.get(uid) ?? 0) - (previousPointsByUser.get(uid) ?? 0);
      const deltaWins =
        (newWinsByUser.get(uid) ?? 0) - (previousWinsByUser.get(uid) ?? 0);

      if (deltaPoints === 0 && deltaWins === 0) continue;

      const standing = standingByUserId.get(uid.toString());
      if (!standing) {
        standingWriteOps.push(
          ctx.db.insert("leagueStandings", {
            leagueId: league._id,
            userId: uid,
            totalPoints: deltaPoints,
            totalWins: deltaWins,
          }),
        );
        continue;
      }
      standingWriteOps.push(
        ctx.db.patch("leagueStandings", standing._id, {
          totalPoints: standing.totalPoints + deltaPoints,
          totalWins: standing.totalWins + deltaWins,
        }),
      );
    }
    await Promise.all(standingWriteOps);
  },
});

export const leaveLeague = mutation({
  args: { leagueId: v.id("leagues") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be logged in to leave a league.");
    }

    const league = await ctx.db.get("leagues", args.leagueId);
    if (!league) {
      throw new Error("League not found.");
    }

    if (league.creatorId === userId) {
      throw new Error("The league owner cannot leave their own league.");
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_league_and_user", (q) =>
        q.eq("leagueId", args.leagueId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new Error("You are not a member of this league.");
    }

    await ctx.db.delete("memberships", membership._id);
    await membershipsByUser.delete(ctx, membership);
    await memberCounter.dec(ctx, args.leagueId);

    // Also remove from standings if present
    const standing = await ctx.db
      .query("leagueStandings")
      .withIndex("by_league_and_user", (q) =>
        q.eq("leagueId", args.leagueId).eq("userId", userId),
      )
      .first();
    if (standing) {
      await ctx.db.delete("leagueStandings", standing._id);
    }

    // If the user was a manager, remove them from managers list
    if (league.managers && league.managers.includes(userId)) {
      const newManagers = league.managers.filter((m) => m !== userId);
      await ctx.db.patch("leagues", league._id, { managers: newManagers });
    }

    return "Left league successfully.";
  },
});
