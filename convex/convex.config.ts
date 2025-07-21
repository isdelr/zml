import { defineApp } from "convex/server";
import r2 from "@convex-dev/r2/convex.config";
import migrations from "@convex-dev/migrations/convex.config";

const app = defineApp();
app.use(migrations);
app.use(r2);

export default app;