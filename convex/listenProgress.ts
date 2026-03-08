// File: convex/listenProgress.ts

import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { Doc } from "./_generated/dataModel";
import {
  getAllowedProgressJumpSeconds,
  getCappedProgressSeconds,
  getRequiredListenTimeSeconds,
  hasCompletedRequiredListenTime,
} from "../lib/music/listen-progress";

type SubmissionDurationInfo = {
  durationSec: number;
  derivedFromWaveform: boolean;
};

type UpdateProgressResult = {
  progressSeconds: number;
  isCompleted: boolean;
};

type YouTubePlaylistSessionSnapshot = {
  active: boolean;
  done: boolean;
  readyToComplete: boolean;
  startedAt: number | null;
  endAt: number | null;
  completedAt: number | null;
  durationSec: number;
  remainingSec: number;
};

function getDurationFromWaveform(waveformJson: string | undefined): number | null {
  if (!waveformJson) return null;

  try {
    const parsed: unknown = JSON.parse(waveformJson);
    if (typeof parsed !== "object" || parsed === null) return null;

    const record = parsed as Record<string, unknown>;
    const length = Number(record.length);
    const samplesPerPixel = Number(record.samples_per_pixel);
    const sampleRate = Number(record.sample_rate);

    if (!Number.isFinite(length) || !Number.isFinite(samplesPerPixel) || !Number.isFinite(sampleRate)) {
      return null;
    }
    if (length <= 0 || samplesPerPixel <= 0 || sampleRate <= 0) return null;

    const durationSec = Math.floor((length * samplesPerPixel) / sampleRate);
    return durationSec > 0 ? durationSec : null;
  } catch {
    return null;
  }
}

function getSubmissionDurationInfo(
  submission: Doc<"submissions">,
): SubmissionDurationInfo | null {
  const hasFiniteDuration =
    submission.duration !== undefined &&
    submission.duration !== null &&
    Number.isFinite(submission.duration);
  if (hasFiniteDuration) {
    return {
      durationSec: Math.max(0, Math.floor(submission.duration as number)),
      derivedFromWaveform: false,
    };
  }

  if (submission.submissionType === "file") {
    const waveformDurationSec = getDurationFromWaveform(submission.waveform);
    if (waveformDurationSec !== null) {
      return {
        durationSec: waveformDurationSec,
        derivedFromWaveform: true,
      };
    }
  }

  if (submission.submissionType === "youtube") {
    return {
      durationSec: 180,
      derivedFromWaveform: false,
    };
  }

  return null;
}

async function getYouTubePlaylistSessionDoc(
  ctx: MutationCtx | QueryCtx,
  roundId: Doc<"rounds">["_id"],
  userId: Doc<"users">["_id"],
) {
  return await ctx.db
    .query("youtubePlaylistSessions")
    .withIndex("by_round_and_user", (q) =>
      q.eq("roundId", roundId).eq("userId", userId),
    )
    .first();
}

function getYouTubePlaylistSessionSnapshot(
  session: Doc<"youtubePlaylistSessions"> | null,
  now: number,
): YouTubePlaylistSessionSnapshot {
  if (!session) {
    return {
      active: false,
      done: false,
      readyToComplete: false,
      startedAt: null,
      endAt: null,
      completedAt: null,
      durationSec: 0,
      remainingSec: 0,
    };
  }

  const durationSec = Math.max(0, Math.floor(session.durationSec));
  const completedAt = session.completedAt ?? null;
  const endAt = Number.isFinite(session.endAt) ? session.endAt : null;
  const remainingSec =
    endAt === null ? 0 : Math.max(0, Math.ceil((endAt - now) / 1000));
  const active = completedAt === null && remainingSec > 0;
  const readyToComplete = completedAt === null && endAt !== null && endAt <= now;

  return {
    active,
    done: completedAt !== null,
    readyToComplete,
    startedAt: session.startedAt,
    endAt,
    completedAt,
    durationSec,
    remainingSec,
  };
}

async function markYouTubeSubmissionsCompletedForUser(
  ctx: MutationCtx,
  userId: Doc<"users">["_id"],
  roundId: Doc<"rounds">["_id"],
  submissionIds: Doc<"submissions">["_id"][],
): Promise<number> {
  const round = await ctx.db.get("rounds", roundId);
  if (!round) return 0;

  const league = await ctx.db.get("leagues", round.leagueId);
  if (!league || !league.enforceListenPercentage) {
    return 0;
  }

  const listenPercentage =
    league.listenPercentage !== undefined ? league.listenPercentage : 100;

  const allSubmissionsInRound = await ctx.db
    .query("submissions")
    .withIndex("by_round_and_user", (q) => q.eq("roundId", roundId))
    .collect();
  const submissionsById = new Map(
    allSubmissionsInRound.map((submission) => [submission._id.toString(), submission]),
  );

  const progressDocs = await ctx.db
    .query("listenProgress")
    .withIndex("by_round_and_user", (q) =>
      q.eq("roundId", roundId).eq("userId", userId),
    )
    .collect();
  const progressBySubmissionId = new Map(
    progressDocs.map((progress) => [progress.submissionId.toString(), progress]),
  );

  let updated = 0;

  for (const subId of submissionIds) {
    const submission = submissionsById.get(subId.toString());
    if (!submission) continue;
    if (submission.roundId !== roundId) continue;
    if (submission.submissionType !== "youtube") continue;
    if (submission.userId === userId) continue;

    const hasFiniteDuration =
      submission.duration !== undefined &&
      submission.duration !== null &&
      Number.isFinite(submission.duration);
    const durationSec = hasFiniteDuration
      ? Math.max(0, Math.floor(submission.duration as number))
      : 180;
    const requiredListenTime = getRequiredListenTimeSeconds(
      durationSec,
      listenPercentage,
      league.listenTimeLimitMinutes,
    );

    const existing = progressBySubmissionId.get(subId.toString());

    if (existing) {
      const newProgress = Math.max(existing.progressSeconds, requiredListenTime);
      if (!existing.isCompleted || existing.progressSeconds < newProgress) {
        await ctx.db.patch("listenProgress", existing._id, {
          progressSeconds: newProgress,
          isCompleted: true,
          roundId,
        });
        updated++;
        progressBySubmissionId.set(subId.toString(), {
          ...existing,
          progressSeconds: newProgress,
          isCompleted: true,
          roundId,
        });
      }
      continue;
    }

    const listenProgressId = await ctx.db.insert("listenProgress", {
      userId,
      submissionId: subId,
      roundId,
      progressSeconds: requiredListenTime,
      isCompleted: true,
    });
    progressBySubmissionId.set(subId.toString(), {
      _id: listenProgressId,
      _creationTime: Date.now(),
      userId,
      submissionId: subId,
      roundId,
      progressSeconds: requiredListenTime,
      isCompleted: true,
    });
    updated++;
  }

  return updated;
}

/**
 * Return all listen progress docs for the current user within a round.
 * Uses a round+user index.
 */
export const getForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args): Promise<Doc<"listenProgress">[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("listenProgress")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", args.roundId).eq("userId", userId),
      )
      .collect();
  },
});

export const getYouTubePlaylistSession = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args): Promise<YouTubePlaylistSessionSnapshot> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return getYouTubePlaylistSessionSnapshot(null, Date.now());
    }

    const session = await getYouTubePlaylistSessionDoc(ctx, args.roundId, userId);
    return getYouTubePlaylistSessionSnapshot(session, Date.now());
  },
});

export const startYouTubePlaylistSession = mutation({
  args: {
    roundId: v.id("rounds"),
    durationSec: v.number(),
  },
  handler: async (ctx, args): Promise<YouTubePlaylistSessionSnapshot> => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();
    if (!userId) {
      return getYouTubePlaylistSessionSnapshot(null, now);
    }

    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) {
      return getYouTubePlaylistSessionSnapshot(null, now);
    }
    const league = await ctx.db.get("leagues", round.leagueId);
    if (!league?.enforceListenPercentage) {
      return getYouTubePlaylistSessionSnapshot(null, now);
    }

    const durationSec = Math.max(0, Math.floor(args.durationSec));
    if (durationSec <= 0) {
      return getYouTubePlaylistSessionSnapshot(null, now);
    }

    const existing = await getYouTubePlaylistSessionDoc(ctx, args.roundId, userId);
    const existingSnapshot = getYouTubePlaylistSessionSnapshot(existing, now);
    if (existingSnapshot.done || existingSnapshot.active || existingSnapshot.readyToComplete) {
      return existingSnapshot;
    }

    const endAt = now + durationSec * 1000;
    if (existing) {
      await ctx.db.patch("youtubePlaylistSessions", existing._id, {
        durationSec,
        startedAt: now,
        endAt,
        completedAt: undefined,
      });
      return getYouTubePlaylistSessionSnapshot(
        {
          ...existing,
          durationSec,
          startedAt: now,
          endAt,
          completedAt: undefined,
        },
        now,
      );
    }

    const sessionId = await ctx.db.insert("youtubePlaylistSessions", {
      userId,
      roundId: args.roundId,
      durationSec,
      startedAt: now,
      endAt,
    });

    return getYouTubePlaylistSessionSnapshot(
      {
        _id: sessionId,
        _creationTime: now,
        userId,
        roundId: args.roundId,
        durationSec,
        startedAt: now,
        endAt,
      },
      now,
    );
  },
});

export const completeYouTubePlaylistSession = mutation({
  args: {
    roundId: v.id("rounds"),
    submissionIds: v.array(v.id("submissions")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<YouTubePlaylistSessionSnapshot & { updated: number }> => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();
    if (!userId) {
      return {
        ...getYouTubePlaylistSessionSnapshot(null, now),
        updated: 0,
      };
    }

    const session = await getYouTubePlaylistSessionDoc(ctx, args.roundId, userId);
    const snapshot = getYouTubePlaylistSessionSnapshot(session, now);
    if (!session) {
      return { ...snapshot, updated: 0 };
    }
    if (snapshot.done) {
      return { ...snapshot, updated: 0 };
    }
    if (!snapshot.readyToComplete) {
      return { ...snapshot, updated: 0 };
    }

    const updated = await markYouTubeSubmissionsCompletedForUser(
      ctx,
      userId,
      args.roundId,
      args.submissionIds,
    );
    await ctx.db.patch("youtubePlaylistSessions", session._id, {
      completedAt: now,
    });

    return {
      active: false,
      done: true,
      readyToComplete: false,
      startedAt: session.startedAt,
      endAt: session.endAt,
      completedAt: now,
      durationSec: session.durationSec,
      remainingSec: 0,
      updated,
    };
  },
});

/**
 * Updates a user's listening progress for a specific submission.
 * - Robust input validation and clamping
 * - Server-side guards against tampering (bound large jumps)
 * - Only updates when there's meaningful change
 * - Ignores non-file submissions and disabled listen rules
 */
export const updateProgress = mutation({
  args: {
    submissionId: v.id("submissions"),
    progressSeconds: v.number(),
  },
  handler: async (ctx, args): Promise<UpdateProgressResult | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Validate inbound value early
    if (!Number.isFinite(args.progressSeconds)) return null;

    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) {
      return null;
    }

    // Track progress for file-based and link submissions (youtube)
    if (!["file", "youtube"].includes(submission.submissionType)) {
      return null;
    }

    const durationInfo = getSubmissionDurationInfo(submission);

    // If we still don't have a usable duration (e.g., malformed file submission), skip.
    if (!durationInfo) return null;
    const { durationSec, derivedFromWaveform } = durationInfo;

    if (
      derivedFromWaveform &&
      (submission.duration === undefined || submission.duration === null)
    ) {
      await ctx.db.patch("submissions", submission._id, { duration: durationSec });
    }

    const league = await ctx.db.get("leagues", submission.leagueId);
    if (!league || !league.enforceListenPercentage) {
      // If listening is not enforced, we don't need to track.
      return null;
    }

    // Handle legacy or partially configured leagues gracefully.
    // Default to "percentage only" if time limit is missing.
    const listenPercentage =
      league.listenPercentage !== undefined ? league.listenPercentage : 100;

    // Normalize and clamp reported progress to [0, durationSec] and to integer seconds
    const reported = Math.max(
      0,
      Math.min(durationSec, Math.floor(args.progressSeconds)),
    );

    const existing = await ctx.db
      .query("listenProgress")
      .withIndex("by_user_and_submission", (q) =>
        q.eq("userId", userId).eq("submissionId", args.submissionId),
      )
      .first();

    // If we've already marked completion, do nothing.
    if (existing?.isCompleted) {
      return {
        progressSeconds: existing.progressSeconds,
        isCompleted: true,
      };
    }

    // Small optimization: if existing progress is already ahead of the report,
    // there's nothing to do (Math.max below would keep the old value anyway).
    if (existing && reported <= existing.progressSeconds) {
      // If not completed yet, check whether existing progress already meets requirement.
      const completed = hasCompletedRequiredListenTime(
        existing.progressSeconds,
        durationSec,
        listenPercentage,
        league.listenTimeLimitMinutes,
      );
      if (completed) {
        await ctx.db.patch("listenProgress", existing._id, {
          isCompleted: true,
          roundId: submission.roundId,
        });
      }
      return {
        progressSeconds: existing.progressSeconds,
        isCompleted: completed,
      };
    }

    // Anti-tampering: Bound unnaturally large jumps forward between updates.
    // Use a bounded allowance that scales gently with track length.
    // - Minimum allowance: 15s (network hiccups, tab throttling)
    // - Maximum allowance: 60s (prevent huge leaps)
    // - Also consider up to 10% of track length for very short tracks.
    const allowedJumpSec = getAllowedProgressJumpSeconds(durationSec);

    if (existing) {
      const newProgress = getCappedProgressSeconds(
        existing.progressSeconds,
        reported,
        durationSec,
      );
      const completed = hasCompletedRequiredListenTime(
        newProgress,
        durationSec,
        listenPercentage,
        league.listenTimeLimitMinutes,
      );

      // Only write if something actually changed.
      if (newProgress !== existing.progressSeconds || completed !== existing.isCompleted) {
        await ctx.db.patch("listenProgress", existing._id, {
          progressSeconds: newProgress,
          isCompleted: completed,
          roundId: submission.roundId,
        });
      }
      return {
        progressSeconds: newProgress,
        isCompleted: completed,
      };
    } else {
      // First record: bound the initial write to the same anti-tamper jump window
      // instead of dropping to 0, so progress cannot get stuck after throttled ticks.
      const initialProgress = Math.min(reported, allowedJumpSec);
      const completed = hasCompletedRequiredListenTime(
        initialProgress,
        durationSec,
        listenPercentage,
        league.listenTimeLimitMinutes,
      );

      await ctx.db.insert("listenProgress", {
        userId,
        submissionId: args.submissionId,
        roundId: submission.roundId,
        progressSeconds: initialProgress,
        isCompleted: completed,
      });
      return {
        progressSeconds: initialProgress,
        isCompleted: completed,
      };
    }
  },
});

// Bulk-complete listening progress for a set of submissions in a round (YouTube playlist timer)
export const markCompletedBatch = mutation({
  args: {
    roundId: v.id("rounds"),
    submissionIds: v.array(v.id("submissions")),
  },
  handler: async (ctx, args): Promise<{ updated: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { updated: 0 };
    const updated = await markYouTubeSubmissionsCompletedForUser(
      ctx,
      userId,
      args.roundId,
      args.submissionIds,
    );
    return { updated };
  },
});
