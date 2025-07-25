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

export const run = migrations.runner();