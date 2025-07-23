import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
 
export default defineSchema({
  ...authTables,
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
  })
    .index("by_creator", ["creatorId"])
    .index("by_invite_code", ["inviteCode"]),
 
  memberships: defineTable({
    userId: v.id("users"),
    leagueId: v.id("leagues"),
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
  }).index("by_league", ["leagueId"]),
 
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
      v.literal("spotify"),
      v.literal("youtube"),
    ),
    songLink: v.optional(v.string()),
    albumArtUrlValue: v.optional(v.string()),
    waveform: v.optional(v.string()),
  })
    .index("by_round", ["roundId"])
    .index("by_round_and_user", ["roundId", "userId"])
    .index("by_user", ["userId"])
    .index("by_user_and_league", ["userId", "leagueId"]),
 
  votes: defineTable({
    roundId: v.id("rounds"),
    submissionId: v.id("submissions"),
    userId: v.id("users"),
    vote: v.number(),
  })
    .index("by_round", ["roundId"])
    .index("by_round_and_user", ["roundId", "userId"])
    .index("by_submission_and_user", ["submissionId", "userId"]),
 
  bookmarks: defineTable({
    userId: v.id("users"),
    submissionId: v.id("submissions"),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_submission", ["userId", "submissionId"]),
 
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
  }).index("by_user", ["userId"]),
 
  roundResults: defineTable({
    roundId: v.id("rounds"),
    submissionId: v.id("submissions"),
    userId: v.id("users"),
    points: v.number(),
    isWinner: v.boolean(),
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