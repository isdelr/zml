import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { getToken } from "@convex-dev/better-auth/utils";
import { NextResponse } from "next/server";
import { B2Storage } from "@/convex/b2Storage";
import { firstNonEmpty } from "@/lib/env";
import { toErrorMessage } from "@/lib/errors";
import { captureServerException } from "@/lib/observability/server";
import {
  isSupportedAudioUploadType,
  SUPPORTED_AUDIO_UPLOAD_EXTENSIONS,
} from "@/lib/submission/audio-file-types";
import {
  MAX_SONG_SIZE_BYTES,
  MAX_SONG_SIZE_MB,
} from "@/lib/submission/constants";
import {
  AAC_BITRATE,
  AAC_CODEC,
  AAC_CONTENT_TYPE,
  buildTempAudioPath,
  transcodeToAac,
} from "@/lib/submission/audio-transcode";

const storage = new B2Storage();
const convexSiteUrl = firstNonEmpty(
  process.env.CONVEX_SITE_URL,
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  "http://localhost:3211",
)!;

function toSafeExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return ext.replace(/[^a-z0-9.]/g, "");
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

  const inputPath = buildTempAudioPath(toSafeExtension(file.name) || ".input");
  const outputPath = buildTempAudioPath(".m4a");

  try {
    await writeBrowserFileToDisk(file, inputPath);
    await transcodeToAac(inputPath, outputPath);

    const { size: outputSize } = await fs.stat(outputPath);
    const key = `submissions/audio/${randomUUID()}.m4a`;
    await storage.putObject(key, createReadStream(outputPath), {
      contentType: AAC_CONTENT_TYPE,
      contentLength: outputSize,
    });

    return NextResponse.json({
      key,
      contentType: AAC_CONTENT_TYPE,
      codec: AAC_CODEC,
      bitrate: AAC_BITRATE,
    });
  } catch (error) {
    captureServerException(error, {
      tags: {
        route: "/api/submissions/upload-song-file",
      },
      extras: {
        fileName: file.name,
        fileSize: file.size,
      },
    });
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
