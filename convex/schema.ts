// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const presenceDataValidator = v.object({
  source: v.optional(v.string()),
  tick: v.optional(v.number()),
});

const notificationMetadataValidator = v.object({
  seedNamespace: v.optional(v.string()),
  source: v.optional(v.string()),
});
const extensionPollStatusValidator = v.union(
  v.literal("open"),
  v.literal("resolved"),
);
const extensionPollResultValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("tie"),
  v.literal("rejected"),
  v.literal("insufficient_turnout"),
  v.literal("closed"),
);
const extensionPollTypeValidator = v.union(
  v.literal("submission"),
  v.literal("voting"),
);
const extensionPollVoteChoiceValidator = v.union(
  v.literal("grant"),
  v.literal("deny"),
);
const storageUploadKindValidator = v.union(
  v.literal("league_image"),
  v.literal("submission_file"),
);
const storageUploadStatusValidator = v.union(
  v.literal("reserved"),
  v.literal("uploaded"),
  v.literal("claimed"),
  v.literal("aborted"),
  v.literal("deleted"),
);
const storageUploadClaimTypeValidator = v.union(
  v.literal("round_image"),
  v.literal("submission_album_art"),
  v.literal("submission_audio_original"),
);

export default defineSchema({
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
    .index("by_user", ["userId"])
    .index("by_user_and_active", ["userId", "isActive"])
    .index("by_active", ["isActive"])
    .index("by_active_and_deactivated_at", ["isActive", "deactivatedAt"]),
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    providerImageUrl: v.optional(v.string()),
    imageCachedFromUrl: v.optional(v.string()),
    imageCachedAt: v.optional(v.number()),
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
        data: presenceDataValidator,
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
    isSpectator: v.optional(v.boolean()),
  })
    .index("by_league_and_user", ["leagueId", "userId"])
    .index("by_user", ["userId"])
    .index("by_league", ["leagueId"]),

  rounds: defineTable({
    leagueId: v.id("leagues"),
    order: v.optional(v.number()),
    title: v.string(),
    description: v.string(),
    imageKey: v.optional(v.string()),
    genres: v.array(v.string()),
    status: v.union(
      v.literal("scheduled"),
      v.literal("submissions"),
      v.literal("voting"),
      v.literal("finished"),
    ),
    submissionStartsAt: v.optional(v.number()),
    submissionDeadline: v.number(),
    votingDeadline: v.number(),
    submissionsPerUser: v.optional(v.number()),
    // Per-round overrides for vote limits; null/undefined means use league defaults
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
  })
    .index("by_league", ["leagueId"])
    .index("by_league_and_status", ["leagueId", "status"])
    .index("by_status_and_submission_start", ["status", "submissionStartsAt"])
    .index("by_status_and_submission_deadline", [
      "status",
      "submissionDeadline",
    ])
    .index("by_status_and_voting_deadline", ["status", "votingDeadline"]),

  submissions: defineTable({
    leagueId: v.id("leagues"),
    roundId: v.id("rounds"),
    userId: v.id("users"),
    songTitle: v.string(),
    artist: v.string(),
    albumName: v.optional(v.string()),
    year: v.optional(v.number()),
    albumArtKey: v.optional(v.string()),
    songFileKey: v.optional(v.string()),
    originalSongFileKey: v.optional(v.string()),
    songFileLegacyKey: v.optional(v.string()),
    fileProcessingStatus: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("converting"),
        v.literal("ready"),
        v.literal("failed"),
      ),
    ),
    fileProcessingError: v.optional(v.string()),
    fileProcessingQueuedAt: v.optional(v.number()),
    fileProcessingStartedAt: v.optional(v.number()),
    fileProcessingCompletedAt: v.optional(v.number()),
    comment: v.optional(v.string()),
    submissionType: v.union(v.literal("file"), v.literal("youtube")),
    songLink: v.optional(v.string()),
    albumArtUrlValue: v.optional(v.string()),
    waveform: v.optional(v.string()),
    duration: v.optional(v.number()),
    searchText: v.string(),
    normalizedSongTitle: v.string(),
    normalizedArtist: v.string(),
    isTrollSubmission: v.optional(v.boolean()),
    markedAsTrollBy: v.optional(v.id("users")),
    markedAsTrollAt: v.optional(v.number()),
    lyrics: v.optional(v.string()),
    lyricsFetchFingerprint: v.optional(v.string()),
    lyricsFetchStatus: v.optional(
      v.union(v.literal("found"), v.literal("not_found")),
    ),
    lyricsFetchDetail: v.optional(v.string()),
    lyricsFetchedAt: v.optional(v.number()),
    collectionId: v.optional(v.string()),
    collectionType: v.optional(v.union(v.literal("multi"), v.literal("album"))),
    collectionName: v.optional(v.string()),
    collectionArtist: v.optional(v.string()),
    collectionNotes: v.optional(v.string()),
    collectionReleaseYear: v.optional(v.number()),
    collectionTotalTracks: v.optional(v.number()),
    trackNumber: v.optional(v.number()),
  })
    .index("by_round_and_user", ["roundId", "userId"])
    .index("by_user_and_league", ["userId", "leagueId"])
    .index("by_league", ["leagueId"])
    .index("by_file_processing_status", ["fileProcessingStatus"])
    .index("by_league_and_normalized_song_title", [
      "leagueId",
      "normalizedSongTitle",
    ])
    .index("by_league_and_normalized_artist", ["leagueId", "normalizedArtist"])
    .index("by_collection", ["collectionId"])
    .searchIndex("by_text", {
      searchField: "searchText",
      filterFields: ["leagueId"],
    }),

  votes: defineTable({
    roundId: v.id("rounds"),
    submissionId: v.id("submissions"),
    userId: v.id("users"),
    vote: v.number(),
  })
    .index("by_round_and_user", ["roundId", "userId"])
    .index("by_submission_and_user", ["submissionId", "userId"]),

  extensionPolls: defineTable({
    leagueId: v.id("leagues"),
    roundId: v.id("rounds"),
    requesterUserId: v.id("users"),
    type: v.optional(extensionPollTypeValidator),
    reason: v.string(),
    status: extensionPollStatusValidator,
    result: extensionPollResultValidator,
    openedAt: v.number(),
    resolvesAt: v.number(),
    eligibleVoterIds: v.array(v.id("users")),
    eligibleVoterCount: v.number(),
    yesVotes: v.number(),
    noVotes: v.number(),
    appliedExtensionMs: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_round", ["roundId"])
    .index("by_league", ["leagueId"])
    .index("by_league_and_requester", ["leagueId", "requesterUserId"])
    .index("by_status_and_resolves_at", ["status", "resolvesAt"]),

  extensionPollVotes: defineTable({
    pollId: v.id("extensionPolls"),
    voterUserId: v.id("users"),
    vote: extensionPollVoteChoiceValidator,
    createdAt: v.number(),
  })
    .index("by_poll", ["pollId"])
    .index("by_poll_and_voter", ["pollId", "voterUserId"]),

  adminVoteAdjustments: defineTable({
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
    .index("by_user_and_submission", ["userId", "submissionId"])
    .index("by_submission", ["submissionId"]), // NEW

  listenProgress: defineTable({
    userId: v.id("users"),
    submissionId: v.id("submissions"),
    roundId: v.id("rounds"),
    progressSeconds: v.number(),
    isCompleted: v.boolean(),
  })
    .index("by_user_and_submission", ["userId", "submissionId"])
    .index("by_round_and_user", ["roundId", "userId"]),

  youtubePlaylistSessions: defineTable({
    userId: v.id("users"),
    roundId: v.id("rounds"),
    durationSec: v.number(),
    startedAt: v.number(),
    endAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_round_and_user", ["roundId", "userId"]),

  comments: defineTable({
    submissionId: v.id("submissions"),
    userId: v.id("users"),
    text: v.string(),
    isAnonymous: v.optional(v.boolean()),
    revealOnRoundFinished: v.optional(v.boolean()),
    revealContentOnRoundFinished: v.optional(v.boolean()),
  }).index("by_submission", ["submissionId"]),

  notifications: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("new_comment"),
      v.literal("round_submission"),
      v.literal("round_voting"),
      v.literal("round_extension_poll"),
      v.literal("round_finished"),
    ),
    message: v.string(),
    link: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
    triggeringUserId: v.optional(v.id("users")),
    metadata: v.optional(notificationMetadataValidator),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_read", ["userId", "read"])
    .index("by_user_and_type", ["userId", "type"])
    .index("by_created_at", ["createdAt"]),

  roundResults: defineTable({
    roundId: v.id("rounds"),
    submissionId: v.id("submissions"),
    userId: v.id("users"),
    points: v.number(),
    isWinner: v.boolean(),
    penaltyApplied: v.optional(v.boolean()),
  })
    .index("by_round", ["roundId"])
    .index("by_submission", ["submissionId"])
    .index("by_round_and_winner", ["roundId", "isWinner"]),

  leagueStandings: defineTable({
    leagueId: v.id("leagues"),
    userId: v.id("users"),
    totalPoints: v.number(),
    totalWins: v.number(),
  })
    .index("by_league_and_user", ["leagueId", "userId"])
    .index("by_league_and_points", ["leagueId", "totalPoints"]),
  storageUploads: defineTable({
    key: v.string(),
    ownerUserId: v.id("users"),
    kind: storageUploadKindValidator,
    status: storageUploadStatusValidator,
    claimType: v.optional(storageUploadClaimTypeValidator),
    claimId: v.optional(v.string()),
    createdAt: v.number(),
    uploadedAt: v.optional(v.number()),
    claimedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    lastCheckedAt: v.optional(v.number()),
  })
    .index("by_key", ["key"])
    .index("by_owner", ["ownerUserId"])
    .index("by_status_and_created_at", ["status", "createdAt"]),
});
