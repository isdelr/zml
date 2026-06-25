export type DurationParts = {
  days: number;
  hours: number;
  minutes: number;
};

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const MIN_ROUND_DURATION_MINUTES = 10;
export const DEFAULT_SUBMISSION_DURATION_MINUTES = 7 * 24 * 60;
export const DEFAULT_VOTING_DURATION_MINUTES = 3 * 24 * 60;
export const DEFAULT_EXTENSION_DURATION_MINUTES = 24 * 60;

export const DURATION_PRESETS_MINUTES = [
  15,
  30,
  60,
  6 * 60,
  24 * 60,
] as const;

function toNonNegativeInteger(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.floor(numberValue)
    : 0;
}

export function durationPartsToMinutes(parts: Partial<DurationParts>): number {
  return (
    toNonNegativeInteger(parts.days) * 24 * 60 +
    toNonNegativeInteger(parts.hours) * 60 +
    toNonNegativeInteger(parts.minutes)
  );
}

export function durationMinutesToParts(totalMinutes: number): DurationParts {
  const normalizedMinutes = toNonNegativeInteger(totalMinutes);
  const days = Math.floor(normalizedMinutes / (24 * 60));
  const hours = Math.floor((normalizedMinutes % (24 * 60)) / 60);
  const minutes = normalizedMinutes % 60;

  return { days, hours, minutes };
}

export function durationMinutesToMs(totalMinutes: number): number {
  return toNonNegativeInteger(totalMinutes) * MINUTE_MS;
}

export function durationMsToMinutes(durationMs: number): number {
  return Number.isFinite(durationMs) && durationMs > 0
    ? Math.round(durationMs / MINUTE_MS)
    : 0;
}

export function legacyHoursToDurationMinutes(hours: number | null | undefined): number {
  return Number.isFinite(hours)
    ? Math.max(0, Math.round((hours as number) * 60))
    : 0;
}

export function durationMinutesToLegacyHours(minutes: number): number {
  return toNonNegativeInteger(minutes) / 60;
}

export function isWholeMinutes(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value)
  );
}

export function getEffectiveDurationMinutes(args: {
  durationMinutes?: number | null;
  legacyHours?: number | null;
  fallbackMinutes: number;
}): number {
  const durationMinutes = toNonNegativeInteger(args.durationMinutes);
  if (durationMinutes > 0) {
    return durationMinutes;
  }

  const legacyMinutes = legacyHoursToDurationMinutes(args.legacyHours);
  return legacyMinutes > 0 ? legacyMinutes : args.fallbackMinutes;
}

function formatUnit(value: number, unit: "day" | "hour" | "minute"): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

export function formatDurationMinutes(totalMinutes: number): string {
  const parts = durationMinutesToParts(totalMinutes);
  const labels: string[] = [];

  if (parts.days > 0) {
    labels.push(formatUnit(parts.days, "day"));
  }
  if (parts.hours > 0) {
    labels.push(formatUnit(parts.hours, "hour"));
  }
  if (parts.minutes > 0) {
    labels.push(formatUnit(parts.minutes, "minute"));
  }

  return labels.join(" ") || "0 minutes";
}

export function formatDurationMs(durationMs: number): string {
  return formatDurationMinutes(durationMsToMinutes(durationMs));
}

export function getDurationValidationMessage(
  totalMinutes: number,
  minMinutes = MIN_ROUND_DURATION_MINUTES,
): string | null {
  if (!Number.isFinite(totalMinutes) || totalMinutes < minMinutes) {
    return `Must be at least ${formatDurationMinutes(minMinutes)}.`;
  }

  return null;
}
