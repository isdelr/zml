import { defineApp } from "convex/server";
import r2 from "@convex-dev/r2/convex.config";
import migrations from "@convex-dev/migrations/convex.config";
import shardedCounter from "@convex-dev/sharded-counter/convex.config";

const app = defineApp();
app.use(migrations);
app.use(r2);
app.use(shardedCounter); 

export default app;