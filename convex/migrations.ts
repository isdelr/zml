import { Migrations } from "@convex-dev/migrations";
import { type GenericMutationCtx } from "convex/server";
import { DataModel } from "./_generated/dataModel";
import { components, internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { unreadNotifications, membershipsByUser, submissionsByUser } from "./aggregates";
import { recalculateAndStoreRoundResults } from "../lib/convex-server/leagues/results";
import { getOverflowMultiRoundSubmissionIds } from "../lib/rounds/multi-submission-overflow";

export const migrations: Migrations<DataModel> = new Migrations<DataModel>(components.migrations);

type MigrationCtx = GenericMutationCtx<DataModel>;

function getSubmissionStorageKeys(
  submission: Pick<
    Doc<"submissions">,
    "albumArtKey" | "songFileKey" | "originalSongFileKey" | "songFileLegacyKey"
  >,
) {
  return [
    submission.albumArtKey,
    submission.songFileKey,
    submission.originalSongFileKey,
    submission.songFileLegacyKey,
  ].filter((key): key is string => Boolean(key));
}

async function deleteOverflowMultiRoundSubmissionsForRound(
  ctx: MigrationCtx,
  round: Doc<"rounds">,
) {
  if (round.submissionMode !== "multi") {
    return;
  }

  const submissionsPerUser = round.submissionsPerUser ?? 1;
  const roundSubmissions = await ctx.db
    .query("submissions")
    .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
    .collect();
  const overflowSubmissionIds = new Set(
    getOverflowMultiRoundSubmissionIds(roundSubmissions, submissionsPerUser),
  );

  if (overflowSubmissionIds.size === 0) {
    return;
  }

  const overflowSubmissions = roundSubmissions.filter((submission) =>
    overflowSubmissionIds.has(submission._id.toString()),
  );
  const overflowSubmissionIdList = overflowSubmissions.map(
    (submission) => submission._id,
  );
  const overflowVotes = (
    await ctx.db
      .query("votes")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
      .collect()
  ).filter((vote) => overflowSubmissionIds.has(vote.submissionId.toString()));
  const overflowAdminVoteAdjustments = (
    await ctx.db
      .query("adminVoteAdjustments")
      .withIndex("by_round", (q) => q.eq("roundId", round._id))
      .collect()
  ).filter((adjustment) =>
    overflowSubmissionIds.has(adjustment.submissionId.toString()),
  );
  const overflowListenProgress = (
    await ctx.db
      .query("listenProgress")
      .withIndex("by_round_and_user", (q) => q.eq("roundId", round._id))
      .collect()
  ).filter((progress) =>
    overflowSubmissionIds.has(progress.submissionId.toString()),
  );
  const overflowRoundResults = (
    await ctx.db
      .query("roundResults")
      .withIndex("by_round", (q) => q.eq("roundId", round._id))
      .collect()
  ).filter((result) =>
    overflowSubmissionIds.has(result.submissionId.toString()),
  );
  const presenceUsers = (
    await ctx.db
      .query("users")
      .withIndex("by_presence_round", (q) => q.eq("presence.roundId", round._id))
      .collect()
  ).filter((user) =>
    user.presence?.location &&
    overflowSubmissionIds.has(user.presence.location.toString()),
  );
  const commentsBySubmission = await Promise.all(
    overflowSubmissionIdList.map((submissionId) =>
      ctx.db
        .query("comments")
        .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
        .collect(),
    ),
  );
  const bookmarksBySubmission = await Promise.all(
    overflowSubmissionIdList.map((submissionId) =>
      ctx.db
        .query("bookmarks")
        .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
        .collect(),
    ),
  );

  await Promise.all([
    ...commentsBySubmission.flat().map((comment) =>
      ctx.db.delete("comments", comment._id),
    ),
    ...bookmarksBySubmission.flat().map((bookmark) =>
      ctx.db.delete("bookmarks", bookmark._id),
    ),
    ...overflowVotes.map((vote) => ctx.db.delete("votes", vote._id)),
    ...overflowAdminVoteAdjustments.map((adjustment) =>
      ctx.db.delete("adminVoteAdjustments", adjustment._id),
    ),
    ...overflowListenProgress.map((progress) =>
      ctx.db.delete("listenProgress", progress._id),
    ),
    ...overflowRoundResults.map((result) =>
      ctx.db.delete("roundResults", result._id),
    ),
    ...presenceUsers.map((user) =>
      ctx.db.patch("users", user._id, { presence: undefined }),
    ),
  ]);

  await Promise.all(
    overflowSubmissions.map(async (submission) => {
      await Promise.all([
        ctx.db.delete("submissions", submission._id),
        submissionsByUser.delete(ctx, submission),
      ]);
    }),
  );

  const submissionKeysToDelete = [
    ...new Set(overflowSubmissions.flatMap((submission) => getSubmissionStorageKeys(submission))),
  ];
  if (submissionKeysToDelete.length > 0) {
    await ctx.scheduler.runAfter(0, internal.submissions.deleteSubmissionFiles, {
      keys: submissionKeysToDelete,
      failureLabel: "deleted overflow multi submission file",
    });
    await ctx.scheduler.runAfter(0, internal.files.markStorageUploadsDeleted, {
      keys: submissionKeysToDelete,
    });
  }

  if (round.status === "finished") {
    await recalculateAndStoreRoundResults(ctx, round._id);
  }

  console.info(
    `Deleted ${overflowSubmissions.length} overflow submission(s) from multi round ${round._id}.`,
  );
}

export const backfillUnreadNotificationsAggregate = migrations.define({
  table: "notifications",
  migrateOne: async (ctx, doc) => {
    await unreadNotifications.insertIfDoesNotExist(ctx, doc);
  },
});

export const backfillMembershipsAggregate = migrations.define({
  table: "memberships",
  migrateOne: async (ctx, doc) => {
    await membershipsByUser.insertIfDoesNotExist(ctx, doc);
  },
});

export const backfillSubmissionsAggregate = migrations.define({
  table: "submissions",
  migrateOne: async (ctx, doc) => {
    await submissionsByUser.insertIfDoesNotExist(ctx, doc);
  },
});

export const deleteOverflowMultiRoundSubmissions = migrations.define({
  table: "rounds",
  batchSize: 1,
  migrateOne: async (ctx, round) => {
    await deleteOverflowMultiRoundSubmissionsForRound(ctx, round);
  },
});

export const run = migrations.runner();
