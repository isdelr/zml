import {
  durationMinutesToMs,
  durationPartsToMinutes,
  formatDurationMinutes,
  type DurationParts,
} from "@/lib/time/duration";

export type DeadlineAdjustmentDirection = "increase" | "decrease";

export type DeadlineAdjustmentPreset = DurationParts;

export const DEADLINE_ADJUSTMENT_PRESETS: DeadlineAdjustmentPreset[] = [
  { days: 0, hours: 0, minutes: 15 },
  { days: 0, hours: 0, minutes: 30 },
  { days: 0, hours: 1, minutes: 0 },
  { days: 0, hours: 6, minutes: 0 },
  { days: 1, hours: 0, minutes: 0 },
];

export function getDeadlineAdjustmentMinutes(
  preset: DeadlineAdjustmentPreset,
): number {
  return durationPartsToMinutes(preset);
}

export function formatDeadlineAdjustment(
  preset: DeadlineAdjustmentPreset,
): string {
  return formatDurationMinutes(getDeadlineAdjustmentMinutes(preset));
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
  const adjustmentMs = durationMinutesToMs(getDeadlineAdjustmentMinutes(preset));
  return direction === "increase"
    ? deadline + adjustmentMs
    : deadline - adjustmentMs;
}
