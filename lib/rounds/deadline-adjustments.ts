export type DeadlineAdjustmentDirection = "increase" | "decrease";

export type DeadlineAdjustmentPreset = {
  days: number;
  hours: number;
};

export const DEADLINE_ADJUSTMENT_PRESETS: DeadlineAdjustmentPreset[] = [
  { days: 0, hours: 1 },
  { days: 0, hours: 6 },
  { days: 0, hours: 12 },
  { days: 1, hours: 0 },
  { days: 1, hours: 1 },
  { days: 2, hours: 0 },
];

export function getDeadlineAdjustmentHours(
  preset: DeadlineAdjustmentPreset,
): number {
  return preset.days * 24 + preset.hours;
}

export function formatDeadlineAdjustment(
  preset: DeadlineAdjustmentPreset,
): string {
  const parts: string[] = [];

  if (preset.days > 0) {
    parts.push(`${preset.days} day${preset.days === 1 ? "" : "s"}`);
  }

  if (preset.hours > 0) {
    parts.push(`${preset.hours} hour${preset.hours === 1 ? "" : "s"}`);
  }

  return parts.join(" ") || "0 hours";
}

export function getSignedDeadlineAdjustmentLabel(
  direction: DeadlineAdjustmentDirection,
  preset: DeadlineAdjustmentPreset,
): string {
  const sign = direction === "increase" ? "+" : "-";
  return `${sign}${formatDeadlineAdjustment(preset)}`;
}

export function getAdjustedDeadline(
  deadline: number,
  direction: DeadlineAdjustmentDirection,
  preset: DeadlineAdjustmentPreset,
): number {
  const adjustmentMs = getDeadlineAdjustmentHours(preset) * 60 * 60 * 1000;
  return direction === "increase"
    ? deadline + adjustmentMs
    : deadline - adjustmentMs;
}
