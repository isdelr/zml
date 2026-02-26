#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const envCandidates = [".env.docker.dev", ".env.local"];
for (const envFile of envCandidates) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (!existsSync(envPath)) {
    continue;
  }
  dotenv.config({ path: envPath, override: false });
}

const result = spawnSync("npx", ["convex", "codegen"], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
