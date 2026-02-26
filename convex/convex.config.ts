import { defineApp } from "convex/server";
import migrations from "@convex-dev/migrations/convex.config";
import shardedCounter from "@convex-dev/sharded-counter/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";
import betterAuth from "@convex-dev/better-auth/convex.config";

const app = defineApp();
app.use(migrations);
app.use(shardedCounter);
app.use(aggregate, { name: "unreadNotifications" });
app.use(aggregate, { name: "membershipsPerUser" });
app.use(aggregate, { name: "submissionsPerUser" });
app.use(betterAuth);

export default app;
