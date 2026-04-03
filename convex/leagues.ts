// File: convex/leagues.ts
import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  type MutationCtx,
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
} from "../lib/convex-server/leagues/permissions";
import { getLeagueMembersSummary } from "../lib/convex-server/leagues/members";
import { recalculateAndStoreRoundResults } from "../lib/convex-server/leagues/results";
import { resolveUserAvatarUrl } from "./userAvatar";
import {
  buildLeagueRoundSchedule,
  buildScheduledRoundResequencePatches,
} from "../lib/rounds/schedule";
import {
  MAX_LEAGUE_DOWNVOTES_PER_MEMBER,
  MAX_LEAGUE_UPVOTES_PER_MEMBER,
} from "../lib/leagues/vote-limits";
import {
  buildRoundImageMediaUrl,
  resolveMediaAccessScope,
} from "../lib/media/delivery";

const storage = new B2Storage();

const sortLeaguesForDisplay = (a: Doc<"leagues">, b: Doc<"leagues">) => {
  const nameCompare = a.name.localeCompare(b.name, undefined, {
    sensitivity: "base",
  });
  if (nameCompare !== 0) {
    return nameCompare;
  }
  return b._creationTime - a._creationTime;
};

function buildStandingRankMap(
  standings: Array<{ userId: Id<"users"> }>,
): Map<string, number> {
  return new Map(
    standings.map((standing, index) => [standing.userId.toString(), index + 1]),
  );
}

function buildStandingsShiftMessage(
  leagueName: string,
  roundTitle: string,
  previousRank: number | null,
  nextRank: number,
) {
  if (previousRank === null) {
    return `You entered the standings for "${leagueName}" at #${nextRank} after "${roundTitle}".`;
  }

  if (nextRank < previousRank) {
    return `Your standing in "${leagueName}" improved from #${previousRank} to #${nextRank} after "${roundTitle}".`;
  }

  return `Your standing in "${leagueName}" fell from #${previousRank} to #${nextRank} after "${roundTitle}".`;
}

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

function buildRoundImageScope(
  allowPublic: boolean,
  viewerUserId: Id<"users"> | null,
) {
  return resolveMediaAccessScope(allowPublic, viewerUserId);
}

const publicLeaguePreviewValidator = v.object({
  _id: v.id("leagues"),
  _creationTime: v.number(),
  name: v.string(),
  description: v.string(),
  memberCount: v.number(),
  genres: v.array(v.string()),
  art: v.union(v.string(), v.null()),
  roundArt: v.array(v.string()),
  isActive: v.boolean(),
});

const exploreLeaguePreviewValidator = v.object({
  _id: v.id("leagues"),
  _creationTime: v.number(),
  name: v.string(),
  description: v.string(),
  memberCount: v.number(),
  genres: v.array(v.string()),
  art: v.union(v.string(), v.null()),
  roundArt: v.array(v.string()),
  isActive: v.boolean(),
  visibility: v.union(v.literal("public"), v.literal("private")),
});

async function buildLeaguePreview(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  viewerUserId: Id<"users"> | null,
): Promise<{
  _id: Id<"leagues">;
  _creationTime: number;
  name: string;
  description: string;
  memberCount: number;
  genres: string[];
  art: string | null;
  roundArt: string[];
  isActive: boolean;
}> {
  const roundsPreviewLimit = 5;
  const [memberCount, rounds] = await Promise.all([
    memberCounter.count(ctx, league._id),
    ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", league._id))
      .order("desc")
      .take(roundsPreviewLimit),
  ]);

  const genres = [...new Set(rounds.flatMap((round) => round.genres))];
  const roundArt = [
    ...new Set(
      (
        await Promise.all(
          rounds.slice(0, roundsPreviewLimit).map(async (round) => {
            if (!round.imageKey) {
              return null;
            }
            const scope = buildRoundImageScope(league.isPublic, viewerUserId);
            if (!scope) {
              return null;
            }
            return await buildRoundImageMediaUrl({
              roundId: round._id,
              storageKey: round.imageKey,
              scope,
            });
          }),
        )
      ).filter((art): art is string => art !== null),
    ),
  ].slice(0, 4);
  const isActive = rounds.some(
    (round) => round.status === "submissions" || round.status === "voting",
  );

  return {
    _id: league._id,
    _creationTime: league._creationTime,
    name: league.name,
    description: league.description,
    memberCount,
    genres,
    art: null,
    roundArt,
    isActive,
  };
}

async function claimRoundImageUpload(
  ctx: Pick<MutationCtx, "runMutation">,
  input: {
    key: string;
    ownerUserId: Id<"users">;
    roundId: Id<"rounds">;
  },
) {
  await ctx.runMutation(internal.files.claimStorageUpload, {
    key: input.key,
    ownerUserId: input.ownerUserId,
    kind: "league_image",
    claimType: "round_image",
    claimId: input.roundId,
  });
}

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
    if (
      args.maxPositiveVotes < 1 ||
      args.maxPositiveVotes > MAX_LEAGUE_UPVOTES_PER_MEMBER
    ) {
      throw new Error(
        `Upvotes must be between 1 and ${MAX_LEAGUE_UPVOTES_PER_MEMBER}.`,
      );
    }
    if (
      args.maxNegativeVotes < 0 ||
      args.maxNegativeVotes > MAX_LEAGUE_DOWNVOTES_PER_MEMBER
    ) {
      throw new Error(
        `Downvotes must be between 0 and ${MAX_LEAGUE_DOWNVOTES_PER_MEMBER}.`,
      );
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

    // Create rounds in a fixed sequence with a 24 hour buffer between them.
    const roundSchedules = buildLeagueRoundSchedule({
      roundCount: args.rounds.length,
      startsAt: Date.now(),
      submissionHours: args.submissionDeadline,
      votingHours: args.votingDeadline,
    });

    for (const [index, round] of args.rounds.entries()) {
      const schedule = roundSchedules[index];
      const roundId = await ctx.db.insert("rounds", {
        leagueId: leagueId,
        order: schedule.order,
        title: round.title,
        description: round.description,
        submissionsPerUser: round.submissionsPerUser ?? 1,
        imageKey: round.imageKey,
        genres: round.genres,
        status: schedule.status,
        submissionStartsAt: schedule.submissionStartsAt,
        submissionDeadline: schedule.submissionDeadline,
        votingDeadline: schedule.votingDeadline,
        submissionMode: round.submissionMode ?? "single",
        submissionInstructions: round.submissionInstructions,
        albumConfig: round.albumConfig,
      });
      if (round.imageKey) {
        await claimRoundImageUpload(ctx, {
          key: round.imageKey,
          ownerUserId: userId,
          roundId,
        });
      }

      if (schedule.status === "submissions") {
        await ctx.scheduler.runAfter(0, internal.notifications.create, {
          userId: userId,
          type: "round_submission",
          message: `Your new round, "${round.title}", is open for submissions in "${args.name}"!`,
          link: `/leagues/${leagueId}/round/${roundId}`,
          triggeringUserId: userId,
        });
      }
    }

    return leagueId;
  },
});

export const getPublicLeagues = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(publicLeaguePreviewValidator),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 25, 50));
    const publicLeagues = await ctx.db
      .query("leagues")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .order("desc")
      .take(limit);

    return await Promise.all(
      publicLeagues.map((league) => buildLeaguePreview(ctx, league, null)),
    );
  },
});

export const getExploreLeagues = query({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    publicLeagues: v.array(exploreLeaguePreviewValidator),
    joinedPrivateLeagues: v.array(exploreLeaguePreviewValidator),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const limit = Math.max(1, Math.min(args.limit ?? 25, 50));
    const publicLeagues = await ctx.db
      .query("leagues")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .order("desc")
      .take(limit);

    const joinedPrivateLeagueIds = !userId
      ? []
      : [
          ...new Map(
            (
              await ctx.db
                .query("memberships")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect()
            )
              .sort((a, b) => (b.joinDate ?? 0) - (a.joinDate ?? 0))
              .map((membership) => [
                membership.leagueId.toString(),
                membership.leagueId,
              ]),
          ).values(),
        ];

    const joinedPrivateLeagueDocs = (
      await Promise.all(
        joinedPrivateLeagueIds.map((leagueId) => ctx.db.get("leagues", leagueId)),
      )
    ).filter(
      (league): league is Doc<"leagues"> => league !== null && !league.isPublic,
    );

    const [publicLeaguePreviews, joinedPrivateLeaguePreviews] =
      await Promise.all([
        Promise.all(
          publicLeagues.map(async (league) => ({
            ...(await buildLeaguePreview(ctx, league, userId ?? null)),
            visibility: "public" as const,
          })),
        ),
        Promise.all(
          joinedPrivateLeagueDocs.map(async (league) => ({
            ...(await buildLeaguePreview(ctx, league, userId ?? null)),
            visibility: "private" as const,
          })),
        ),
      ]);

    return {
      publicLeagues: publicLeaguePreviews,
      joinedPrivateLeagues: joinedPrivateLeaguePreviews,
    };
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
          joinDate: v.optional(v.number()),
        }),
      ),
      spectators: v.array(
        v.object({
          _id: v.id("users"),
          name: v.optional(v.string()),
          image: v.optional(v.string()),
          joinDate: v.optional(v.number()),
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
          joinDate: v.optional(v.number()),
        }),
      ),
      spectators: v.array(
        v.object({
          name: v.optional(v.string()),
          image: v.optional(v.string()),
          joinDate: v.optional(v.number()),
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
        joinDate: member.joinDate,
      })),
      spectators: spectators.map((spectator) => ({
        name: spectator.name,
        image: spectator.image,
        joinDate: spectator.joinDate,
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
    const league = await checkLeagueManagementPermission(ctx, args.leagueId);
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

    if (
      updates.submissionDeadline !== undefined ||
      updates.votingDeadline !== undefined
    ) {
      const rounds = await ctx.db
        .query("rounds")
        .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
        .collect();
      const nextSubmissionHours =
        updates.submissionDeadline ?? league.submissionDeadline;
      const nextVotingHours = updates.votingDeadline ?? league.votingDeadline;
      const resequencePatches = buildScheduledRoundResequencePatches({
        rounds,
        submissionHours: nextSubmissionHours,
        votingHours: nextVotingHours,
      });

      await Promise.all(
        resequencePatches.map(({ roundId, patch }) =>
          ctx.db.patch("rounds", roundId as Id<"rounds">, patch),
        ),
      );
    }

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

    const standings = await Promise.all(
      standingsDocs.map(async (standing) => {
        const user = userById.get(standing.userId.toString());
        return {
          userId: standing.userId,
          name: user?.name ?? "Unknown User",
          image: (await resolveUserAvatarUrl(storage, user)) ?? undefined,
          totalPoints: standing.totalPoints,
        };
      }),
    );

    return standings;
  },
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

// searchInLeague moved to convex/leagueViews.ts to isolate AWS SDK cold-start cost.

// NEW: Calculate round results, persist them, and update league standings.
// Called from rounds.ts and votes.ts using internal.leagues.calculateAndStoreResults.
export const calculateAndStoreResults = internalMutation({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const round = await ctx.db.get("rounds", roundId);
    if (!round) {
      return;
    }

    const league = await ctx.db.get("leagues", round.leagueId);
    if (!league) {
      return;
    }

    const previousStandings = await ctx.db
      .query("leagueStandings")
      .withIndex("by_league_and_points", (q) => q.eq("leagueId", league._id))
      .order("desc")
      .collect();

    await recalculateAndStoreRoundResults(ctx, roundId);

    const nextStandings = await ctx.db
      .query("leagueStandings")
      .withIndex("by_league_and_points", (q) => q.eq("leagueId", league._id))
      .order("desc")
      .collect();

    const previousRanks = buildStandingRankMap(previousStandings);
    const nextRanks = buildStandingRankMap(nextStandings);
    const standingsShiftNotifications = nextStandings.flatMap((standing) => {
      const nextRank = nextRanks.get(standing.userId.toString());
      if (!nextRank) {
        return [];
      }

      const previousRank = previousRanks.get(standing.userId.toString()) ?? null;
      if (previousRank === nextRank) {
        return [];
      }

      return [
        {
          userId: standing.userId,
          type: "round_finished" as const,
          message: buildStandingsShiftMessage(
            league.name,
            round.title,
            previousRank,
            nextRank,
          ),
          link: `/leagues/${league._id}`,
          metadata: {
            source: `standings-shift:${round._id}:${standing.userId}:${previousRank ?? "new"}:${nextRank}`,
          },
          pushNotificationOverride: {
            title: "Standings Updated",
          },
        },
      ];
    });

    if (standingsShiftNotifications.length === 0) {
      return;
    }

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
      { notifications: standingsShiftNotifications },
    );
    if (createdNotifications.length === 0) {
      return;
    }

    await ctx.scheduler.runAfter(0, internal.discordBot.dispatchRoundNotification, {
      leagueId: league._id,
      roundId: round._id,
      roundStatus: "finished",
      reminderKind: "standings_shift",
      message: `Standings changed after "${round.title}" in "${league.name}". Check the updated leaderboard.`,
      actionUrl: `/leagues/${league._id}`,
      source: `standings-shift:${round._id}`,
      targetUserIds: createdNotifications.map(
        (notification: { userId: Id<"users"> }) => notification.userId,
      ),
    });
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
