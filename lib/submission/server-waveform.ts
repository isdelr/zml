import { spawn } from "node:child_process";

const ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg";

const WAVEFORM_SAMPLE_RATE = 4000;
const WAVEFORM_SAMPLES_PER_PIXEL = 256;

type WaveformJson = {
  version: number;
  channels: number;
  sample_rate: number;
  samples_per_pixel: number;
  bits: number;
  length: number;
  data: number[];
};

function clampToInt8(value: number): number {
  return Math.max(-128, Math.min(127, Math.round(value)));
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

  const data: number[] = [];
  let leftover: Uint8Array = new Uint8Array(0);
  let bucketSampleCount = 0;
  let bucketMin = 32767;
  let bucketMax = -32768;
  const stderr: Buffer[] = [];

  const flushBucket = () => {
    if (bucketSampleCount === 0) {
      return;
    }

    data.push(
      clampToInt8(bucketMin / 256),
      clampToInt8(bucketMax / 256),
    );
    bucketSampleCount = 0;
    bucketMin = 32767;
    bucketMax = -32768;
  };

  await new Promise<void>((resolve, reject) => {
    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      const combined =
        leftover.length > 0
          ? Buffer.concat([Buffer.from(leftover), chunk])
          : chunk;
      const wholeByteLength = combined.length - (combined.length % 2);
      leftover = combined.subarray(wholeByteLength);

      for (let offset = 0; offset < wholeByteLength; offset += 2) {
        const sample = combined.readInt16LE(offset);
        bucketMin = Math.min(bucketMin, sample);
        bucketMax = Math.max(bucketMax, sample);
        bucketSampleCount += 1;

        if (bucketSampleCount >= WAVEFORM_SAMPLES_PER_PIXEL) {
          flushBucket();
        }
      }
    });

    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
    });

    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (leftover.length > 0) {
        bucketMin = Math.min(bucketMin, 0);
        bucketMax = Math.max(bucketMax, 0);
        bucketSampleCount += 1;
      }
      flushBucket();

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

  const waveform: WaveformJson = {
    version: 1,
    channels: 1,
    sample_rate: WAVEFORM_SAMPLE_RATE,
    samples_per_pixel: WAVEFORM_SAMPLES_PER_PIXEL,
    bits: 8,
    length: data.length / 2,
    data,
  };

  return JSON.stringify(waveform);
}
