import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
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
  }).index("by_creator", ["creatorId"]),
  rounds: defineTable({
    leagueId: v.id("leagues"),
    title: v.string(),
    description: v.string(), // New field
    imageKey: v.optional(v.string()), // CHANGED: from imageUrl to imageKey
    status: v.union(
      v.literal("submissions"),
      v.literal("voting"),
      v.literal("finished"),
    ),
     submissionDeadline: v.number(), // as a timestamp
     votingDeadline: v.number(), // as a timestamp
   }).index("by_league", ["leagueId"]),
  submissions: defineTable({
    roundId: v.id("rounds"),
    userId: v.id("users"),
    songTitle: v.string(),
    artist: v.string(),
    albumArtKey: v.string(),
    songFileKey: v.string(),
  })
    .index("by_round", ["roundId"])
    .index("by_round_and_user", ["roundId", "userId"]),
  votes: defineTable({
    roundId: v.id("rounds"),
    submissionId: v.id("submissions"),
    userId: v.id("users"),
    vote: v.number(), // +1 for upvote, -1 for downvote
  })
    .index("by_round", ["roundId"])
    .index("by_round_and_user", ["roundId", "userId"]),
 });