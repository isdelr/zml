// convex/adminSeed.ts
import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { Id, Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  buildSubmissionSearchText,
  normalizeSubmissionArtist,
  normalizeSubmissionSongTitle,
} from "../lib/convex-server/submissions/normalize";

// Utility: simple random picker
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Some safe, license-free YouTube IDs (public music channels / royalty-free)
const YT_SONGS: { title: string; artist: string; videoId: string; duration: number }[] = [
  { title: "Dreams", artist: "Joakim Karud", videoId: "VfWvJ2KQ3y0", duration: 186 },
  { title: "Sunny", artist: "KODOMOi", videoId: "hB7C0TpmPuk", duration: 200 },
  { title: "Island", artist: "Jarico", videoId: "WZKW2Hq2fks", duration: 192 },
  { title: "DayFox - Lioness", artist: "DayFox", videoId: "xAqUzRDPv9E", duration: 214 },
  { title: "Ikson - Breeze", artist: "Ikson", videoId: "kS7FRfQ4n7w", duration: 208 },
  { title: "LAKEY INSPIRED - Better Days", artist: "LAKEY INSPIRED", videoId: "RXLzvo6kvVQ", duration: 225 },
  { title: "LiQWYD - Call Me", artist: "LiQWYD", videoId: "F6YqL5JQXRU", duration: 198 },
];

function ytUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}

export const seed = mutation({
  args: {
    namespace: v.optional(v.string()),
    users: v.optional(v.number()),
    cleanupFirst: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminUserId = await getAuthUserId(ctx);
    if (!adminUserId) throw new Error("Not authenticated.");
    const adminUser = await ctx.db.get("users", adminUserId);
    if (!adminUser?.isGlobalAdmin) throw new Error("Admin only.");

    const ns = (args.namespace ?? "default").trim();
    const prefix = `[SEED ${ns}]`;

    if (args.cleanupFirst) {
      await ctx.scheduler.runAfter(0, internal.adminSeed._resetInternal, { namespace: ns });
    }

    await ctx.scheduler.runAfter(0, internal.adminSeed._seedInternal, {
      adminUserId,
      namespace: ns,
      userCount: Math.max(2, Math.min(20, args.users ?? 6)),
      prefix,
    });

    return { ok: true, message: `Seeding scheduled for namespace ${ns}` };
  },
});

export const reset = mutation({
  args: { namespace: v.string() },
  handler: async (ctx, { namespace }) => {
    const adminUserId = await getAuthUserId(ctx);
    if (!adminUserId) throw new Error("Not authenticated.");
    const adminUser = await ctx.db.get("users", adminUserId);
    if (!adminUser?.isGlobalAdmin) throw new Error("Admin only.");
    await ctx.scheduler.runAfter(0, internal.adminSeed._resetInternal, { namespace });
    return { ok: true };
  },
});

// Internal worker actually writing the data
export const _seedInternal = internalMutation({
  args: {
    adminUserId: v.id("users"),
    namespace: v.string(),
    userCount: v.number(),
    prefix: v.string(),
  },
  handler: async (ctx, { adminUserId, userCount, prefix }) => {
    const now = Date.now();

    // Create or reuse fake users for this namespace
    const makeUserName = (i: number) => `${prefix} Tester ${i + 1}`;

    // Try to find existing fake users (by name prefix)
    const existingUsers = await ctx.db.query("users").collect();
    const nsUsers = existingUsers.filter((u) => (u.name ?? "").startsWith(prefix));

    const users: Id<"users">[] = [];
    for (let i = 0; i < userCount; i++) {
      const already = nsUsers.find((u) => u.name === makeUserName(i));
      if (already) {
        users.push(already._id);
      } else {
        const id = await ctx.db.insert("users", {
          name: makeUserName(i),
          image: undefined,
          email: undefined,
        });
        users.push(id);
      }
    }

    // Ensure admin is included
    const allUsers: Id<"users">[] = [adminUserId, ...users];

    // League factory
    const createLeague = async (name: string, description: string) => {
      const leagueId = await ctx.db.insert("leagues", {
        name: `${prefix} ${name}`,
        description,
        isPublic: true,
        creatorId: adminUserId,
        submissionDeadline: now + 24 * 60 * 60 * 1000,
        votingDeadline: now + 48 * 60 * 60 * 1000,
        maxPositiveVotes: 3,
        maxNegativeVotes: 1,
        inviteCode: null,
        managers: [adminUserId],
        enforceListenPercentage: true,
        listenPercentage: 50,
        listenTimeLimitMinutes: 8,
        limitVotesPerSubmission: true,
        maxPositiveVotesPerSubmission: 2,
        maxNegativeVotesPerSubmission: 1,
      });

      // Add memberships
      for (const uid of allUsers) {
        await ctx.db.insert("memberships", {
          userId: uid,
          leagueId,
          joinDate: now,
        });
      }
      return leagueId;
    };

    const createRound = async (
      leagueId: Id<"leagues">,
      title: string,
      status: "submissions" | "voting" | "finished",
      cfg?: Partial<Omit<Doc<"rounds">, "_id" | "_creationTime">>,
    ) => {
      const base = {
        leagueId,
        title,
        description: `${title} – seeded round`,
        imageKey: undefined,
        genres: ["seeded"],
        status,
        submissionDeadline: now + (status === "submissions" ? 6 : -6) * 60 * 60 * 1000,
        votingDeadline: now + (status === "finished" ? -1 : 12) * 60 * 60 * 1000,
        submissionsPerUser: 1,
      } satisfies Omit<Doc<"rounds">, "_id" | "_creationTime">;
      const roundId = await ctx.db.insert("rounds", { ...base, ...cfg });
      return roundId;
    };

    const createSubmission = async (
      leagueId: Id<"leagues">,
      roundId: Id<"rounds">,
      userId: Id<"users">,
      songIndex: number,
    ) => {
      const song = YT_SONGS[(songIndex + Math.floor(Math.random() * YT_SONGS.length)) % YT_SONGS.length];
      await ctx.db.insert("submissions", {
        leagueId,
        roundId,
        userId,
        songTitle: song.title,
        artist: song.artist,
        albumArtKey: undefined,
        songFileKey: undefined,
        comment: "seeded",
        submissionType: "youtube",
        songLink: ytUrl(song.videoId),
        albumArtUrlValue: `https://img.youtube.com/vi/${song.videoId}/hqdefault.jpg`,
        waveform: undefined,
        duration: song.duration,
        searchText: buildSubmissionSearchText(song.title, song.artist),
        normalizedSongTitle: normalizeSubmissionSongTitle(song.title),
        normalizedArtist: normalizeSubmissionArtist(song.artist),
        isTrollSubmission: false,
      });
    };

    const createVotes = async (
      roundId: Id<"rounds">,
      leagueMaxPos: number,
      leagueMaxNeg: number,
      submissions: Doc<"submissions">[],
      voters: Id<"users">[],
    ) => {
      // Simple deterministic voting: each voter upvotes the first N not theirs and downvotes 1 random.
      for (const voter of voters) {
        const others = submissions.filter((s) => s.userId !== voter);
        const upTargets = others.slice(0, Math.min(leagueMaxPos, others.length));
        for (const s of upTargets) {
          await ctx.db.insert("votes", { roundId, submissionId: s._id, userId: voter, vote: 1 });
        }
        const negTarget = pick(others);
        if (negTarget && leagueMaxNeg > 0) {
          await ctx.db.insert("votes", { roundId, submissionId: negTarget._id, userId: voter, vote: -1 });
        }
      }
    };

    // 1) League with submissions open, no songs yet
    const leagueSubmissions = await createLeague("League – Submissions", "For testing submission UI");
    await createRound(leagueSubmissions, "Open Submissions", "submissions");

    // 2) League with voting active
    const leagueVoting = await createLeague("League – Voting", "For testing voting UI");
    const roundVoting = await createRound(leagueVoting, "Voting Round", "voting");

    // Create one submission per user in voting round
    for (let i = 0; i < allUsers.length; i++) {
      await createSubmission(leagueVoting, roundVoting, allUsers[i], i);
    }

    // Add partial listen progress for admin on voting round to test gating
    const votingSubs = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", roundVoting))
      .collect();

    for (let i = 0; i < votingSubs.length; i++) {
      const s = votingSubs[i];
      const progress = i % 2 === 0 ? Math.floor((s.duration ?? 180) * 0.6) : Math.floor((s.duration ?? 180) * 0.2);
      await ctx.db.insert("listenProgress", {
        userId: adminUserId,
        submissionId: s._id,
        roundId: roundVoting,
        progressSeconds: progress,
        isCompleted: progress >= Math.min((s.duration ?? 180) * 0.5, 8 * 60),
      });
    }

    // 3) League with finished round (with votes and results)
    const leagueFinished = await createLeague("League – Finished", "For testing finished UI & stats");
    const roundFinished = await createRound(leagueFinished, "Finished Round", "finished");

    // Submissions for finished round
    for (let i = 0; i < allUsers.length; i++) {
      await createSubmission(leagueFinished, roundFinished, allUsers[i], i + 3);
    }
    const finishedSubs = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", roundFinished))
      .collect();

    const leagueDoc = await ctx.db.get("leagues", leagueFinished);
    const maxPos = leagueDoc?.maxPositiveVotes ?? 3;
    const maxNeg = leagueDoc?.maxNegativeVotes ?? 1;

    await createVotes(roundFinished, maxPos, maxNeg, finishedSubs, allUsers);

    // Compute results and standings using existing logic
    await ctx.scheduler.runAfter(0, internal.leagues.calculateAndStoreResults, { roundId: roundFinished });
  },
});

export const _resetInternal = internalMutation({
  args: { namespace: v.string() },
  handler: async (ctx, { namespace }) => {
    const prefix = `[SEED ${namespace}]`;

    // Find leagues with the prefix
    const leagues = (await ctx.db.query("leagues").collect()).filter((l) => l.name.startsWith(prefix));

    for (const league of leagues) {
      // Rounds
      const rounds = await ctx.db
        .query("rounds")
        .withIndex("by_league", (q) => q.eq("leagueId", league._id))
        .collect();

      for (const round of rounds) {
        // Submissions
        const subs = await ctx.db
          .query("submissions")
          .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
          .collect();
        const subIds = new Set(subs.map((s) => s._id.toString()));

        // Votes
        const votes = await ctx.db
          .query("votes")
          .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
          .collect();
        for (const vte of votes) await ctx.db.delete("votes", vte._id);

        // Listen progress (scan and filter by submissionId)
        const allProgress = await ctx.db.query("listenProgress").collect();
        for (const p of allProgress) {
          if (subIds.has(p.submissionId.toString())) await ctx.db.delete("listenProgress", p._id);
        }

        // Comments
        if (subs.length > 0) {
          for (const s of subs) {
            const cs = await ctx.db
              .query("comments")
              .withIndex("by_submission", (q) => q.eq("submissionId", s._id))
              .collect();
            for (const c of cs) await ctx.db.delete("comments", c._id);
          }
        } else {
          const scan = await ctx.db.query("comments").collect();
          for (const c of scan) {
            if (subIds.has(c.submissionId.toString())) await ctx.db.delete("comments", c._id);
          }
        }

        // Round results
        const results = await ctx.db
          .query("roundResults")
          .withIndex("by_round", (q) => q.eq("roundId", round._id))
          .collect();
        for (const r of results) await ctx.db.delete("roundResults", r._id);

        // Delete submissions
        for (const s of subs) await ctx.db.delete("submissions", s._id);

        // Delete the round itself
        await ctx.db.delete("rounds", round._id);
      }

      // Memberships
      const memberships = await ctx.db
        .query("memberships")
        .withIndex("by_league", (q) => q.eq("leagueId", league._id))
        .collect();
      for (const m of memberships) await ctx.db.delete("memberships", m._id);

      // Standings (both indexes exist; scan by league)
      const standings = await ctx.db
        .query("leagueStandings")
        .withIndex("by_league_and_points", (q) => q.eq("leagueId", league._id))
        .collect();
      for (const s of standings) await ctx.db.delete("leagueStandings", s._id);

      // Finally delete the league
      await ctx.db.delete("leagues", league._id);
    }

    // Note: we keep the created fake users around; they are inexpensive and can be reused.
  },
});
