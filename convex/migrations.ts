import { Migrations } from "@convex-dev/migrations";
import { DataModel } from "./_generated/dataModel";
import { components } from "./_generated/api";
import {
  unreadNotifications,
  membershipsByUser,
  submissionsByUser,
} from "./aggregates";

export const migrations: Migrations<DataModel> = new Migrations<DataModel>(
  components.migrations,
);

export const backfillSubmissionType = migrations.define({
  table: "submissions",

  migrateOne: async (ctx, doc) => {
    if (doc.submissionType === undefined) {
      console.log(`Backfilling submission: ${doc._id}`);

      await ctx.db.patch(doc._id, { submissionType: "file" });
    }
  },
});

export const backfillSearchText = migrations.define({
  table: "submissions",
  migrateOne: async (ctx, doc) => {
    if (doc.searchText === undefined) {
      const searchText = `${doc.songTitle} ${doc.artist}`;
      await ctx.db.patch(doc._id, { searchText });
    }
  },
});

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

export const convertLeagueDeadlinesToHours = migrations.define({
  table: "leagues",
  batchSize: 100,
  migrateOne: async (ctx, doc) => {
    // Heuristic: If a deadline value is 30 or less, it's from the old "days" system.
    const submissionDeadlineInHours = doc.submissionDeadline <= 30 ? doc.submissionDeadline * 24 : doc.submissionDeadline;
    const votingDeadlineInHours = doc.votingDeadline <= 30 ? doc.votingDeadline * 24 : doc.votingDeadline;

    if (submissionDeadlineInHours !== doc.submissionDeadline || votingDeadlineInHours !== doc.votingDeadline) {
      await ctx.db.patch(doc._id, {
        submissionDeadline: submissionDeadlineInHours,
        votingDeadline: votingDeadlineInHours,
      });
      console.log(`Migrated league ${doc._id}: Deadlines converted from days to hours.`);
    }
  },
});


export const run = migrations.runner();