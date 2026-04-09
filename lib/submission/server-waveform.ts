import { spawn } from "node:child_process";
import {
  CURRENT_WAVEFORM_BITS,
  CURRENT_WAVEFORM_JSON_VERSION,
  type WaveformJson,
} from "@/lib/submission/waveform-json";

const ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg";

export const WAVEFORM_SAMPLE_RATE = 4000;
export const WAVEFORM_SAMPLES_PER_PIXEL = 256;

function clampToInt16(value: number): number {
  return Math.max(-32768, Math.min(32767, Math.round(value)));
}

export function createWaveformJsonAccumulator(options?: {
  sampleRate?: number;
  samplesPerPixel?: number;
}) {
  const sampleRate = options?.sampleRate ?? WAVEFORM_SAMPLE_RATE;
  const samplesPerPixel =
    options?.samplesPerPixel ?? WAVEFORM_SAMPLES_PER_PIXEL;

  const data: number[] = [];
  let leftover: Uint8Array = new Uint8Array(0);
  let bucketSampleCount = 0;
  let bucketMin = 32767;
  let bucketMax = -32768;

  const flushBucket = () => {
    if (bucketSampleCount === 0) {
      return;
    }

    data.push(clampToInt16(bucketMin), clampToInt16(bucketMax));
    bucketSampleCount = 0;
    bucketMin = 32767;
    bucketMax = -32768;
  };

  const pushChunk = (chunk: Uint8Array) => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const combined =
      leftover.length > 0 ? Buffer.concat([Buffer.from(leftover), buffer]) : buffer;
    const wholeByteLength = combined.length - (combined.length % 2);
    leftover = combined.subarray(wholeByteLength);

    for (let offset = 0; offset < wholeByteLength; offset += 2) {
      const sample = combined.readInt16LE(offset);
      bucketMin = Math.min(bucketMin, sample);
      bucketMax = Math.max(bucketMax, sample);
      bucketSampleCount += 1;

      if (bucketSampleCount >= samplesPerPixel) {
        flushBucket();
      }
    }
  };

  const finish = (): WaveformJson => {
    if (leftover.length > 0) {
      bucketMin = Math.min(bucketMin, 0);
      bucketMax = Math.max(bucketMax, 0);
      bucketSampleCount += 1;
      leftover = new Uint8Array(0);
    }

    flushBucket();

    return {
      version: CURRENT_WAVEFORM_JSON_VERSION,
      channels: 1,
      sample_rate: sampleRate,
      samples_per_pixel: samplesPerPixel,
      bits: CURRENT_WAVEFORM_BITS,
      length: data.length / 2,
      data,
    };
  };

  return {
    pushChunk,
    finish,
  };
}

export async function generateWaveformJsonFromAudioFile(
  inputPath: string,
): Promise<string> {
  const ffmpeg = spawn(ffmpegPath, [
    "-v",
    "error",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    `${WAVEFORM_SAMPLE_RATE}`,
    "-f",
    "s16le",
    "pipe:1",
  ]);

  const stderr: Buffer[] = [];
  const accumulator = createWaveformJsonAccumulator();

  await new Promise<void>((resolve, reject) => {
    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      accumulator.pushChunk(chunk);
    });

    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
    });

    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          stderr.length > 0
            ? Buffer.concat(stderr).toString("utf8").trim()
            : `ffmpeg exited with code ${code ?? "unknown"}.`,
        ),
      );
    });
  });

  return JSON.stringify(accumulator.finish());
}
