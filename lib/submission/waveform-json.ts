export const CURRENT_WAVEFORM_JSON_VERSION = 2;
export const LEGACY_WAVEFORM_JSON_VERSION = 1;
export const CURRENT_WAVEFORM_BITS = 16;

export type WaveformJson = {
  version: number;
  channels: number;
  sample_rate: number;
  samples_per_pixel: number;
  bits: number;
  length: number;
  data: number[];
};

type ParseWaveformJsonOptions = {
  mode?: "header" | "full";
};

export type ParsedWaveformJson = {
  waveform: WaveformJson;
  isCurrent: boolean;
  isLegacy: boolean;
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function getBitDepthRange(bits: number) {
  const amplitude = 2 ** (bits - 1);
  return {
    min: -amplitude,
    max: amplitude - 1,
  };
}

function parseWaveformJsonObject(
  value: unknown,
  options?: ParseWaveformJsonOptions,
): ParsedWaveformJson | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const version = record.version;
  const channels = record.channels;
  const sampleRate = record.sample_rate;
  const samplesPerPixel = record.samples_per_pixel;
  const bits = record.bits;
  const length = record.length;
  const data = record.data;

  if (
    !isPositiveInteger(version) ||
    !isPositiveInteger(channels) ||
    !isPositiveInteger(sampleRate) ||
    !isPositiveInteger(samplesPerPixel) ||
    !isNonNegativeInteger(length) ||
    !Array.isArray(data)
  ) {
    return null;
  }

  if (bits !== 8 && bits !== 16) {
    return null;
  }

  const expectedDataLength = length * channels * 2;
  if (data.length !== expectedDataLength) {
    return null;
  }

  if (options?.mode !== "header") {
    const { min, max } = getBitDepthRange(bits);
    for (const sample of data) {
      if (
        typeof sample !== "number" ||
        !Number.isInteger(sample) ||
        sample < min ||
        sample > max
      ) {
        return null;
      }
    }
  }

  const waveform: WaveformJson = {
    version,
    channels,
    sample_rate: sampleRate,
    samples_per_pixel: samplesPerPixel,
    bits,
    length,
    data: data as number[],
  };

  const isCurrent =
    version === CURRENT_WAVEFORM_JSON_VERSION && bits === CURRENT_WAVEFORM_BITS;

  return {
    waveform,
    isCurrent,
    isLegacy: !isCurrent,
  };
}

export function parseWaveformJson(
  waveformJson: string | null | undefined,
  options?: ParseWaveformJsonOptions,
): ParsedWaveformJson | null {
  if (!waveformJson) {
    return null;
  }

  try {
    return parseWaveformJsonObject(JSON.parse(waveformJson), options);
  } catch {
    return null;
  }
}

export function getWaveformJsonStatus(
  waveformJson: string | null | undefined,
): "missing" | "invalid" | "legacy" | "current" {
  if (!waveformJson) {
    return "missing";
  }

  const parsed = parseWaveformJson(waveformJson);
  if (!parsed) {
    return "invalid";
  }

  return parsed.isCurrent ? "current" : "legacy";
}

export function shouldRegenerateCachedWaveform(
  waveformJson: string | null | undefined,
): boolean {
  return getWaveformJsonStatus(waveformJson) !== "current";
}
