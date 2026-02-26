#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".flac",
  ".opus",
]);

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
]);

const USAGE = `Usage:
  node scripts/dev-seed.mjs users [--env-file .env.docker.dev]
  node scripts/dev-seed.mjs seed [options]
  node scripts/dev-seed.mjs simulate [--namespace dev] [--ticks 5]
  node scripts/dev-seed.mjs reset [--namespace dev]

Seed options:
  --namespace <name>              Namespace tag (default: dev)
  --fake-users <n>                Number of generated fake users (default: 8)
  --user-id <id>                  Include real user by id (repeatable)
  --user-email <email>            Include real user by email (repeatable)
  --song <file>                   Add local song file (repeatable)
  --songs-dir <dir>               Recursively add songs from directory (repeatable)
  --cover <file>                  Add local cover image pool (repeatable)
  --covers-dir <dir>              Recursively add cover images from directory (repeatable)
  --manifest <json>               JSON manifest with song entries
  --max-songs <n>                 Limit uploaded songs (default: 24)
  --cleanup-first <true|false>    Reset namespace before seeding (default: true)
  --simulate <true|false>         Run simulation pass after seeding (default: true)
  --simulation-ticks <n>          Simulation cycles after seed (default: 2)
  --env-file <path>               Env file path (default: .env.docker.dev)

Manifest format:
  {
    "songs": [
      {
        "songPath": "/absolute/or/relative/path/to/song.mp3",
        "coverPath": "/optional/path/to/cover.jpg",
        "songTitle": "Optional Title",
        "artist": "Optional Artist",
        "duration": 210,
        "comment": "Optional comment",
        "lyrics": "Optional lyrics"
      }
    ]
  }`;

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    i += 1;
    if (parsed[key] === undefined) {
      parsed[key] = next;
    } else if (Array.isArray(parsed[key])) {
      parsed[key].push(next);
    } else {
      parsed[key] = [parsed[key], next];
    }
  }
  return parsed;
}

function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function getStringOption(parsed, key, fallback) {
  const value = parsed[key];
  if (value === undefined || value === true) return fallback;
  return String(value);
}

function getNumberOption(parsed, key, fallback) {
  const value = parsed[key];
  if (value === undefined || value === true) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function getBooleanOption(parsed, key, fallback) {
  const value = parsed[key];
  if (value === undefined) return fallback;
  if (value === true) return true;
  const lowered = String(value).toLowerCase();
  if (lowered === "true" || lowered === "1" || lowered === "yes") return true;
  if (lowered === "false" || lowered === "0" || lowered === "no") return false;
  return fallback;
}

function expandHome(filePath) {
  if (!filePath) return filePath;
  if (filePath === "~") return os.homedir();
  if (filePath.startsWith("~/")) return path.join(os.homedir(), filePath.slice(2));
  return filePath;
}

function resolvePath(filePath) {
  return path.resolve(process.cwd(), expandHome(filePath));
}

function loadEnv(parsed) {
  const envFile = getStringOption(parsed, "env-file", ".env.docker.dev");
  const resolved = resolvePath(envFile);
  if (fs.existsSync(resolved)) {
    dotenv.config({ path: resolved, override: false });
  }
  const envLocal = resolvePath(".env.local");
  if (fs.existsSync(envLocal)) {
    dotenv.config({ path: envLocal, override: false });
  }
  dotenv.config({ override: false });
}

function inferRegionFromEndpoint(endpoint) {
  try {
    const host = new URL(endpoint).hostname;
    const match = host.match(/^s3\.([^.]+)\.backblazeb2\.com$/);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

function getStorageConfigOrThrow() {
  const bucket = process.env.B2_BUCKET ?? process.env.R2_BUCKET;
  const endpoint = process.env.B2_ENDPOINT ?? process.env.R2_ENDPOINT;
  const accessKeyId =
    process.env.B2_KEY_ID ?? process.env.B2_APPLICATION_KEY_ID ?? process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.B2_APPLICATION_KEY ?? process.env.B2_KEY ?? process.env.R2_SECRET_ACCESS_KEY;

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing B2/R2 credentials. Set B2_BUCKET, B2_ENDPOINT, B2_KEY_ID, and B2_APPLICATION_KEY.",
    );
  }

  const isB2 = endpoint.includes("backblazeb2.com");
  const region =
    process.env.B2_REGION ?? process.env.AWS_REGION ?? inferRegionFromEndpoint(endpoint) ?? "auto";

  return {
    bucket,
    endpoint,
    accessKeyId,
    secretAccessKey,
    region,
    forcePathStyle: isB2,
  };
}

function createConvexClientOrThrow() {
  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL ??
    process.env.CONVEX_SELF_HOSTED_URL ??
    process.env.CONVEX_CLOUD_ORIGIN;
  const adminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY;
  if (!convexUrl) {
    throw new Error("Missing Convex URL. Set NEXT_PUBLIC_CONVEX_URL or CONVEX_SELF_HOSTED_URL.");
  }
  if (!adminKey) {
    throw new Error("Missing CONVEX_SELF_HOSTED_ADMIN_KEY.");
  }
  const client = new ConvexHttpClient(convexUrl);
  client.setAdminAuth(adminKey);
  return client;
}

async function walkDirectory(rootDir) {
  const out = [];
  async function visit(currentDir) {
    const entries = await fsp.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await visit(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  await visit(rootDir);
  return out;
}

async function collectFiles(options, singleKey, dirKey, validExts) {
  const files = new Set();

  for (const raw of asArray(options[singleKey])) {
    const resolved = resolvePath(raw);
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${resolved}`);
    }
    if (!fs.statSync(resolved).isFile()) {
      throw new Error(`Not a file: ${resolved}`);
    }
    if (validExts.has(path.extname(resolved).toLowerCase())) {
      files.add(resolved);
    }
  }

  for (const raw of asArray(options[dirKey])) {
    const dir = resolvePath(raw);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      throw new Error(`Directory not found: ${dir}`);
    }
    const discovered = await walkDirectory(dir);
    for (const file of discovered) {
      if (validExts.has(path.extname(file).toLowerCase())) {
        files.add(file);
      }
    }
  }

  return [...files];
}

function parseTitleArtistFromFile(filePath) {
  const base = path
    .basename(filePath, path.extname(filePath))
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const match = base.match(/^(.+)\s-\s(.+)$/);
  if (match) {
    return {
      artist: match[1].trim(),
      songTitle: match[2].trim(),
    };
  }
  return {
    artist: "Local Artist",
    songTitle: base || "Untitled Track",
  };
}

function estimateDurationSeconds(filePath) {
  const stat = fs.statSync(filePath);
  const bytesPerSecond = 24_000;
  return Math.max(75, Math.min(540, Math.round(stat.size / bytesPerSecond)));
}

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    case ".aac":
      return "audio/aac";
    case ".ogg":
      return "audio/ogg";
    case ".flac":
      return "audio/flac";
    case ".opus":
      return "audio/ogg";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".bmp":
      return "image/bmp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function escapeXml(input) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSvgCover(songTitle, artist) {
  const safeTitle = escapeXml(songTitle).slice(0, 48);
  const safeArtist = escapeXml(artist).slice(0, 48);
  const hue = Math.abs(hash(`${songTitle}:${artist}`)) % 360;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue}, 72%, 44%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 60) % 360}, 68%, 26%)"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#g)"/>
  <g fill="white" font-family="Arial, sans-serif">
    <text x="72" y="560" font-size="68" font-weight="700">${safeTitle}</text>
    <text x="72" y="638" font-size="42" opacity="0.9">${safeArtist}</text>
    <text x="72" y="1120" font-size="28" opacity="0.65">Generated by dev seed utility</text>
  </g>
</svg>`;
  return Buffer.from(svg, "utf8");
}

function hash(input) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return h;
}

async function uploadObject(storage, key, body, contentType) {
  await storage.client.send(
    new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

function makeKey(namespace, folder, filePathOrExt) {
  const ext = filePathOrExt.startsWith(".")
    ? filePathOrExt
    : path.extname(filePathOrExt).toLowerCase() || ".bin";
  return `dev-seed/${namespace}/${folder}/${Date.now()}-${crypto.randomUUID()}${ext}`;
}

async function findSiblingCover(songPath) {
  const dir = path.dirname(songPath);
  const base = path.basename(songPath, path.extname(songPath));
  for (const ext of IMAGE_EXTENSIONS) {
    const candidate = path.join(dir, `${base}${ext}`);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

async function loadManifestSongs(manifestPath) {
  if (!manifestPath) return [];
  const resolved = resolvePath(manifestPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Manifest file not found: ${resolved}`);
  }
  const raw = await fsp.readFile(resolved, "utf8");
  const parsed = JSON.parse(raw);
  const songs = Array.isArray(parsed) ? parsed : parsed?.songs;
  if (!Array.isArray(songs)) {
    throw new Error("Manifest must be an array or an object with a `songs` array.");
  }
  return songs.map((entry, index) => {
    if (!entry?.songPath) {
      throw new Error(`Manifest song at index ${index} is missing songPath.`);
    }
    return {
      songPath: resolvePath(entry.songPath),
      coverPath: entry.coverPath ? resolvePath(entry.coverPath) : null,
      songTitle: entry.songTitle ? String(entry.songTitle) : null,
      artist: entry.artist ? String(entry.artist) : null,
      duration: entry.duration !== undefined ? Number(entry.duration) : null,
      comment: entry.comment ? String(entry.comment) : null,
      lyrics: entry.lyrics ? String(entry.lyrics) : null,
    };
  });
}

function buildEntryList(manifestEntries, songFiles) {
  const fromManifest = manifestEntries.map((entry) => ({
    songPath: entry.songPath,
    coverPath: entry.coverPath,
    songTitle: entry.songTitle,
    artist: entry.artist,
    duration: entry.duration,
    comment: entry.comment,
    lyrics: entry.lyrics,
  }));
  const existing = new Set(fromManifest.map((entry) => entry.songPath));
  for (const songPath of songFiles) {
    if (existing.has(songPath)) continue;
    fromManifest.push({
      songPath,
      coverPath: null,
      songTitle: null,
      artist: null,
      duration: null,
      comment: null,
      lyrics: null,
    });
  }
  return fromManifest;
}

async function buildLocalAssetsForSeed(parsed, namespace) {
  const maxSongs = Math.max(1, Math.min(200, getNumberOption(parsed, "max-songs", 24)));
  const manifestEntries = await loadManifestSongs(getStringOption(parsed, "manifest", ""));
  const songFiles = await collectFiles(parsed, "song", "songs-dir", AUDIO_EXTENSIONS);
  const coverPool = await collectFiles(parsed, "cover", "covers-dir", IMAGE_EXTENSIONS);

  const entries = buildEntryList(manifestEntries, songFiles).slice(0, maxSongs);
  if (entries.length === 0) {
    return [];
  }

  const storageConfig = getStorageConfigOrThrow();
  const storage = {
    bucket: storageConfig.bucket,
    client: new S3Client({
      region: storageConfig.region,
      endpoint: storageConfig.endpoint,
      forcePathStyle: storageConfig.forcePathStyle,
      credentials: {
        accessKeyId: storageConfig.accessKeyId,
        secretAccessKey: storageConfig.secretAccessKey,
      },
    }),
  };

  const assets = [];
  let uploaded = 0;

  for (const entry of entries) {
    if (!fs.existsSync(entry.songPath) || !fs.statSync(entry.songPath).isFile()) {
      throw new Error(`Song file not found: ${entry.songPath}`);
    }

    const parsedMeta = parseTitleArtistFromFile(entry.songPath);
    const songTitle = entry.songTitle ?? parsedMeta.songTitle;
    const artist = entry.artist ?? parsedMeta.artist;
    const duration = Number.isFinite(entry.duration)
      ? Math.max(30, Math.floor(entry.duration))
      : estimateDurationSeconds(entry.songPath);

    let coverPath = entry.coverPath;
    if (!coverPath) {
      coverPath = await findSiblingCover(entry.songPath);
    }
    if (!coverPath && coverPool.length > 0) {
      coverPath = coverPool[uploaded % coverPool.length];
    }

    const songFileKey = makeKey(namespace, "songs", entry.songPath);
    await uploadObject(
      storage,
      songFileKey,
      fs.createReadStream(entry.songPath),
      guessContentType(entry.songPath),
    );

    let albumArtKey;
    if (coverPath) {
      if (!fs.existsSync(coverPath) || !fs.statSync(coverPath).isFile()) {
        throw new Error(`Cover file not found: ${coverPath}`);
      }
      albumArtKey = makeKey(namespace, "covers", coverPath);
      await uploadObject(
        storage,
        albumArtKey,
        fs.createReadStream(coverPath),
        guessContentType(coverPath),
      );
    } else {
      albumArtKey = makeKey(namespace, "covers", ".svg");
      const svg = buildSvgCover(songTitle, artist);
      await uploadObject(storage, albumArtKey, svg, "image/svg+xml");
    }

    assets.push({
      songTitle,
      artist,
      songFileKey,
      albumArtKey,
      duration,
      comment: entry.comment ?? `Local seed from ${path.basename(entry.songPath)}`,
      lyrics: entry.lyrics ?? undefined,
      waveform: undefined,
    });

    uploaded += 1;
    process.stdout.write(`Uploaded ${uploaded}/${entries.length}: ${path.basename(entry.songPath)}\n`);
  }

  return assets;
}

async function runUsers(parsed) {
  loadEnv(parsed);
  const client = createConvexClientOrThrow();
  const users = await client.query("devSeed:listUsers", {});
  if (!Array.isArray(users) || users.length === 0) {
    console.log("No users found.");
    return;
  }
  console.log("Users:");
  for (const user of users) {
    console.log(
      `- ${user.id} | ${user.name}${user.email ? ` <${user.email}>` : ""}${user.isGlobalAdmin ? " [admin]" : ""}`,
    );
  }
}

async function runSeed(parsed) {
  loadEnv(parsed);
  const namespace = getStringOption(parsed, "namespace", "dev");
  const fakeUsers = getNumberOption(parsed, "fake-users", 8);
  const cleanupFirst = getBooleanOption(parsed, "cleanup-first", true);
  const simulateActivity = getBooleanOption(parsed, "simulate", true);
  const simulationTicks = getNumberOption(parsed, "simulation-ticks", 2);
  const includeUserIds = asArray(parsed["user-id"]).map(String);
  const includeUserEmails = asArray(parsed["user-email"]).map(String);

  const localAssets = await buildLocalAssetsForSeed(parsed, namespace);
  const client = createConvexClientOrThrow();

  const payload = {
    namespace,
    cleanupFirst,
    fakeUsers,
    includeUserIds,
    includeUserEmails,
    localAssets,
    simulateActivity,
    simulationTicks,
  };

  const result = await client.mutation("devSeed:seedNamespace", payload);
  console.log("Seed complete:");
  console.log(JSON.stringify(result, null, 2));
}

async function runSimulate(parsed) {
  loadEnv(parsed);
  const client = createConvexClientOrThrow();
  const namespace = getStringOption(parsed, "namespace", "dev");
  const ticks = getNumberOption(parsed, "ticks", 3);
  const result = await client.mutation("devSeed:simulateNamespace", {
    namespace,
    ticks,
  });
  console.log("Simulation complete:");
  console.log(JSON.stringify(result, null, 2));
}

async function runReset(parsed) {
  loadEnv(parsed);
  const client = createConvexClientOrThrow();
  const namespace = getStringOption(parsed, "namespace", "dev");
  const result = await client.mutation("devSeed:resetNamespace", { namespace });
  console.log("Reset complete:");
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const command = parsed._[0] ?? "seed";

  if (command === "help" || command === "--help" || command === "-h") {
    console.log(USAGE);
    return;
  }

  if (command === "users") {
    await runUsers(parsed);
    return;
  }
  if (command === "seed") {
    await runSeed(parsed);
    return;
  }
  if (command === "simulate") {
    await runSimulate(parsed);
    return;
  }
  if (command === "reset") {
    await runReset(parsed);
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${USAGE}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
