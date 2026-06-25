"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DURATION_PRESETS_MINUTES,
  durationMinutesToParts,
  durationPartsToMinutes,
  formatDurationMinutes,
  type DurationParts,
} from "@/lib/time/duration";
import { cn } from "@/lib/utils";

type DurationPickerPreset = {
  minutes: number;
  label?: string;
};

type DurationPickerProps = {
  value: number | null | undefined;
  onChange: (minutes: number) => void;
  disabled?: boolean;
  minMinutes?: number;
  showPresets?: boolean;
  presets?: readonly DurationPickerPreset[];
  className?: string;
  inputClassName?: string;
};

const DEFAULT_PRESETS: DurationPickerPreset[] = DURATION_PRESETS_MINUTES.map(
  (minutes) => ({ minutes }),
);

function parsePartValue(value: string): number {
  if (!value.trim()) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function toInputValue(value: number): string {
  return value > 0 ? String(value) : "";
}

export function DurationPicker({
  value,
  onChange,
  disabled = false,
  minMinutes,
  showPresets = true,
  presets = DEFAULT_PRESETS,
  className,
  inputClassName,
}: DurationPickerProps) {
  const parts = durationMinutesToParts(value ?? 0);

  const updatePart = (part: keyof DurationParts, rawValue: string) => {
    onChange(
      durationPartsToMinutes({
        ...parts,
        [part]: parsePartValue(rawValue),
      }),
    );
  };

  const effectivePresets =
    minMinutes === undefined
      ? presets
      : presets.filter((preset) => preset.minutes >= minMinutes);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-3 gap-3">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Days</span>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="0"
            value={toInputValue(parts.days)}
            onChange={(event) => updatePart("days", event.target.value)}
            disabled={disabled}
            className={inputClassName}
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Hours</span>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="0"
            value={toInputValue(parts.hours)}
            onChange={(event) => updatePart("hours", event.target.value)}
            disabled={disabled}
            className={inputClassName}
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Minutes</span>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="0"
            value={toInputValue(parts.minutes)}
            onChange={(event) => updatePart("minutes", event.target.value)}
            disabled={disabled}
            className={inputClassName}
          />
        </label>
      </div>

      {showPresets && effectivePresets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {effectivePresets.map((preset) => (
            <Button
              key={preset.minutes}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onChange(preset.minutes)}
            >
              {preset.label ?? formatDurationMinutes(preset.minutes)}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
