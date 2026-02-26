import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { promisify } from "node:util";
import { getToken } from "@convex-dev/better-auth/utils";
import { NextResponse } from "next/server";
import { B2Storage } from "@/convex/b2Storage";
import { firstNonEmpty } from "@/lib/env";
import { toErrorMessage } from "@/lib/errors";
import {
  isSupportedAudioUploadType,
  SUPPORTED_AUDIO_UPLOAD_EXTENSIONS,
} from "@/lib/submission/audio-file-types";
import {
  MAX_SONG_SIZE_BYTES,
  MAX_SONG_SIZE_MB,
} from "@/lib/submission/constants";

const execFileAsync = promisify(execFile);
const storage = new B2Storage();
const convexSiteUrl = firstNonEmpty(
  process.env.CONVEX_SITE_URL,
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  "http://localhost:3211",
)!;
const ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg";
const OPUS_BITRATE = "160k";

function buildTempPath(suffix: string): string {
  return path.join(tmpdir(), `${randomUUID()}${suffix}`);
}

function toSafeExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return ext.replace(/[^a-z0-9.]/g, "");
}

async function transcodeToOpus(inputPath: string, outputPath: string) {
  await execFileAsync(ffmpegPath, [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-c:a",
    "libopus",
    "-b:a",
    OPUS_BITRATE,
    "-vbr",
    "on",
    "-compression_level",
    "10",
    "-application",
    "audio",
    outputPath,
  ]);
}

async function writeBrowserFileToDisk(file: File, filePath: string) {
  const inputStream = Readable.fromWeb(
    file.stream() as unknown as NodeReadableStream<Uint8Array>,
  );
  await pipeline(inputStream, createWriteStream(filePath));
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { token } = await getToken(convexSiteUrl, request.headers);
  if (!token) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to parse upload payload.",
        message: toErrorMessage(error),
      },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json(
      { error: "Audio file is empty." },
      { status: 400 },
    );
  }
  if (file.size > MAX_SONG_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `Audio file exceeds the ${MAX_SONG_SIZE_MB}MB limit.`,
      },
      { status: 413 },
    );
  }
  if (!isSupportedAudioUploadType(file)) {
    return NextResponse.json(
      {
        error: `Unsupported audio file type. Supported formats: ${SUPPORTED_AUDIO_UPLOAD_EXTENSIONS.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const inputPath = buildTempPath(toSafeExtension(file.name) || ".input");
  const outputPath = buildTempPath(".opus");

  try {
    await writeBrowserFileToDisk(file, inputPath);
    await transcodeToOpus(inputPath, outputPath);

    const { size: outputSize } = await fs.stat(outputPath);
    const key = `submissions/audio/${randomUUID()}.opus`;
    await storage.putObject(key, createReadStream(outputPath), {
      contentType: "audio/ogg",
      contentLength: outputSize,
    });

    return NextResponse.json({
      key,
      contentType: "audio/ogg",
      codec: "opus",
      bitrate: OPUS_BITRATE,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to process and upload audio file.",
        message: toErrorMessage(error),
      },
      { status: 500 },
    );
  } finally {
    await Promise.allSettled([fs.unlink(inputPath), fs.unlink(outputPath)]);
  }
}
