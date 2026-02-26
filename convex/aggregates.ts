import { TableAggregate } from "@convex-dev/aggregate";
import type { ComponentApi as AggregateComponentApi } from "@convex-dev/aggregate/_generated/component.js";
import { components } from "./_generated/api";
import { DataModel, Id } from "./_generated/dataModel";

const unreadNotificationsComponent =
  components.unreadNotifications as AggregateComponentApi;
const membershipsPerUserComponent =
  components.membershipsPerUser as AggregateComponentApi;
const submissionsPerUserComponent =
  components.submissionsPerUser as AggregateComponentApi;

export const unreadNotifications = new TableAggregate<{
  Key: [Id<"users">, boolean];
  DataModel: DataModel;
  TableName: "notifications";
}>(unreadNotificationsComponent, {
  sortKey: (doc) => [doc.userId, doc.read],
});

export const membershipsByUser = new TableAggregate<{
  Key: Id<"users">;
  DataModel: DataModel;
  TableName: "memberships";
}>(membershipsPerUserComponent, {
  sortKey: (doc) => doc.userId,
});

export const submissionsByUser = new TableAggregate<{
  Key: Id<"users">;
  DataModel: DataModel;
  TableName: "submissions";
}>(submissionsPerUserComponent, {
  sortKey: (doc) => doc.userId,
});
