import { describe, expect, it } from "vitest";
import {
  createWaveformJsonAccumulator,
  WAVEFORM_SAMPLE_RATE,
  WAVEFORM_SAMPLES_PER_PIXEL,
} from "@/lib/submission/server-waveform";

function encodePcm16(samples: number[]) {
  const buffer = Buffer.alloc(samples.length * 2);

  samples.forEach((sample, index) => {
    buffer.writeInt16LE(sample, index * 2);
  });

  return buffer;
}

describe("server waveform generation", () => {
  it("emits a v2 16-bit waveform payload with consistent metadata", () => {
    const accumulator = createWaveformJsonAccumulator({
      sampleRate: WAVEFORM_SAMPLE_RATE,
      samplesPerPixel: 4,
    });

    accumulator.pushChunk(
      encodePcm16([0, 1000, -2000, 3000, 4000, -5000, 6000, -7000]),
    );

    const waveform = accumulator.finish();

    expect(waveform).toEqual({
      version: 2,
      channels: 1,
      sample_rate: WAVEFORM_SAMPLE_RATE,
      samples_per_pixel: 4,
      bits: 16,
      length: 2,
      data: [-2000, 3000, -7000, 6000],
    });
    expect(waveform.data.length).toBe(waveform.length * waveform.channels * 2);
  });

  it("handles odd chunk boundaries without corrupting bucket peaks", () => {
    const accumulator = createWaveformJsonAccumulator({
      sampleRate: 4000,
      samplesPerPixel: 2,
    });
    const pcmBuffer = encodePcm16([100, -200, 300, -400]);

    accumulator.pushChunk(pcmBuffer.subarray(0, 3));
    accumulator.pushChunk(pcmBuffer.subarray(3, 5));
    accumulator.pushChunk(pcmBuffer.subarray(5));

    const waveform = accumulator.finish();

    expect(waveform.samples_per_pixel).toBe(2);
    expect(waveform.sample_rate).toBe(4000);
    expect(waveform.bits).toBe(16);
    expect(waveform.length).toBe(2);
    expect(waveform.data).toEqual([-200, 100, -400, 300]);
  });

  it("uses the default samples-per-pixel value when none is provided", () => {
    const accumulator = createWaveformJsonAccumulator();
    accumulator.pushChunk(encodePcm16([1200, -1200]));

    const waveform = accumulator.finish();

    expect(waveform.samples_per_pixel).toBe(WAVEFORM_SAMPLES_PER_PIXEL);
    expect(waveform.sample_rate).toBe(WAVEFORM_SAMPLE_RATE);
    expect(waveform.bits).toBe(16);
  });
});
