import { defineApp } from "convex/server";
import r2 from "@convex-dev/r2/convex.config";
import migrations from "@convex-dev/migrations/convex.config";
import shardedCounter from "@convex-dev/sharded-counter/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";

const app = defineApp();
app.use(migrations);
app.use(r2);
app.use(shardedCounter); 
app.use(aggregate, { name: "unreadNotifications" });
app.use(aggregate, { name: "membershipsPerUser" });
app.use(aggregate, { name: "submissionsPerUser" });

export default app;