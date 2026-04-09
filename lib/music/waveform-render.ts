import WaveformData from "waveform-data";

export type WaveformBar = {
  minSample: number;
  maxSample: number;
};

export type CachedWaveformBars = {
  barCount: number;
  bits: number;
  bars: WaveformBar[];
};

const waveformBarCache = new WeakMap<WaveformData, Map<number, CachedWaveformBars>>();

function extractBarsFromWaveform(waveform: WaveformData): WaveformBar[] {
  const channel = waveform.channel(0);

  return Array.from({ length: waveform.length }, (_, index) => ({
    minSample: channel.min_sample(index),
    maxSample: channel.max_sample(index),
  }));
}

function expandWaveformToBars(waveform: WaveformData, barCount: number): WaveformBar[] {
  const channel = waveform.channel(0);
  const sourceLength = waveform.length;

  return Array.from({ length: barCount }, (_, index) => {
    const startIndex = Math.floor((index * sourceLength) / barCount);
    const endIndex = Math.max(
      startIndex + 1,
      Math.min(
        sourceLength,
        Math.ceil(((index + 1) * sourceLength) / barCount),
      ),
    );

    let minSample = 0;
    let maxSample = 0;

    for (let sampleIndex = startIndex; sampleIndex < endIndex; sampleIndex += 1) {
      minSample = Math.min(minSample, channel.min_sample(sampleIndex));
      maxSample = Math.max(maxSample, channel.max_sample(sampleIndex));
    }

    return {
      minSample,
      maxSample,
    };
  });
}

export function getWaveformAmplitudeScale(bits: number) {
  const amplitude = 2 ** (Math.max(1, bits) - 1);

  return {
    positiveMax: Math.max(1, amplitude - 1),
    negativeMax: amplitude,
  };
}

export function getCachedWaveformBars(
  waveform: WaveformData,
  requestedBarCount: number,
): CachedWaveformBars {
  const barCount = Math.max(1, Math.floor(requestedBarCount));
  const existingCache = waveformBarCache.get(waveform);
  const cachedBars = existingCache?.get(barCount);
  if (cachedBars) {
    return cachedBars;
  }

  let bars: WaveformBar[];
  let bits = waveform.bits;

  if (waveform.length === 0) {
    bars = [];
  } else if (barCount < waveform.length) {
    const resampledWaveform = waveform.resample({ width: barCount });
    bits = resampledWaveform.bits;
    bars = extractBarsFromWaveform(resampledWaveform);
  } else if (barCount === waveform.length) {
    bars = extractBarsFromWaveform(waveform);
  } else {
    bars = expandWaveformToBars(waveform, barCount);
  }

  const result: CachedWaveformBars = {
    barCount: bars.length,
    bits,
    bars,
  };

  const waveformCache = existingCache ?? new Map<number, CachedWaveformBars>();
  waveformCache.set(barCount, result);
  if (!existingCache) {
    waveformBarCache.set(waveform, waveformCache);
  }

  return result;
}
