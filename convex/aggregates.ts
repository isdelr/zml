import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import { DataModel, Doc, Id } from "./_generated/dataModel";

export const unreadNotifications = new TableAggregate<
  {
    Key: [Id<"users">, boolean];
    DataModel: DataModel;
    TableName: "notifications";
  }
>(components.unreadNotifications, {
  sortKey: (doc) => [doc.userId, doc.read],
});

export const membershipsByUser = new TableAggregate<
  {
    Key: Id<"users">;
    DataModel: DataModel;
    TableName: "memberships";
  }
>(components.membershipsPerUser, {
  sortKey: (doc) => doc.userId,
});

export const submissionsByUser = new TableAggregate<
  {
    Key: Id<"users">;
    DataModel: DataModel;
    TableName: "submissions";
  }
>(components.submissionsPerUser, {
  sortKey: (doc) => doc.userId,
});