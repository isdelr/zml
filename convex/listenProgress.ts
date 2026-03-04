// File: convex/listenProgress.ts

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { Doc } from "./_generated/dataModel";
import {
  getAllowedProgressJumpSeconds,
  getCappedProgressSeconds,
} from "../lib/music/listen-progress";

type SubmissionDurationInfo = {
  durationSec: number;
  derivedFromWaveform: boolean;
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
  handler: async (ctx, args): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    // Validate inbound value early
    if (!Number.isFinite(args.progressSeconds)) return;

    const submission = await ctx.db.get("submissions", args.submissionId);
    if (!submission) {
      return;
    }

    // Track progress for file-based and link submissions (youtube)
    if (!["file", "youtube"].includes(submission.submissionType)) {
      return;
    }

    const durationInfo = getSubmissionDurationInfo(submission);

    // If we still don't have a usable duration (e.g., malformed file submission), skip.
    if (!durationInfo) return;
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
      return;
    }

    // Handle legacy or partially configured leagues gracefully.
    // Default to "percentage only" if time limit is missing.
    const listenPercentage =
      league.listenPercentage !== undefined ? league.listenPercentage : 100;
    const timeLimitSeconds =
      league.listenTimeLimitMinutes !== undefined
        ? Math.max(0, league.listenTimeLimitMinutes * 60)
        : Infinity;

    const requiredPercentage = Math.max(0, Math.min(100, listenPercentage)) / 100;
    const requiredListenTime = Math.min(
      durationSec * requiredPercentage,
      timeLimitSeconds,
    );

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
    if (existing?.isCompleted) return;

    // Small optimization: if existing progress is already ahead of the report,
    // there's nothing to do (Math.max below would keep the old value anyway).
    if (existing && reported <= existing.progressSeconds) {
      // If not completed yet, check whether existing progress already meets requirement.
      if (existing.progressSeconds >= requiredListenTime) {
        await ctx.db.patch("listenProgress", existing._id, {
          isCompleted: true,
          roundId: submission.roundId,
        });
      }
      return;
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
      const completed = newProgress >= requiredListenTime;

      // Only write if something actually changed.
      if (newProgress !== existing.progressSeconds || completed !== existing.isCompleted) {
        await ctx.db.patch("listenProgress", existing._id, {
          progressSeconds: newProgress,
          isCompleted: completed,
          roundId: submission.roundId,
        });
      }
    } else {
      // First record: bound the initial write to the same anti-tamper jump window
      // instead of dropping to 0, so progress cannot get stuck after throttled ticks.
      const initialProgress = Math.min(reported, allowedJumpSec);

      await ctx.db.insert("listenProgress", {
        userId,
        submissionId: args.submissionId,
        roundId: submission.roundId,
        progressSeconds: initialProgress,
        isCompleted: initialProgress >= requiredListenTime,
      });
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

    const round = await ctx.db.get("rounds", args.roundId);
    if (!round) return { updated: 0 };

    // Get league for rules
    const league = await ctx.db.get("leagues", round.leagueId);
    if (!league || !league.enforceListenPercentage) {
      // If listening isn't enforced, nothing to do
      return { updated: 0 };
    }

    const listenPercentage =
      league.listenPercentage !== undefined ? league.listenPercentage : 100;
    const timeLimitSeconds =
      league.listenTimeLimitMinutes !== undefined
        ? Math.max(0, league.listenTimeLimitMinutes * 60)
        : Infinity;
    const requiredPercentage = Math.max(0, Math.min(100, listenPercentage)) / 100;

    const allSubmissionsInRound = await ctx.db
      .query("submissions")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", args.roundId))
      .collect();
    const submissionsById = new Map(
      allSubmissionsInRound.map((submission) => [submission._id.toString(), submission]),
    );

    const progressDocs = await ctx.db
      .query("listenProgress")
      .withIndex("by_round_and_user", (q) =>
        q.eq("roundId", args.roundId).eq("userId", userId),
      )
      .collect();
    const progressBySubmissionId = new Map(
      progressDocs.map((progress) => [progress.submissionId.toString(), progress]),
    );

    let updated = 0;

    for (const subId of args.submissionIds) {
      const submission = submissionsById.get(subId.toString());
      if (!submission) continue;
      // Must belong to the same round
      if (submission.roundId !== args.roundId) continue;
      // Only consider YouTube submissions
      if (submission.submissionType !== "youtube") continue;
      // Optionally skip user's own submission (not required, but consistent with gating)
      if (submission.userId === userId) continue;

      // Compute duration with YouTube fallback 180s
      const hasFiniteDuration =
        submission.duration !== undefined &&
        submission.duration !== null &&
        Number.isFinite(submission.duration);
      const durationSec = hasFiniteDuration
        ? Math.max(0, Math.floor(submission.duration as number))
        : 180;

      const requiredListenTime = Math.min(
        durationSec * requiredPercentage,
        timeLimitSeconds,
      );

      const existing = progressBySubmissionId.get(subId.toString());

      if (existing) {
        const newProgress = Math.max(existing.progressSeconds, Math.floor(requiredListenTime));
        if (!existing.isCompleted || existing.progressSeconds < newProgress) {
          await ctx.db.patch("listenProgress", existing._id, {
            progressSeconds: newProgress,
            isCompleted: true,
            roundId: args.roundId,
          });
          updated++;
          progressBySubmissionId.set(subId.toString(), {
            ...existing,
            progressSeconds: newProgress,
            isCompleted: true,
            roundId: args.roundId,
          });
        }
      } else {
        const listenProgressId = await ctx.db.insert("listenProgress", {
          userId,
          submissionId: subId,
          roundId: args.roundId,
          progressSeconds: Math.floor(requiredListenTime),
          isCompleted: true,
        });
        progressBySubmissionId.set(subId.toString(), {
          _id: listenProgressId,
          _creationTime: Date.now(),
          userId,
          submissionId: subId,
          roundId: args.roundId,
          progressSeconds: Math.floor(requiredListenTime),
          isCompleted: true,
        });
        updated++;
      }
    }

    return { updated };
  },
});
