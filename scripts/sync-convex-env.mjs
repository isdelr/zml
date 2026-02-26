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

const requiredSelfHostedVars = [
  "CONVEX_SELF_HOSTED_URL",
  "CONVEX_SELF_HOSTED_ADMIN_KEY",
];

for (const key of requiredSelfHostedVars) {
  if (!process.env[key]) {
    console.log(`[convex-env-sync] Skipping: missing ${key}.`);
    process.exit(0);
  }
}

const variablesToSync = [
  "SITE_URL",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "DISCORD_SERVER_ID",
  "JWKS",
  "B2_BUCKET",
  "B2_ENDPOINT",
  "B2_REGION",
  "B2_KEY_ID",
  "B2_APPLICATION_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "YOUTUBE_API_KEY",
  "GENIUS_ACCESS_TOKEN",
  "DEV_SEED_ENABLED",
  "INSTANCE_SECRET",
];

function validateJwksDocArray(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (value) =>
          value &&
          typeof value === "object" &&
          typeof value.id === "string" &&
          typeof value.publicKey === "string" &&
          typeof value.privateKey === "string",
      )
    ) {
      console.error(
        "[convex-env-sync] JWKS must be a Better Auth doc-array with both publicKey and privateKey.",
      );
      console.error(
        "[convex-env-sync] Generate one with: node generateKeys.mjs",
      );
      process.exit(1);
    }
    const missingPrivateKey = parsed.some((doc) => !doc.privateKey);
    if (missingPrivateKey) {
      console.error(
        "[convex-env-sync] JWKS doc-array has empty privateKey. Better Auth needs it to sign JWTs.",
      );
      console.error("[convex-env-sync] Regenerate with: node generateKeys.mjs");
      process.exit(1);
    }
    return raw;
  } catch {
    console.error("[convex-env-sync] JWKS is not valid JSON.");
    process.exit(1);
  }
}

let synced = 0;
for (const key of variablesToSync) {
  const value = process.env[key];
  if (!value) {
    continue;
  }

  let valueToSync = value;
  if (key === "JWKS") {
    valueToSync = validateJwksDocArray(value);
  }

  const result = spawnSync("npx", ["convex", "env", "set", key], {
    input: valueToSync,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`[convex-env-sync] Failed syncing ${key}.`);
    if (result.stderr) {
      console.error(result.stderr.trim());
    }
    process.exit(result.status ?? 1);
  }
  synced += 1;
}

console.log(`[convex-env-sync] Synced ${synced} environment variables.`);
