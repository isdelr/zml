import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg";

export const AAC_BITRATE = "192k";
export const AAC_CODEC = "aac-lc";
export const AAC_CONTENT_TYPE = "audio/mp4";

export function buildTempAudioPath(suffix: string): string {
  return path.join(tmpdir(), `${randomUUID()}${suffix}`);
}

export async function transcodeToAac(inputPath: string, outputPath: string) {
  await execFileAsync(ffmpegPath, [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-c:a",
    "aac",
    "-profile:a",
    "aac_low",
    "-b:a",
    AAC_BITRATE,
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}
