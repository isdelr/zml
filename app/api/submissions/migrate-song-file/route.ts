import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { NextResponse } from "next/server";
import { B2Storage } from "@/convex/b2Storage";
import { toErrorMessage } from "@/lib/errors";
import {
  AAC_CONTENT_TYPE,
  buildTempAudioPath,
  transcodeToAac,
} from "@/lib/submission/audio-transcode";

const storage = new B2Storage();

type MigrationPayload = {
  songFileKey?: string;
};

async function writeResponseToDisk(response: Response, filePath: string) {
  if (!response.body) {
    throw new Error("Missing source audio body.");
  }

  const inputStream = Readable.fromWeb(
    response.body as unknown as NodeReadableStream<Uint8Array>,
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
    const sourceUrl = await storage.getUrl(payload.songFileKey);
    const sourceResponse = await fetch(sourceUrl, {
      cache: "no-store",
      redirect: "follow",
    });
    if (!sourceResponse.ok) {
      return NextResponse.json(
        {
          error: "Failed to fetch source audio.",
          status: sourceResponse.status,
        },
        { status: 502 },
      );
    }

    await writeResponseToDisk(sourceResponse, inputPath);
    await transcodeToAac(inputPath, outputPath);

    const newKey = `submissions/audio/${randomUUID()}.m4a`;
    const { size: outputSize } = await fs.stat(outputPath);
    await storage.putObject(newKey, createReadStream(outputPath), {
      contentType: AAC_CONTENT_TYPE,
      contentLength: outputSize,
    });

    return NextResponse.json({
      key: newKey,
      contentType: AAC_CONTENT_TYPE,
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
