import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { memberCounter, submissionCounter, voterCounter } from "./counters";
import { membershipsByUser, submissionsByUser, unreadNotifications } from "./aggregates";
import {
  buildSubmissionSearchText,
  normalizeSubmissionArtist,
  normalizeSubmissionSongTitle,
} from "../lib/convex-server/submissions/normalize";

const DEFAULT_NAMESPACE = "dev";
const MIN_FAKE_USERS = 4;
const MAX_FAKE_USERS = 30;
const MAX_LOCAL_ASSETS = 80;

const YOUTUBE_FALLBACK: Array<{
  title: string;
  artist: string;
  videoId: string;
  duration: number;
}> = [
  { title: "Dreams", artist: "Joakim Karud", videoId: "VfWvJ2KQ3y0", duration: 186 },
  { title: "Sunny", artist: "KODOMOi", videoId: "hB7C0TpmPuk", duration: 200 },
  { title: "Island", artist: "Jarico", videoId: "WZKW2Hq2fks", duration: 192 },
  { title: "Lioness", artist: "DayFox", videoId: "xAqUzRDPv9E", duration: 214 },
  { title: "Breeze", artist: "Ikson", videoId: "kS7FRfQ4n7w", duration: 208 },
  { title: "Better Days", artist: "LAKEY INSPIRED", videoId: "RXLzvo6kvVQ", duration: 225 },
  { title: "Call Me", artist: "LiQWYD", videoId: "F6YqL5JQXRU", duration: 198 },
];

const GENRES = [
  "indie",
  "electronic",
  "hip-hop",
  "alt",
  "house",
  "rock",
  "soul",
  "pop",
];

const COMMENT_BANK = [
  "This one keeps growing on me.",
  "Great pick for this round theme.",
  "Unexpected choice, but it works.",
  "The chorus hits hard.",
  "I could listen to this all day.",
  "Strong entry.",
  "This fits the brief perfectly.",
  "Very clean production on this.",
];

const LOCAL_ASSET_VALIDATOR = v.object({
  songTitle: v.string(),
  artist: v.string(),
  songFileKey: v.string(),
  albumArtKey: v.optional(v.string()),
  duration: v.optional(v.number()),
  comment: v.optional(v.string()),
  lyrics: v.optional(v.string()),
  waveform: v.optional(v.string()),
});

type SeedAsset =
  | {
      source: "file";
      songTitle: string;
      artist: string;
      songFileKey: string;
      albumArtKey?: string;
      duration: number;
      comment?: string;
      lyrics?: string;
      waveform?: string;
    }
  | {
      source: "youtube";
      songTitle: string;
      artist: string;
      songLink: string;
      albumArtUrlValue: string;
      duration: number;
      comment?: string;
    };

type VoteGenerationResult = {
  votesInserted: number;
  finalizedVoters: number;
};

function assertDevSeedEnabled() {
  if (process.env.NODE_ENV === "production" && process.env.DEV_SEED_ENABLED !== "true") {
    throw new Error(
      "Dev seeding is disabled in production. Set DEV_SEED_ENABLED=true only if you intentionally want this.",
    );
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeNamespace(namespace?: string) {
  const trimmed = (namespace ?? DEFAULT_NAMESPACE).trim().toLowerCase();
  const normalized = trimmed.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || DEFAULT_NAMESPACE;
}

function seedPrefix(namespace: string) {
  return `[DEV SEED ${namespace}]`;
}

function searchText(songTitle: string, artist: string) {
  return buildSubmissionSearchText(songTitle, artist);
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function ytUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function buildAssetPool(localAssets: Array<{
  songTitle: string;
  artist: string;
  songFileKey: string;
  albumArtKey?: string;
  duration?: number;
  comment?: string;
  lyrics?: string;
  waveform?: string;
}>): SeedAsset[] {
  const seededLocalAssets: SeedAsset[] = localAssets.map((asset) => ({
    source: "file",
    songTitle: asset.songTitle,
    artist: asset.artist,
    songFileKey: asset.songFileKey,
    albumArtKey: asset.albumArtKey,
    duration: Math.max(30, Math.floor(asset.duration ?? 180)),
    comment: asset.comment,
    lyrics: asset.lyrics,
    waveform: asset.waveform,
  }));

  const fallbackAssets: SeedAsset[] = YOUTUBE_FALLBACK.map((song) => ({
    source: "youtube",
    songTitle: song.title,
    artist: song.artist,
    songLink: ytUrl(song.videoId),
    albumArtUrlValue: `https://img.youtube.com/vi/${song.videoId}/hqdefault.jpg`,
    duration: song.duration,
    comment: "Seeded from YouTube fallback",
  }));

  if (seededLocalAssets.length === 0) {
    return fallbackAssets;
  }
  return [...seededLocalAssets, ...fallbackAssets];
}

async function ensureLeagueStanding(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
  userId: Id<"users">,
) {
  const existing = await ctx.db
    .query("leagueStandings")
    .withIndex("by_league_and_user", (q) => q.eq("leagueId", leagueId).eq("userId", userId))
    .first();
  if (existing) return;
  await ctx.db.insert("leagueStandings", {
    leagueId,
    userId,
    totalPoints: 0,
    totalWins: 0,
  });
}

async function ensureMembership(
  ctx: MutationCtx,
  args: {
    leagueId: Id<"leagues">;
    userId: Id<"users">;
    isSpectator?: boolean;
    joinDate: number;
  },
) {
  const existing = await ctx.db
    .query("memberships")
    .withIndex("by_league_and_user", (q) => q.eq("leagueId", args.leagueId).eq("userId", args.userId))
    .first();

  if (existing) {
    if (args.isSpectator !== undefined && existing.isSpectator !== args.isSpectator) {
      await ctx.db.patch("memberships", existing._id, { isSpectator: args.isSpectator });
    }
    await ensureLeagueStanding(ctx, args.leagueId, args.userId);
    return existing._id;
  }

  const membershipId = await ctx.db.insert("memberships", {
    leagueId: args.leagueId,
    userId: args.userId,
    joinDate: args.joinDate,
    isSpectator: args.isSpectator,
  });
  const membership = await ctx.db.get("memberships", membershipId);
  if (membership) {
    await membershipsByUser.insert(ctx, membership);
  }
  await memberCounter.inc(ctx, args.leagueId);
  await ensureLeagueStanding(ctx, args.leagueId, args.userId);
  return membershipId;
}

async function insertSubmission(
  ctx: MutationCtx,
  submission: Omit<Doc<"submissions">, "_id" | "_creationTime">,
) {
  const submissionId = await ctx.db.insert("submissions", submission);
  const doc = await ctx.db.get("submissions", submissionId);
  if (doc) {
    await submissionsByUser.insert(ctx, doc);
  }
  await submissionCounter.inc(ctx, submission.roundId);
  return submissionId;
}

async function insertNotification(
  ctx: MutationCtx,
  notification: {
    userId: Id<"users">;
    type: "new_comment" | "round_submission" | "round_voting" | "round_finished";
    message: string;
    link: string;
    triggeringUserId?: Id<"users">;
    namespace: string;
  },
) {
  const notificationId = await ctx.db.insert("notifications", {
    userId: notification.userId,
    type: notification.type,
    message: notification.message,
    link: notification.link,
    read: false,
    createdAt: Date.now(),
    triggeringUserId: notification.triggeringUserId,
    metadata: {
      seedNamespace: notification.namespace,
      source: "devSeed",
    },
  });
  const created = await ctx.db.get("notifications", notificationId);
  if (created) {
    await unreadNotifications.insert(ctx, created);
  }
  return notificationId;
}

async function seedComments(
  ctx: MutationCtx,
  args: {
    namespace: string;
    submissions: Doc<"submissions">[];
    users: Id<"users">[];
    leagueId: Id<"leagues">;
    roundId: Id<"rounds">;
    maxComments: number;
  },
) {
  let created = 0;
  const shuffledSubs = shuffle(args.submissions).slice(0, args.maxComments);
  for (const sub of shuffledSubs) {
    const commenters = args.users.filter((u) => u !== sub.userId);
    if (commenters.length === 0) continue;
    const commenter = pick(commenters);
    const text = pick(COMMENT_BANK);
    await ctx.db.insert("comments", {
      submissionId: sub._id,
      userId: commenter,
      text,
    });
    created += 1;

    await insertNotification(ctx, {
      userId: sub.userId,
      type: "new_comment",
      message: text,
      link: `/leagues/${args.leagueId}/round/${args.roundId}`,
      triggeringUserId: commenter,
      namespace: args.namespace,
    });
  }
  return created;
}

async function seedBookmarks(
  ctx: MutationCtx,
  users: Id<"users">[],
  submissions: Doc<"submissions">[],
) {
  let created = 0;
  for (const userId of users) {
    const options = shuffle(submissions.filter((s) => s.userId !== userId)).slice(0, 2);
    for (const sub of options) {
      const existing = await ctx.db
        .query("bookmarks")
        .withIndex("by_user_and_submission", (q) => q.eq("userId", userId).eq("submissionId", sub._id))
        .first();
      if (existing) continue;
      await ctx.db.insert("bookmarks", {
        userId,
        submissionId: sub._id,
      });
      created += 1;
    }
  }
  return created;
}

async function seedListenProgress(
  ctx: MutationCtx,
  args: {
    users: Id<"users">[];
    submissions: Doc<"submissions">[];
    league: Doc<"leagues">;
    completionBias: number;
  },
) {
  let created = 0;
  const listenPct = clamp(args.league.listenPercentage ?? 50, 10, 100) / 100;
  const maxSeconds = Math.max(60, (args.league.listenTimeLimitMinutes ?? 8) * 60);

  for (const userId of args.users) {
    const targets = args.submissions.filter((s) => s.userId !== userId);
    for (const submission of targets) {
      const duration = Math.max(30, submission.duration ?? 180);
      const required = Math.ceil(Math.min(duration * listenPct, maxSeconds));
      const completed = Math.random() < args.completionBias;
      const progressSeconds = completed
        ? required
        : Math.max(5, Math.floor(required * (0.15 + Math.random() * 0.45)));

      const existing = await ctx.db
        .query("listenProgress")
        .withIndex("by_user_and_submission", (q) =>
          q.eq("userId", userId).eq("submissionId", submission._id),
        )
        .first();

      if (existing) {
        await ctx.db.patch("listenProgress", existing._id, {
          roundId: submission.roundId,
          progressSeconds,
          isCompleted: completed,
        });
      } else {
        await ctx.db.insert("listenProgress", {
          userId,
          submissionId: submission._id,
          roundId: submission.roundId,
          progressSeconds,
          isCompleted: completed,
        });
        created += 1;
      }
    }
  }

  return created;
}

async function seedVotes(
  ctx: MutationCtx,
  args: {
    roundId: Id<"rounds">;
    league: Doc<"leagues">;
    submissions: Doc<"submissions">[];
    voters: Id<"users">[];
    finalizeRatio: number;
  },
): Promise<VoteGenerationResult> {
  const maxUp = clamp(args.league.maxPositiveVotes, 1, 10);
  const maxDown = clamp(args.league.maxNegativeVotes, 0, 5);
  let votesInserted = 0;
  let finalizedVoters = 0;

  for (const voterId of args.voters) {
    const choices = shuffle(args.submissions.filter((s) => s.userId !== voterId));
    if (choices.length === 0) continue;

    const shouldFinalize = Math.random() < args.finalizeRatio;
    const upBudget = shouldFinalize ? maxUp : Math.max(1, maxUp - 1);
    const downBudget = shouldFinalize ? maxDown : Math.max(0, maxDown - 1);

    let cursor = 0;
    for (let i = 0; i < upBudget && cursor < choices.length; i++, cursor++) {
      await ctx.db.insert("votes", {
        roundId: args.roundId,
        submissionId: choices[cursor]._id,
        userId: voterId,
        vote: 1,
      });
      votesInserted += 1;
    }

    for (let i = 0; i < downBudget && cursor < choices.length; i++, cursor++) {
      await ctx.db.insert("votes", {
        roundId: args.roundId,
        submissionId: choices[cursor]._id,
        userId: voterId,
        vote: -1,
      });
      votesInserted += 1;
    }

    if (shouldFinalize) {
      await voterCounter.inc(ctx, args.roundId);
      finalizedVoters += 1;
    }
  }

  return { votesInserted, finalizedVoters };
}

async function clearNamespaceInternal(
  ctx: MutationCtx,
  namespaceRaw: string,
) {
  const namespace = normalizeNamespace(namespaceRaw);
  const prefix = seedPrefix(namespace);
  const leagues = (await ctx.db.query("leagues").collect()).filter((league) =>
    league.name.startsWith(prefix),
  );
  if (leagues.length === 0) {
    return {
      namespace,
      leaguesDeleted: 0,
      roundsDeleted: 0,
      submissionsDeleted: 0,
      usersDeleted: 0,
    };
  }

  const roundIds = new Set<string>();
  const submissionIds = new Set<string>();
  let roundsDeleted = 0;
  let submissionsDeleted = 0;

  for (const league of leagues) {
    const rounds = await ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", league._id))
      .collect();
    for (const round of rounds) {
      roundIds.add(round._id.toString());
    }
  }

  const allListenProgress = await ctx.db.query("listenProgress").collect();
  const allNotifications = await ctx.db.query("notifications").collect();

  for (const league of leagues) {
    const rounds = await ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", league._id))
      .collect();

    for (const round of rounds) {
      const submissions = await ctx.db
        .query("submissions")
        .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
        .collect();
      const votes = await ctx.db
        .query("votes")
        .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
        .collect();
      const results = await ctx.db
        .query("roundResults")
        .withIndex("by_round", (q) => q.eq("roundId", round._id))
        .collect();

      for (const vote of votes) {
        await ctx.db.delete("votes", vote._id);
      }
      for (const result of results) {
        await ctx.db.delete("roundResults", result._id);
      }

      for (const submission of submissions) {
        submissionIds.add(submission._id.toString());
        const comments = await ctx.db
          .query("comments")
          .withIndex("by_submission", (q) => q.eq("submissionId", submission._id))
          .collect();
        const bookmarks = await ctx.db
          .query("bookmarks")
          .withIndex("by_submission", (q) => q.eq("submissionId", submission._id))
          .collect();

        for (const comment of comments) {
          await ctx.db.delete("comments", comment._id);
        }
        for (const bookmark of bookmarks) {
          await ctx.db.delete("bookmarks", bookmark._id);
        }

        await submissionsByUser.delete(ctx, submission);
        await ctx.db.delete("submissions", submission._id);
        submissionsDeleted += 1;
        try {
          await submissionCounter.dec(ctx, round._id);
        } catch {
          // Ignore counter underflow in reset paths.
        }
      }

      await ctx.db.delete("rounds", round._id);
      roundsDeleted += 1;
    }

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", league._id))
      .collect();
    const standings = await ctx.db
      .query("leagueStandings")
      .withIndex("by_league_and_points", (q) => q.eq("leagueId", league._id))
      .collect();
    const leagueStats = await ctx.db
      .query("leagueStats")
      .withIndex("by_league", (q) => q.eq("leagueId", league._id))
      .collect();

    for (const membership of memberships) {
      await membershipsByUser.delete(ctx, membership);
      await ctx.db.delete("memberships", membership._id);
      try {
        await memberCounter.dec(ctx, league._id);
      } catch {
        // Ignore counter underflow in reset paths.
      }
    }
    for (const standing of standings) {
      await ctx.db.delete("leagueStandings", standing._id);
    }
    for (const stat of leagueStats) {
      await ctx.db.delete("leagueStats", stat._id);
    }
    await ctx.db.delete("leagues", league._id);
  }

  for (const progress of allListenProgress) {
    if (submissionIds.has(progress.submissionId.toString())) {
      await ctx.db.delete("listenProgress", progress._id);
    }
  }

  for (const notification of allNotifications) {
    const metadata = notification.metadata as { seedNamespace?: string } | undefined;
    if (metadata?.seedNamespace !== namespace) continue;
    if (!notification.read) {
      await unreadNotifications.delete(ctx, notification);
    }
    await ctx.db.delete("notifications", notification._id);
  }

  const users = await ctx.db.query("users").collect();
  for (const user of users) {
    if (!user.presence) continue;
    const hasDeletedRound = user.presence.roundId
      ? roundIds.has(user.presence.roundId.toString())
      : false;
    const hasDeletedSubmission = user.presence.location
      ? submissionIds.has(user.presence.location.toString())
      : false;
    if (hasDeletedRound || hasDeletedSubmission) {
      await ctx.db.patch("users", user._id, { presence: undefined });
    }
  }

  const fakeEmailPrefix = `dev-seed+${namespace}-`;
  const fakeUsers = users.filter((u) => (u.email ?? "").startsWith(fakeEmailPrefix));
  let usersDeleted = 0;
  for (const fake of fakeUsers) {
    const remainingMemberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", fake._id))
      .collect();
    if (remainingMemberships.length > 0) continue;
    const pushSubscriptions = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", fake._id))
      .collect();
    for (const sub of pushSubscriptions) {
      await ctx.db.delete("pushSubscriptions", sub._id);
    }
    await ctx.db.delete("users", fake._id);
    usersDeleted += 1;
  }

  return {
    namespace,
    leaguesDeleted: leagues.length,
    roundsDeleted,
    submissionsDeleted,
    usersDeleted,
  };
}

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    assertDevSeedEnabled();
    const users = await ctx.db.query("users").collect();
    return users
      .map((user) => ({
        id: user._id,
        name: user.name ?? "Anonymous",
        email: user.email ?? null,
        isGlobalAdmin: user.isGlobalAdmin ?? false,
        createdAt: user._creationTime,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const resetNamespace = mutation({
  args: {
    namespace: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertDevSeedEnabled();
    return await clearNamespaceInternal(ctx, args.namespace ?? DEFAULT_NAMESPACE);
  },
});

export const seedNamespace = mutation({
  args: {
    namespace: v.optional(v.string()),
    cleanupFirst: v.optional(v.boolean()),
    fakeUsers: v.optional(v.number()),
    includeUserIds: v.optional(v.array(v.id("users"))),
    includeUserEmails: v.optional(v.array(v.string())),
    localAssets: v.optional(v.array(LOCAL_ASSET_VALIDATOR)),
    simulateActivity: v.optional(v.boolean()),
    simulationTicks: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertDevSeedEnabled();
    const namespace = normalizeNamespace(args.namespace);
    const prefix = seedPrefix(namespace);
    const now = Date.now();

    if (args.cleanupFirst ?? true) {
      await clearNamespaceInternal(ctx, namespace);
    }

    const fakeUserCount = clamp(
      Math.floor(args.fakeUsers ?? 8),
      MIN_FAKE_USERS,
      MAX_FAKE_USERS,
    );

    const includedUserIds = new Set<string>();
    const includedUsers: Id<"users">[] = [];

    for (const userId of args.includeUserIds ?? []) {
      const user = await ctx.db.get("users", userId);
      if (!user) continue;
      includedUserIds.add(userId.toString());
      includedUsers.push(userId);
    }

    for (const email of args.includeUserEmails ?? []) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();
      if (!user) continue;
      if (includedUserIds.has(user._id.toString())) continue;
      includedUserIds.add(user._id.toString());
      includedUsers.push(user._id);
    }

    const fakeUsers: Id<"users">[] = [];
    for (let i = 0; i < fakeUserCount; i++) {
      const email = `dev-seed+${namespace}-${i + 1}@local.test`;
      const existing = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();
      if (existing) {
        fakeUsers.push(existing._id);
        continue;
      }
      const userId = await ctx.db.insert("users", {
        name: `${prefix} User ${i + 1}`,
        email,
        image: undefined,
      } as Partial<Doc<"users">> as Doc<"users">);
      fakeUsers.push(userId);
    }

    const allUsers = [...includedUsers, ...fakeUsers];
    const uniqueUsers: Id<"users">[] = [];
    const seen = new Set<string>();
    for (const userId of allUsers) {
      if (seen.has(userId.toString())) continue;
      seen.add(userId.toString());
      uniqueUsers.push(userId);
    }
    if (uniqueUsers.length < 3) {
      throw new Error("Need at least 3 users to generate useful seed data.");
    }

    const creatorId = uniqueUsers[0];
    const managerId = uniqueUsers[1];
    const spectatorId = uniqueUsers[uniqueUsers.length - 1];
    const activeUsers = uniqueUsers.filter((u) => u !== spectatorId);

    const leagueDefaults = {
      description: `${prefix} seeded league`,
      isPublic: true,
      creatorId,
      submissionDeadline: now + 24 * 60 * 60 * 1000,
      votingDeadline: now + 48 * 60 * 60 * 1000,
      maxPositiveVotes: 3,
      maxNegativeVotes: 1,
      inviteCode: null as string | null,
      managers: [creatorId, managerId],
      enforceListenPercentage: true,
      listenPercentage: 60,
      listenTimeLimitMinutes: 8,
      limitVotesPerSubmission: true,
      maxPositiveVotesPerSubmission: 2,
      maxNegativeVotesPerSubmission: 1,
    };

    const leagueOpen = await ctx.db.insert("leagues", {
      ...leagueDefaults,
      name: `${prefix} Open Submissions`,
      description: "Round is open for submissions with mixed file/YouTube songs.",
    });
    const leagueVoting = await ctx.db.insert("leagues", {
      ...leagueDefaults,
      name: `${prefix} Voting Playground`,
      description: "Round is in voting with partial and completed listening progress.",
    });
    const leagueFinished = await ctx.db.insert("leagues", {
      ...leagueDefaults,
      name: `${prefix} Finished Archive`,
      description: "Finished round with standings, penalties, and stats.",
    });

    const seededLeagues = [leagueOpen, leagueVoting, leagueFinished];

    for (const leagueId of seededLeagues) {
      for (const userId of uniqueUsers) {
        await ensureMembership(ctx, {
          leagueId,
          userId,
          joinDate: now - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000),
          isSpectator: leagueId === leagueOpen && userId === spectatorId,
        });
      }
    }

    const roundOpen = await ctx.db.insert("rounds", {
      leagueId: leagueOpen,
      title: `${prefix} Open Round`,
      description: "Test submission flow, duplicate checks, and draft edits.",
      imageKey: undefined,
      genres: [pick(GENRES), pick(GENRES)],
      status: "submissions",
      submissionDeadline: now + 48 * 60 * 60 * 1000,
      votingDeadline: now + 96 * 60 * 60 * 1000,
      submissionsPerUser: 1,
      submissionMode: "single",
      submissionInstructions: "Upload a file or share a YouTube song.",
    });

    const roundVoting = await ctx.db.insert("rounds", {
      leagueId: leagueVoting,
      title: `${prefix} Voting Round`,
      description: "Test voting limits, listen gating, comments, and presence.",
      imageKey: undefined,
      genres: [pick(GENRES), pick(GENRES)],
      status: "voting",
      submissionDeadline: now - 36 * 60 * 60 * 1000,
      votingDeadline: now + 30 * 60 * 60 * 1000,
      submissionsPerUser: 2,
      submissionMode: "multi",
      submissionInstructions: "Submit a short 2-song collection.",
    });

    const roundFinished = await ctx.db.insert("rounds", {
      leagueId: leagueFinished,
      title: `${prefix} Finished Round`,
      description: "Test results, standings, stats, troll penalties, and bans.",
      imageKey: undefined,
      genres: [pick(GENRES), pick(GENRES), pick(GENRES)],
      status: "finished",
      submissionDeadline: now - 7 * 24 * 60 * 60 * 1000,
      votingDeadline: now - 4 * 24 * 60 * 60 * 1000,
      submissionsPerUser: 1,
      submissionMode: "album",
      submissionInstructions: "Submit a mini album with 3 tracks.",
      albumConfig: {
        allowPartial: false,
        requireReleaseYear: true,
        minTracks: 3,
        maxTracks: 3,
      },
    });

    const assetPool = buildAssetPool((args.localAssets ?? []).slice(0, MAX_LOCAL_ASSETS));
    let assetCursor = 0;
    const nextAsset = () => {
      const asset = assetPool[assetCursor % assetPool.length];
      assetCursor += 1;
      return asset;
    };

    const createdSubmissionIds: Id<"submissions">[] = [];
    let fileSubmissionCount = 0;
    let youtubeSubmissionCount = 0;

    const openSubmitters = activeUsers.slice(0, Math.min(activeUsers.length, 5));
    for (const userId of openSubmitters) {
      const asset = nextAsset();
      const submissionPayload: Omit<Doc<"submissions">, "_id" | "_creationTime"> =
        asset.source === "file"
          ? {
              leagueId: leagueOpen,
              roundId: roundOpen,
              userId,
              songTitle: asset.songTitle,
              artist: asset.artist,
              albumArtKey: asset.albumArtKey,
              songFileKey: asset.songFileKey,
              comment: asset.comment ?? "Local file seed submission",
              submissionType: "file",
              albumArtUrlValue: undefined,
              songLink: undefined,
              waveform: asset.waveform,
              duration: asset.duration,
              searchText: searchText(asset.songTitle, asset.artist),
              normalizedSongTitle: normalizeSubmissionSongTitle(asset.songTitle),
              normalizedArtist: normalizeSubmissionArtist(asset.artist),
              isTrollSubmission: false,
              lyrics: asset.lyrics,
            }
          : {
              leagueId: leagueOpen,
              roundId: roundOpen,
              userId,
              songTitle: asset.songTitle,
              artist: asset.artist,
              albumArtKey: undefined,
              songFileKey: undefined,
              comment: asset.comment ?? "YouTube fallback seed submission",
              submissionType: "youtube",
              albumArtUrlValue: asset.albumArtUrlValue,
              songLink: asset.songLink,
              waveform: undefined,
              duration: asset.duration,
              searchText: searchText(asset.songTitle, asset.artist),
              normalizedSongTitle: normalizeSubmissionSongTitle(asset.songTitle),
              normalizedArtist: normalizeSubmissionArtist(asset.artist),
              isTrollSubmission: false,
              lyrics: undefined,
            };

      const submissionId = await insertSubmission(ctx, submissionPayload);
      createdSubmissionIds.push(submissionId);
      if (asset.source === "file") fileSubmissionCount += 1;
      else youtubeSubmissionCount += 1;
    }

    const votingSubmitters = activeUsers.slice(0, Math.min(activeUsers.length, 6));
    for (const userId of votingSubmitters) {
      const collectionId = `${namespace}-multi-${userId.toString()}`;
      for (let trackNumber = 1; trackNumber <= 2; trackNumber++) {
        const asset = nextAsset();
        const submissionPayload: Omit<Doc<"submissions">, "_id" | "_creationTime"> =
          asset.source === "file"
            ? {
                leagueId: leagueVoting,
                roundId: roundVoting,
                userId,
                songTitle: asset.songTitle,
                artist: asset.artist,
                albumArtKey: asset.albumArtKey,
                songFileKey: asset.songFileKey,
                comment: asset.comment ?? "Voting seed submission",
                submissionType: "file",
                albumArtUrlValue: undefined,
                songLink: undefined,
                waveform: asset.waveform,
                duration: asset.duration,
                searchText: searchText(asset.songTitle, asset.artist),
                normalizedSongTitle: normalizeSubmissionSongTitle(asset.songTitle),
                normalizedArtist: normalizeSubmissionArtist(asset.artist),
                isTrollSubmission: false,
                lyrics: asset.lyrics,
                collectionId,
                collectionType: "multi",
                collectionName: `${prefix} Multi Set`,
                collectionArtist: asset.artist,
                collectionNotes: "Two-track collection for voting",
                collectionTotalTracks: 2,
                trackNumber,
              }
            : {
                leagueId: leagueVoting,
                roundId: roundVoting,
                userId,
                songTitle: asset.songTitle,
                artist: asset.artist,
                albumArtKey: undefined,
                songFileKey: undefined,
                comment: asset.comment ?? "Voting YouTube fallback",
                submissionType: "youtube",
                albumArtUrlValue: asset.albumArtUrlValue,
                songLink: asset.songLink,
                waveform: undefined,
                duration: asset.duration,
                searchText: searchText(asset.songTitle, asset.artist),
                normalizedSongTitle: normalizeSubmissionSongTitle(asset.songTitle),
                normalizedArtist: normalizeSubmissionArtist(asset.artist),
                isTrollSubmission: false,
                lyrics: undefined,
                collectionId,
                collectionType: "multi",
                collectionName: `${prefix} Multi Set`,
                collectionArtist: asset.artist,
                collectionNotes: "Two-track collection for voting",
                collectionTotalTracks: 2,
                trackNumber,
              };

        const submissionId = await insertSubmission(ctx, submissionPayload);
        createdSubmissionIds.push(submissionId);
        if (asset.source === "file") fileSubmissionCount += 1;
        else youtubeSubmissionCount += 1;
      }
    }

    const finishedSubmitters = activeUsers.slice(0, Math.min(activeUsers.length, 5));
    for (const userId of finishedSubmitters) {
      const collectionId = `${namespace}-album-${userId.toString()}`;
      const releaseYear = 1995 + Math.floor(Math.random() * 30);
      for (let trackNumber = 1; trackNumber <= 3; trackNumber++) {
        const asset = nextAsset();
        const submissionPayload: Omit<Doc<"submissions">, "_id" | "_creationTime"> =
          asset.source === "file"
            ? {
                leagueId: leagueFinished,
                roundId: roundFinished,
                userId,
                songTitle: asset.songTitle,
                artist: asset.artist,
                albumArtKey: asset.albumArtKey,
                songFileKey: asset.songFileKey,
                comment: asset.comment ?? "Finished round seeded album track",
                submissionType: "file",
                albumArtUrlValue: undefined,
                songLink: undefined,
                waveform: asset.waveform,
                duration: asset.duration,
                searchText: searchText(asset.songTitle, asset.artist),
                normalizedSongTitle: normalizeSubmissionSongTitle(asset.songTitle),
                normalizedArtist: normalizeSubmissionArtist(asset.artist),
                isTrollSubmission: false,
                lyrics: asset.lyrics,
                collectionId,
                collectionType: "album",
                collectionName: `${prefix} Album ${userId.toString().slice(-4)}`,
                collectionArtist: asset.artist,
                collectionNotes: "Album-mode seeded data",
                collectionReleaseYear: releaseYear,
                collectionTotalTracks: 3,
                trackNumber,
              }
            : {
                leagueId: leagueFinished,
                roundId: roundFinished,
                userId,
                songTitle: asset.songTitle,
                artist: asset.artist,
                albumArtKey: undefined,
                songFileKey: undefined,
                comment: asset.comment ?? "Finished round YouTube fallback",
                submissionType: "youtube",
                albumArtUrlValue: asset.albumArtUrlValue,
                songLink: asset.songLink,
                waveform: undefined,
                duration: asset.duration,
                searchText: searchText(asset.songTitle, asset.artist),
                normalizedSongTitle: normalizeSubmissionSongTitle(asset.songTitle),
                normalizedArtist: normalizeSubmissionArtist(asset.artist),
                isTrollSubmission: false,
                lyrics: undefined,
                collectionId,
                collectionType: "album",
                collectionName: `${prefix} Album ${userId.toString().slice(-4)}`,
                collectionArtist: asset.artist,
                collectionNotes: "Album-mode seeded data",
                collectionReleaseYear: releaseYear,
                collectionTotalTracks: 3,
                trackNumber,
              };

        const submissionId = await insertSubmission(ctx, submissionPayload);
        createdSubmissionIds.push(submissionId);
        if (asset.source === "file") fileSubmissionCount += 1;
        else youtubeSubmissionCount += 1;
      }
    }

    const openSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", roundOpen))
      .collect();
    const votingSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", roundVoting))
      .collect();
    const finishedSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", roundFinished))
      .collect();

    const votingLeagueDoc = await ctx.db.get("leagues", leagueVoting);
    const finishedLeagueDoc = await ctx.db.get("leagues", leagueFinished);
    if (!votingLeagueDoc || !finishedLeagueDoc) {
      throw new Error("Failed to load seeded leagues.");
    }

    const votingProgressRows = await seedListenProgress(ctx, {
      users: votingSubmitters,
      submissions: votingSubmissions,
      league: votingLeagueDoc,
      completionBias: 0.65,
    });

    const votingVotes = await seedVotes(ctx, {
      roundId: roundVoting,
      league: votingLeagueDoc,
      submissions: votingSubmissions,
      voters: votingSubmitters,
      finalizeRatio: 0.55,
    });

    const finishedProgressRows = await seedListenProgress(ctx, {
      users: finishedSubmitters,
      submissions: finishedSubmissions,
      league: finishedLeagueDoc,
      completionBias: 0.9,
    });

    const finishedVotes = await seedVotes(ctx, {
      roundId: roundFinished,
      league: finishedLeagueDoc,
      submissions: finishedSubmissions,
      voters: finishedSubmitters,
      finalizeRatio: 1,
    });

    const trollTargetUser = finishedSubmitters[0];
    const trollTargets = finishedSubmissions
      .filter((submission) => submission.userId === trollTargetUser)
      .slice(0, 2);
    for (const trollSubmission of trollTargets) {
      await ctx.db.patch("submissions", trollSubmission._id, {
        isTrollSubmission: true,
        markedAsTrollBy: creatorId,
        markedAsTrollAt: now,
      });
    }
    const trollMembership = await ctx.db
      .query("memberships")
      .withIndex("by_league_and_user", (q) =>
        q.eq("leagueId", leagueFinished).eq("userId", trollTargetUser),
      )
      .first();
    if (trollMembership) {
      await ctx.db.patch("memberships", trollMembership._id, {
        trollSubmissionCount: trollTargets.length,
        isBanned: trollTargets.length >= 2,
        bannedAt: trollTargets.length >= 2 ? now : undefined,
      });
    }

    const openComments = await seedComments(ctx, {
      namespace,
      submissions: openSubmissions,
      users: openSubmitters,
      leagueId: leagueOpen,
      roundId: roundOpen,
      maxComments: 4,
    });
    const votingComments = await seedComments(ctx, {
      namespace,
      submissions: votingSubmissions,
      users: votingSubmitters,
      leagueId: leagueVoting,
      roundId: roundVoting,
      maxComments: 8,
    });
    const finishedComments = await seedComments(ctx, {
      namespace,
      submissions: finishedSubmissions,
      users: finishedSubmitters,
      leagueId: leagueFinished,
      roundId: roundFinished,
      maxComments: 10,
    });

    const bookmarked = await seedBookmarks(
      ctx,
      includedUsers.length > 0 ? includedUsers : activeUsers.slice(0, 2),
      [...openSubmissions, ...votingSubmissions, ...finishedSubmissions],
    );

    for (const userId of activeUsers.slice(0, 3)) {
      const location = pick(votingSubmissions)?._id ?? null;
      if (!location) continue;
      await ctx.db.patch("users", userId, {
        presence: {
          location,
          roundId: roundVoting,
          updated: now,
          data: { source: "devSeed" },
        },
      });
    }

    const allNotificationUsers = includedUsers.length > 0 ? includedUsers : activeUsers.slice(0, 2);
    let extraNotifications = 0;
    for (const userId of allNotificationUsers) {
      await insertNotification(ctx, {
        userId,
        type: "round_submission",
        message: `Seeded round "${prefix} Open Round" is open for submissions.`,
        link: `/leagues/${leagueOpen}/round/${roundOpen}`,
        triggeringUserId: creatorId,
        namespace,
      });
      await insertNotification(ctx, {
        userId,
        type: "round_voting",
        message: `Seeded round "${prefix} Voting Round" is live for voting.`,
        link: `/leagues/${leagueVoting}/round/${roundVoting}`,
        triggeringUserId: managerId,
        namespace,
      });
      await insertNotification(ctx, {
        userId,
        type: "round_finished",
        message: `Seeded round "${prefix} Finished Round" has results ready.`,
        link: `/leagues/${leagueFinished}/round/${roundFinished}`,
        triggeringUserId: managerId,
        namespace,
      });
      extraNotifications += 3;
    }

    await ctx.scheduler.runAfter(0, internal.leagues.calculateAndStoreResults, {
      roundId: roundFinished,
    });
    await ctx.scheduler.runAfter(0, internal.leagues.updateLeagueStats, {
      leagueId: leagueFinished,
    });

    let simulationSummary:
      | {
          ticks: number;
          commentsCreated: number;
          bookmarksCreated: number;
          listenRowsCreated: number;
          notificationsCreated: number;
          votesCreated: number;
        }
      | null = null;

    if (args.simulateActivity ?? true) {
      simulationSummary = await simulateNamespaceInternal(
        ctx,
        namespace,
        clamp(Math.floor(args.simulationTicks ?? 2), 1, 25),
      );
    }

    return {
      namespace,
      leaguesCreated: seededLeagues.length,
      roundsCreated: 3,
      usersInPool: uniqueUsers.length,
      includedUsers: includedUsers.length,
      fakeUsers: fakeUsers.length,
      submissionsCreated: createdSubmissionIds.length,
      fileSubmissions: fileSubmissionCount,
      youtubeSubmissions: youtubeSubmissionCount,
      votesCreated: votingVotes.votesInserted + finishedVotes.votesInserted,
      finalizedVoters: votingVotes.finalizedVoters + finishedVotes.finalizedVoters,
      listenProgressRows: votingProgressRows + finishedProgressRows,
      commentsCreated: openComments + votingComments + finishedComments,
      bookmarksCreated: bookmarked,
      notificationsCreated: extraNotifications,
      simulated: simulationSummary,
      leagues: {
        open: leagueOpen,
        voting: leagueVoting,
        finished: leagueFinished,
      },
      rounds: {
        open: roundOpen,
        voting: roundVoting,
        finished: roundFinished,
      },
    };
  },
});

async function simulateNamespaceInternal(
  ctx: MutationCtx,
  namespaceRaw: string,
  ticksRaw: number,
) {
  const namespace = normalizeNamespace(namespaceRaw);
  const prefix = seedPrefix(namespace);
  const ticks = clamp(Math.floor(ticksRaw), 1, 100);
  const leagues = (await ctx.db.query("leagues").collect()).filter((league) =>
    league.name.startsWith(prefix),
  );

  let commentsCreated = 0;
  let bookmarksCreated = 0;
  let listenRowsCreated = 0;
  let notificationsCreated = 0;
  let votesCreated = 0;

  for (let tick = 0; tick < ticks; tick++) {
    for (const league of leagues) {
      const rounds = await ctx.db
        .query("rounds")
        .withIndex("by_league", (q) => q.eq("leagueId", league._id))
        .collect();
      if (rounds.length === 0) continue;
      const preferredRound =
        rounds.find((r) => r.status === "voting") ??
        rounds.find((r) => r.status === "submissions") ??
        rounds[0];
      if (!preferredRound) continue;

      const memberships = await ctx.db
        .query("memberships")
        .withIndex("by_league", (q) => q.eq("leagueId", league._id))
        .collect();
      const actors = memberships.filter((m) => !m.isSpectator).map((m) => m.userId);
      if (actors.length < 2) continue;

      const submissions = await ctx.db
        .query("submissions")
        .withIndex("by_round_and_user", (q) => q.eq("roundId", preferredRound._id))
        .collect();
      if (submissions.length === 0) continue;

      const actor = pick(actors);
      const targetCandidates = submissions.filter((s) => s.userId !== actor);
      if (targetCandidates.length === 0) continue;
      const target = pick(targetCandidates);

      const text = pick(COMMENT_BANK);
      await ctx.db.insert("comments", {
        submissionId: target._id,
        userId: actor,
        text,
      });
      commentsCreated += 1;

      await insertNotification(ctx, {
        userId: target.userId,
        type: "new_comment",
        message: text,
        link: `/leagues/${league._id}/round/${preferredRound._id}`,
        triggeringUserId: actor,
        namespace,
      });
      notificationsCreated += 1;

      const existingBookmark = await ctx.db
        .query("bookmarks")
        .withIndex("by_user_and_submission", (q) => q.eq("userId", actor).eq("submissionId", target._id))
        .first();
      if (!existingBookmark) {
        await ctx.db.insert("bookmarks", {
          userId: actor,
          submissionId: target._id,
        });
        bookmarksCreated += 1;
      }

      const duration = Math.max(30, target.duration ?? 180);
      const required = Math.ceil(
        Math.min(
          duration * clamp((league.listenPercentage ?? 60) / 100, 0.1, 1),
          Math.max(60, (league.listenTimeLimitMinutes ?? 8) * 60),
        ),
      );
      const existingProgress = await ctx.db
        .query("listenProgress")
        .withIndex("by_user_and_submission", (q) => q.eq("userId", actor).eq("submissionId", target._id))
        .first();
      if (existingProgress) {
        await ctx.db.patch("listenProgress", existingProgress._id, {
          roundId: preferredRound._id,
          progressSeconds: Math.max(existingProgress.progressSeconds, required),
          isCompleted: true,
        });
      } else {
        await ctx.db.insert("listenProgress", {
          userId: actor,
          submissionId: target._id,
          roundId: preferredRound._id,
          progressSeconds: required,
          isCompleted: true,
        });
        listenRowsCreated += 1;
      }

      await ctx.db.patch("users", actor, {
        presence: {
          location: target._id,
          roundId: preferredRound._id,
          updated: Date.now(),
          data: { source: "devSeedSimulation", tick },
        },
      });

      if (preferredRound.status === "voting") {
        const existingVote = await ctx.db
          .query("votes")
          .withIndex("by_submission_and_user", (q) =>
            q.eq("submissionId", target._id).eq("userId", actor),
          )
          .first();
        if (!existingVote) {
          const voteValue = Math.random() < 0.75 ? 1 : -1;
          await ctx.db.insert("votes", {
            roundId: preferredRound._id,
            submissionId: target._id,
            userId: actor,
            vote: voteValue,
          });
          votesCreated += 1;
        }
      }
    }
  }

  return {
    ticks,
    commentsCreated,
    bookmarksCreated,
    listenRowsCreated,
    notificationsCreated,
    votesCreated,
  };
}

export const simulateNamespace = mutation({
  args: {
    namespace: v.optional(v.string()),
    ticks: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertDevSeedEnabled();
    return await simulateNamespaceInternal(
      ctx,
      args.namespace ?? DEFAULT_NAMESPACE,
      args.ticks ?? 1,
    );
  },
});
