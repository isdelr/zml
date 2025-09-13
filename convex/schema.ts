// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    subscription: v.object({
      keys: v.object({
        p256dh: v.string(),
        auth: v.string(),
      }),
    }),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    deactivatedAt: v.optional(v.number()),
    deactivationReason: v.optional(v.string()),
  })
    .index("by_endpoint", ["endpoint"])
    .index("by_user", ["userId"]),
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    isGlobalAdmin: v.optional(v.boolean()),
    presence: v.optional(
      v.object({
        location: v.union(v.null(), v.id("submissions")),
        roundId: v.optional(v.id("rounds")),
        updated: v.number(),
        data: v.any(),
      }),
    ),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_presence", ["presence.location"])
    .index("by_presence_round", ["presence.roundId"]),
  numbers: defineTable({
    value: v.number(),
  }),
  leagues: defineTable({
    name: v.string(),
    description: v.string(),
    isPublic: v.boolean(),
    creatorId: v.id("users"),
    submissionDeadline: v.number(),
    votingDeadline: v.number(),
    maxPositiveVotes: v.number(),
    maxNegativeVotes: v.number(),
    inviteCode: v.union(v.string(), v.null()),
    managers: v.optional(v.array(v.id("users"))),
    enforceListenPercentage: v.optional(v.boolean()),
    listenPercentage: v.optional(v.number()),
    listenTimeLimitMinutes: v.optional(v.number()),
    limitVotesPerSubmission: v.optional(v.boolean()),
    maxPositiveVotesPerSubmission: v.optional(v.number()),
    maxNegativeVotesPerSubmission: v.optional(v.number()),
  })
    .index("by_creator", ["creatorId"])
    .index("by_invite_code", ["inviteCode"])
    .index("by_public", ["isPublic"]),

  memberships: defineTable({
    userId: v.id("users"),
    leagueId: v.id("leagues"),
    joinDate: v.optional(v.number()),
    trollSubmissionCount: v.optional(v.number()),
    isBanned: v.optional(v.boolean()),
    bannedAt: v.optional(v.number()),
  })
    .index("by_league_and_user", ["leagueId", "userId"])
    .index("by_user", ["userId"])
    .index("by_league", ["leagueId"]),

  rounds: defineTable({
    leagueId: v.id("leagues"),
    title: v.string(),
    description: v.string(),
    imageKey: v.optional(v.string()),
    genres: v.array(v.string()),
    status: v.union(
      v.literal("submissions"),
      v.literal("voting"),
      v.literal("finished"),
    ),
    submissionDeadline: v.number(),
    votingDeadline: v.number(),
    submissionsPerUser: v.optional(v.number()),
    // Per-round overrides for vote limits; null/undefined means use league defaults
    maxPositiveVotes: v.optional(v.union(v.number(), v.null())),
    maxNegativeVotes: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_league", ["leagueId"])
    .index("by_league_and_status", ["leagueId", "status"]),

  submissions: defineTable({
    leagueId: v.id("leagues"),
    roundId: v.id("rounds"),
    userId: v.id("users"),
    songTitle: v.string(),
    artist: v.string(),
    albumArtKey: v.optional(v.string()),
    songFileKey: v.optional(v.string()),
    comment: v.optional(v.string()),
    submissionType: v.union(
      v.literal("file"),
      v.literal("youtube"),
    ),
    songLink: v.optional(v.string()),
    albumArtUrlValue: v.optional(v.string()),
    waveform: v.optional(v.string()),
    duration: v.optional(v.number()),
    searchText: v.string(),
    isTrollSubmission: v.optional(v.boolean()),
    markedAsTrollBy: v.optional(v.id("users")),
    markedAsTrollAt: v.optional(v.number()),
  })
    .index("by_round_and_user", ["roundId", "userId"])
    .index("by_user_and_league", ["userId", "leagueId"])
    .index("by_league", ["leagueId"])
    .searchIndex("by_text", {
      searchField: "searchText",
      filterFields: ["leagueId"],
    }),

  presubmissions: defineTable({
    leagueId: v.id("leagues"),
    roundId: v.id("rounds"),
    userId: v.id("users"),
    songTitle: v.string(),
    artist: v.string(),
    albumArtKey: v.optional(v.string()),
    songFileKey: v.optional(v.string()),
    comment: v.optional(v.string()),
    submissionType: v.union(
      v.literal("file"),
      v.literal("youtube"),
    ),
    songLink: v.optional(v.string()),
    albumArtUrlValue: v.optional(v.string()),
    duration: v.optional(v.number()),
    searchText: v.string(),
    _note: v.optional(v.string()),
  })
    .index("by_round_and_user", ["roundId", "userId"])
    .index("by_league", ["leagueId"]),

  votes: defineTable({
    roundId: v.id("rounds"),
    submissionId: v.id("submissions"),
    userId: v.id("users"),
    vote: v.number(),
  })
    .index("by_round_and_user", ["roundId", "userId"])
    .index("by_submission_and_user", ["submissionId", "userId"]),

  bookmarks: defineTable({
    userId: v.id("users"),
    submissionId: v.id("submissions"),
  })
    .index("by_user_and_submission", ["userId", "submissionId"])
    .index("by_submission", ["submissionId"]), // NEW

  leagueStats: defineTable({
    leagueId: v.id("leagues"),
    overlord: v.union(
      v.null(),
      v.object({
        name: v.optional(v.string()),
        image: v.optional(v.string()),
        count: v.number(),
      }),
    ),
    peopleChampion: v.union(
      v.null(),
      v.object({
        name: v.optional(v.string()),
        image: v.optional(v.string()),
        count: v.number(),
      }),
    ),
    mostControversial: v.union(
      v.null(),
      v.object({
        name: v.optional(v.string()),
        image: v.optional(v.string()),
        count: v.number(),
      }),
    ),
    prolificVoter: v.union(
      v.null(),
      v.object({
        name: v.optional(v.string()),
        image: v.optional(v.string()),
        count: v.number(),
      }),
    ),
    topSong: v.union(
      v.null(),
      v.object({
        songTitle: v.string(),
        artist: v.string(),
        albumArtUrl: v.union(v.string(), v.null()),
        score: v.number(),
        submittedBy: v.string(),
      }),
    ),
    // NEW song-level awards
    mostUpvotedSong: v.union(
      v.null(),
      v.object({
        songTitle: v.string(),
        artist: v.string(),
        albumArtUrl: v.union(v.string(), v.null()),
        submittedBy: v.string(),
        count: v.number(), // total upvotes
      }),
    ),
    mostDownvotedSong: v.union(
      v.null(),
      v.object({
        songTitle: v.string(),
        artist: v.string(),
        albumArtUrl: v.union(v.string(), v.null()),
        submittedBy: v.string(),
        count: v.number(), // total downvotes
      }),
    ),
    fanFavoriteSong: v.union(
      v.null(),
      v.object({
        songTitle: v.string(),
        artist: v.string(),
        albumArtUrl: v.union(v.string(), v.null()),
        submittedBy: v.string(),
        count: v.number(), // bookmarks
      }),
    ),

    attendanceStar: v.union(
      v.null(),
      v.object({
        name: v.optional(v.string()),
        image: v.optional(v.string()),
        count: v.number(),
        meta: v.optional(v.object({ totalRounds: v.number() })),
      }),
    ),
    goldenEars: v.union(
      v.null(),
      v.object({
        name: v.optional(v.string()),
        image: v.optional(v.string()),
        count: v.number(), // avg points per submission
        meta: v.optional(v.object({ rounds: v.number() })),
      }),
    ),
    consistencyKing: v.union(
      v.null(),
      v.object({
        name: v.optional(v.string()),
        image: v.optional(v.string()),
        count: v.number(), // stdev
        meta: v.optional(v.object({ rounds: v.number(), average: v.number() })),
      }),
    ),
    biggestDownvoter: v.union(
      v.null(),
      v.object({
        name: v.optional(v.string()),
        image: v.optional(v.string()),
        count: v.number(), // downvotes cast
      }),
    ),

    worstRound: v.union(
      v.null(),
      v.object({
        roundId: v.id("rounds"),
        title: v.string(),
        imageUrl: v.union(v.string(), v.null()),
        metric: v.number(),
        submissions: v.number(),
        totalUpvotes: v.number(),
      }),
    ),
    closestRound: v.union(
      v.null(),
      v.object({
        roundId: v.id("rounds"),
        title: v.string(),
        imageUrl: v.union(v.string(), v.null()),
        metric: v.number(), // smallest top-2 points diff
        submissions: v.number(),
        totalUpvotes: v.number(),
      }),
    ),
    blowoutRound: v.union(
      v.null(),
      v.object({
        roundId: v.id("rounds"),
        title: v.string(),
        imageUrl: v.union(v.string(), v.null()),
        metric: v.number(), // largest top-2 points diff
        submissions: v.number(),
        totalUpvotes: v.number(),
      }),
    ),
    // Existing chart
    genreBreakdown: v.array(v.object({ name: v.string(), value: v.number() })),
  }).index("by_league", ["leagueId"]),

  listenProgress: defineTable({
    userId: v.id("users"),
    submissionId: v.id("submissions"),
    progressSeconds: v.number(),
    isCompleted: v.boolean(),
  }).index("by_user_and_submission", ["userId", "submissionId"]),

  comments: defineTable({
    submissionId: v.id("submissions"),
    userId: v.id("users"),
    text: v.string(),
  }).index("by_submission", ["submissionId"]),

  notifications: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("new_comment"),
      v.literal("round_submission"),
      v.literal("round_voting"),
      v.literal("round_finished"),
    ),
    message: v.string(),
    link: v.string(),
    read: v.boolean(),
    triggeringUserId: v.optional(v.id("users")),
    metadata: v.optional(v.any()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_read", ["userId", "read"]),

  roundResults: defineTable({
    roundId: v.id("rounds"),
    submissionId: v.id("submissions"),
    userId: v.id("users"),
    points: v.number(),
    isWinner: v.boolean(),
    penaltyApplied: v.optional(v.boolean()),
  })
    .index("by_round", ["roundId"])
    .index("by_submission", ["submissionId"]),

  leagueStandings: defineTable({
    leagueId: v.id("leagues"),
    userId: v.id("users"),
    totalPoints: v.number(),
    totalWins: v.number(),
  })
    .index("by_league_and_user", ["leagueId", "userId"])
    .index("by_league_and_points", ["leagueId", "totalPoints"]),
});
