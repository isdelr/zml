import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { NextResponse } from "next/server";
import { B2Storage } from "@/convex/b2Storage";
import { toErrorMessage } from "@/lib/errors";
import { storageBodyToNodeReadable } from "@/lib/storage/object-body";
import {
  AAC_CONTENT_TYPE,
  buildTempAudioPath,
  transcodeToAac,
} from "@/lib/submission/audio-transcode";
import { generateWaveformJsonFromAudioFile } from "@/lib/submission/server-waveform";

const storage = new B2Storage();

type MigrationPayload = {
  songFileKey?: string;
};

async function writeBodyToDisk(body: unknown, filePath: string) {
  if (!body) {
    throw new Error("Missing source audio body.");
  }

  const inputStream =
    body instanceof Readable
      ? body
      : Readable.fromWeb(
          body as unknown as NodeReadableStream<Uint8Array>,
        );
  await pipeline(inputStream, createWriteStream(filePath));
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: MigrationPayload;
  try {
    payload = (await request.json()) as MigrationPayload;
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid migration payload.",
        message: toErrorMessage(error),
      },
      { status: 400 },
    );
  }

  if (!payload.songFileKey) {
    return NextResponse.json(
      { error: "Missing required field: songFileKey." },
      { status: 400 },
    );
  }

  const inputPath = buildTempAudioPath(".input");
  const outputPath = buildTempAudioPath(".m4a");

  try {
    const sourceObject = await storage.getObject(payload.songFileKey);
    await writeBodyToDisk(
      sourceObject.Body
        ? storageBodyToNodeReadable(sourceObject.Body)
        : null,
      inputPath,
    );
    await transcodeToAac(inputPath, outputPath);
    const waveformJson = await generateWaveformJsonFromAudioFile(outputPath);

    const newKey = `submissions/audio/${randomUUID()}.m4a`;
    const { size: outputSize } = await fs.stat(outputPath);
    await storage.putObject(newKey, createReadStream(outputPath), {
      contentType: AAC_CONTENT_TYPE,
      contentLength: outputSize,
    });

    return NextResponse.json({
      key: newKey,
      contentType: AAC_CONTENT_TYPE,
      waveformJson,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to migrate song file.",
        message: toErrorMessage(error),
      },
      { status: 500 },
    );
  } finally {
    await Promise.allSettled([fs.unlink(inputPath), fs.unlink(outputPath)]);
  }
}
