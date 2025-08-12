/* eslint-disable no-case-declarations */
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

const daysToMs = (days: number) => days * 24 * 60 * 60 * 1000;
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
    rounds: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
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

    if (args.submissionDeadline < 1 || args.submissionDeadline > 30) {
      throw new Error("Submission period must be between 1 and 30 days.");
    }
    if (args.votingDeadline < 1 || args.votingDeadline > 30) {
      throw new Error("Voting period must be between 1 and 30 days.");
    }
    if (args.maxPositiveVotes < 1 || args.maxPositiveVotes > 10) {
      throw new Error("Upvotes must be between 1 and 10.");
    }

    let inviteCode;
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
        submissionTime + daysToMs(args.submissionDeadline);
      const votingDeadlineTimestamp =
        submissionDeadlineTimestamp + daysToMs(args.votingDeadline);
      const roundId = await ctx.db.insert("rounds", {
        leagueId: leagueId,
        title: round.title,
        description: round.description,
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
      isOwner: isOwner,
      isMember: isMember,
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
  },
  handler: async (ctx, args) => {
    await checkLeagueOwnership(ctx, args.leagueId);
    const { leagueId, ...updates } = args;
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
      let inviteCode;
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
    const memberDocs = await Promise.all(memberIds.map((id) => ctx.db.get(id)));
    const members = memberDocs.filter((u): u is Doc<"users"> => u !== null);
    const memberMap = new Map(
      members.map((m) => [m._id.toString(), { name: m.name, image: m.image }]),
    );

    const standings = await ctx.db
      .query("leagueStandings")
      .withIndex("by_league_and_user", (q) => q.eq("leagueId", args.leagueId))
      .collect();

    const mostWins = standings.sort((a, b) => b.totalWins - a.totalWins);
    const overlord =
      mostWins.length > 0
        ? { userId: mostWins[0].userId, count: mostWins[0].totalWins }
        : null;

    // Sum vote magnitudes (supports stacked votes)
    const userUpvotes = new Map<string, number>();
    const userDownvotes = new Map<string, number>();
    const submissionSubmitterMap = new Map(
      results.map((r) => [r.submissionId.toString(), r.userId]),
    );
    votes.forEach((vote) => {
      const submitterId = submissionSubmitterMap.get(
        vote.submissionId.toString(),
      );
      if (!submitterId) return;
      if (vote.vote > 0)
        userUpvotes.set(
          submitterId.toString(),
          (userUpvotes.get(submitterId.toString()) ?? 0) + vote.vote, // add positive magnitude
        );
      if (vote.vote < 0)
        userDownvotes.set(
          submitterId.toString(),
          (userDownvotes.get(submitterId.toString()) ?? 0) +
            Math.abs(vote.vote), // add negative magnitude
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

    // Prolific voter: total units of votes cast (pos + neg magnitudes)
    const userVoteCount = new Map<string, number>();
    votes.forEach((vote) =>
      userVoteCount.set(
        vote.userId.toString(),
        (userVoteCount.get(vote.userId.toString()) ?? 0) + Math.abs(vote.vote),
      ),
    );
    const mostVotesCast = [...userVoteCount.entries()].sort(
      (a, b) => b[1] - a[1],
    );
    const prolificVoter =
      mostVotesCast.length > 0
        ? { userId: mostVotesCast[0][0], count: mostVotesCast[0][1] }
        : null;

    const topResult =
      results.length > 0
        ? results.sort((a, b) => b.points - a.points)[0]
        : null;

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

    const genreCounts: Record<string, number> = {};
    const roundsMap = new Map(finishedRounds.map((r) => [r._id.toString(), r]));
    submissions.forEach((sub) => {
      const round = roundsMap.get(sub.roundId.toString());
      if (round) {
        round.genres.forEach((genre) => {
          genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;
        });
      }
    });
    const genreBreakdown = Object.entries(genreCounts).map(([name, value]) => ({
      name,
      value,
    }));

    const formatUserStat = (stat: { userId: string; count: number } | null) => {
      if (!stat) return null;
      const user = memberMap.get(stat.userId);
      if (!user) return null;
      return { ...user, count: stat.count };
    };

    const formatTopSong = async (result: Doc<"roundResults"> | null) => {
      if (!result) return null;
      const submission = await ctx.db.get(result.submissionId);
      if (!submission) return null;
      let albumArtUrl: string | null = null;
      if (submission.submissionType === "file" && submission.albumArtKey) {
        albumArtUrl = await r2.getUrl(submission.albumArtKey);
      } else {
        albumArtUrl = submission.albumArtUrlValue ?? null;
      }

      const submitter = memberMap.get(submission.userId.toString());
      return {
        songTitle: submission.songTitle,
        artist: submission.artist,
        albumArtUrl: albumArtUrl,
        score: result.points,
        submittedBy: submitter?.name ?? "Unknown",
      };
    };

    return {
      overlord: formatUserStat(overlord),
      peopleChampion: formatUserStat(peopleChampion),
      mostControversial: formatUserStat(mostControversial),
      prolificVoter: formatUserStat(prolificVoter),
      topSong: await formatTopSong(topResult),
      genreBreakdown,
    };
  },
});

export const calculateAndStoreResults = internalMutation({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round || round.status !== "finished") {
      console.warn("Attempted to calculate results for a non-finished round.");
      return;
    }

    const league = await ctx.db.get(round.leagueId);
    if (!league) {
      console.error(
        `League not found for round ${args.roundId}, cannot calculate results`,
      );
      return;
    }

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
      .collect();

    if (submissions.length === 0) {
      return;
    }

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
      .collect();

    // Identify submitters who didn't complete full budget (use magnitudes)
    const allVotersInRound = new Map<
      Id<"users">,
      { up: number; down: number }
    >();
    votes.forEach((vote) => {
      if (!allVotersInRound.has(vote.userId)) {
        allVotersInRound.set(vote.userId, { up: 0, down: 0 });
      }
      const counts = allVotersInRound.get(vote.userId)!;
      if (vote.vote > 0) counts.up += vote.vote;
      if (vote.vote < 0) counts.down += Math.abs(vote.vote);
    });

    const submitterIds = new Set(submissions.map((s) => s.userId));
    const nonCompleteVoters = new Set<Id<"users">>();

    submitterIds.forEach((submitterId) => {
      const voterInfo = allVotersInRound.get(submitterId);
      if (
        !voterInfo ||
        voterInfo.up < league.maxPositiveVotes ||
        voterInfo.down < league.maxNegativeVotes
      ) {
        nonCompleteVoters.add(submitterId);
      }
    });

    // Calculate scores, applying penalty
    const submissionScores = new Map<Id<"submissions">, number>();
    const penaltyApplied = new Map<Id<"submissions">, boolean>();

    submissions.forEach((s) => {
      submissionScores.set(s._id, 0);
      penaltyApplied.set(s._id, false);
    });

    votes.forEach((vote) => {
      const submission = submissions.find((s) => s._id === vote.submissionId);
      if (!submission) return;

      const submitterId = submission.userId;
      const submitterDidNotVoteCompletely = nonCompleteVoters.has(submitterId);

      let voteValue = vote.vote;

      if (submitterDidNotVoteCompletely && vote.vote > 0) {
        voteValue = 0;
        penaltyApplied.set(submission._id, true);
      }

      submissionScores.set(
        vote.submissionId,
        (submissionScores.get(vote.submissionId) ?? 0) + voteValue,
      );
    });

    // Determine winners
    const winners: Id<"submissions">[] = [];
    if (submissionScores.size > 0) {
      let maxScore = -Infinity;
      submissionScores.forEach((score) => {
        if (score > maxScore) {
          maxScore = score;
        }
      });
      if (maxScore > 0) {
        submissionScores.forEach((score, subId) => {
          if (score === maxScore) {
            winners.push(subId);
          }
        });
      }
    }

    // Store results and update standings
    for (const sub of submissions) {
      const points = submissionScores.get(sub._id) ?? 0;
      const isWinner = winners.includes(sub._id);
      const wasPenalized = penaltyApplied.get(sub._id) ?? false;

      await ctx.db.insert("roundResults", {
        roundId: args.roundId,
        submissionId: sub._id,
        userId: sub.userId,
        points,
        isWinner,
        penaltyApplied: wasPenalized,
      });

      const userStanding = await ctx.db
        .query("leagueStandings")
        .withIndex("by_league_and_user", (q) =>
          q.eq("leagueId", round.leagueId).eq("userId", sub.userId),
        )
        .first();

      if (userStanding) {
        await ctx.db.patch(userStanding._id, {
          totalPoints: userStanding.totalPoints + points,
          totalWins: userStanding.totalWins + (isWinner ? 1 : 0),
        });
      }
    }
  },
});

export const storeLeagueStats = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    stats: v.object({
      overlord: v.union(v.null(), userStatValidator),
      peopleChampion: v.union(v.null(), userStatValidator),
      mostControversial: v.union(v.null(), userStatValidator),
      prolificVoter: v.union(v.null(), userStatValidator),
      topSong: v.union(v.null(), topSongValidator),
      genreBreakdown: v.array(
        v.object({ name: v.string(), value: v.number() }),
      ),
    }),
  },
  handler: async (ctx, args) => {
    const existingStats = await ctx.db
      .query("leagueStats")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .first();

    if (existingStats) {
      await ctx.db.patch(existingStats._id, args.stats);
    } else {
      await ctx.db.insert("leagueStats", {
        leagueId: args.leagueId,
        ...args.stats,
      });
    }
  },
});

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