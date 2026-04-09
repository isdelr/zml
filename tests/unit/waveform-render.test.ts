import { describe, expect, it, vi } from "vitest";
import WaveformData from "waveform-data";
import { getCachedWaveformBars } from "@/lib/music/waveform-render";

function createWaveform(data: number[]) {
  return WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: 4000,
    samples_per_pixel: 256,
    bits: 16,
    length: data.length / 2,
    data,
  });
}

describe("waveform render helpers", () => {
  it("preserves local peaks when downsampling to a smaller display width", () => {
    const waveform = createWaveform([
      -100,
      100,
      -150,
      150,
      -28000,
      28000,
      -120,
      120,
      -90,
      90,
      -80,
      80,
      -70,
      70,
      -60,
      60,
    ]);

    const displayBars = getCachedWaveformBars(waveform, 2);

    expect(displayBars.barCount).toBe(2);
    expect(displayBars.bars[0]?.minSample).toBe(-28000);
    expect(displayBars.bars[0]?.maxSample).toBe(28000);
    expect(Math.abs(displayBars.bars[1]?.minSample ?? 0)).toBeLessThan(1000);
    expect(Math.abs(displayBars.bars[1]?.maxSample ?? 0)).toBeLessThan(1000);
  });

  it("caches width-resampled bars so repeated draws do not resample again", () => {
    const waveform = createWaveform([
      -100,
      100,
      -200,
      200,
      -300,
      300,
      -400,
      400,
    ]);
    const resampleSpy = vi.spyOn(waveform, "resample");

    const firstBars = getCachedWaveformBars(waveform, 2);
    const secondBars = getCachedWaveformBars(waveform, 2);

    expect(firstBars).toBe(secondBars);
    expect(resampleSpy).toHaveBeenCalledTimes(1);
  });
});
