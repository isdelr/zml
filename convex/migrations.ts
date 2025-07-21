import { Migrations } from "@convex-dev/migrations";
import { DataModel } from "./_generated/dataModel";
import { components } from "./_generated/api";

// Initialize the migrations helper// Correct
export const migrations: Migrations<DataModel> = new Migrations<DataModel>(
  components.migrations,
);

// This is our specific migration to fix the old documents.
export const backfillSubmissionType = migrations.define({
  // The table we want to migrate
  table: "submissions",

  // The function that will be run on every single document in the "submissions" table
  migrateOne: async (ctx, doc) => {
    // We only want to change documents that are missing the new field.
    // In Convex, a missing field is `undefined` when you read the document.
    if (doc.submissionType === undefined) {
      console.log(`Backfilling submission: ${doc._id}`);
      // Patch the document to add the new field with the default value.
      await ctx.db.patch(doc._id, { submissionType: "file" });
    }
  },
});

// A general-purpose runner to execute migrations from the dashboard or CLI
export const run = migrations.runner();
