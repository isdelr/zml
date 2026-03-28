import { createWriteStream, promises as fs } from "node:fs";
import { pipeline } from "node:stream/promises";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { Id } from "@/convex/_generated/dataModel";
import { B2Storage } from "@/convex/b2Storage";
import { api } from "@/lib/convex/api";
import { toErrorMessage } from "@/lib/errors";
import { verifyMediaAccessToken } from "@/lib/media/delivery";
import {
  buildTempAudioPath,
} from "@/lib/submission/audio-transcode";
import { generateWaveformJsonFromAudioFile } from "@/lib/submission/server-waveform";
import { storageBodyToNodeReadable } from "@/lib/storage/object-body";

const storage = new B2Storage();
const convex = new ConvexHttpClient(
  (process.env.CONVEX_SELF_HOSTED_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL)!,
);

type GenerateWaveformPayload = {
  submissionId?: string;
  mediaUrl?: string;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: GenerateWaveformPayload;
  try {
    payload = (await request.json()) as GenerateWaveformPayload;
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid waveform generation payload.",
        message: toErrorMessage(error),
      },
      { status: 400 },
    );
  }

  if (!payload.submissionId || !payload.mediaUrl) {
    return NextResponse.json(
      { error: "Missing required fields: submissionId and mediaUrl." },
      { status: 400 },
    );
  }

  let mediaUrl: URL;
  try {
    mediaUrl = new URL(payload.mediaUrl, request.url);
  } catch {
    return NextResponse.json(
      { error: "Invalid mediaUrl." },
      { status: 400 },
    );
  }

  const mediaToken = mediaUrl.searchParams.get("mediaToken");
  if (!mediaToken) {
    return NextResponse.json(
      { error: "Missing media token." },
      { status: 400 },
    );
  }

  const tokenPayload = await verifyMediaAccessToken(mediaToken);
  if (
    !tokenPayload ||
    tokenPayload.assetKind !== "audio" ||
    tokenPayload.submissionId !== payload.submissionId ||
    tokenPayload.expiresAt <= Date.now()
  ) {
    return NextResponse.json(
      { error: "Invalid or expired media token." },
      { status: 403 },
    );
  }

  const inputPath = buildTempAudioPath(".waveform-input");

  try {
    const sourceObject = await storage.getObject(tokenPayload.storageKey);
    if (!sourceObject.Body) {
      return NextResponse.json(
        { error: "Missing source audio body." },
        { status: 502 },
      );
    }

    await pipeline(
      storageBodyToNodeReadable(sourceObject.Body),
      createWriteStream(inputPath),
    );

    const waveformJson = await generateWaveformJsonFromAudioFile(inputPath);
    await convex.mutation(api.submissions.storeWaveform, {
      submissionId: payload.submissionId as Id<"submissions">,
      waveformJson,
    });

    return NextResponse.json({ waveformJson });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate waveform.",
        message: toErrorMessage(error),
      },
      { status: 500 },
    );
  } finally {
    await Promise.allSettled([fs.unlink(inputPath)]);
  }
}
