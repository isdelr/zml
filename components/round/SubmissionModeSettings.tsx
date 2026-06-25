"use client";

import { useCallback, useEffect } from "react";
import { ListOrdered, Music2, Shuffle } from "lucide-react";
import {
  useWatch,
  type FieldPath,
  type FieldPathValue,
  type FieldValues,
  type Control,
  type UseFormReturn,
} from "react-hook-form";
import {
  MAX_SUBMISSIONS_PER_USER,
  MIN_MULTI_SUBMISSIONS_PER_USER,
  type RoundSubmissionMode,
} from "@/lib/rounds/submission-settings";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type SubmissionModeSettingsProps<
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues | undefined = undefined,
> = {
  form: UseFormReturn<TFieldValues, unknown, TTransformedValues>;
  submissionsPerUserName: FieldPath<TFieldValues>;
  submissionModeName: FieldPath<TFieldValues>;
  disabled?: boolean;
  className?: string;
};

const modeOptions: Array<{
  value: RoundSubmissionMode;
  label: string;
  Icon: typeof Music2;
}> = [
  { value: "single", label: "Single song", Icon: Music2 },
  { value: "multi", label: "Multiple songs", Icon: Shuffle },
  { value: "album", label: "Album order", Icon: ListOrdered },
];

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }
  return Number.NaN;
}

function isSubmissionMode(value: unknown): value is RoundSubmissionMode {
  return value === "single" || value === "multi" || value === "album";
}

function ModeIllustration({
  mode,
  selected,
}: {
  mode: RoundSubmissionMode;
  selected: boolean;
}) {
  if (mode === "single") {
    return (
      <div className="mt-3 space-y-1.5" aria-hidden="true">
        <div
          className={cn(
            "h-2.5 rounded-full",
            selected ? "bg-primary" : "bg-muted-foreground/40",
          )}
        />
        <div className="h-2.5 rounded-full bg-muted" />
        <div className="h-2.5 rounded-full bg-muted" />
      </div>
    );
  }

  if (mode === "multi") {
    return (
      <div className="mt-3 space-y-1.5" aria-hidden="true">
        <div className="h-2.5 rounded-full bg-info/80" />
        <div className="h-2.5 rounded-full bg-primary/80" />
        <div className="h-2.5 rounded-full bg-highlight/80" />
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-1.5" aria-hidden="true">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">1</span>
        <div className="h-2.5 flex-1 rounded-full bg-primary/80" />
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">2</span>
        <div className="h-2.5 flex-1 rounded-full bg-info/80" />
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">3</span>
        <div className="h-2.5 flex-1 rounded-full bg-highlight/80" />
      </div>
    </div>
  );
}

export function SubmissionModeSettings<
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues | undefined = undefined,
>({
  form,
  submissionsPerUserName,
  submissionModeName,
  disabled,
  className,
}: SubmissionModeSettingsProps<TFieldValues, TTransformedValues>) {
  const submissionModeValue = useWatch({
    control: form.control,
    name: submissionModeName,
  });
  const submissionsPerUserValue = useWatch({
    control: form.control,
    name: submissionsPerUserName,
  });
  const selectedMode = isSubmissionMode(submissionModeValue)
    ? submissionModeValue
    : "single";
  const submissionsPerUser = toNumber(submissionsPerUserValue);
  const control = form.control as unknown as Control<TFieldValues>;

  const setSubmissionMode = useCallback(
    (nextMode: RoundSubmissionMode, shouldDirty = true) => {
      form.setValue(
        submissionModeName,
        nextMode as FieldPathValue<TFieldValues, typeof submissionModeName>,
        { shouldDirty, shouldValidate: true },
      );
    },
    [form, submissionModeName],
  );

  const setSubmissionsPerUser = useCallback(
    (nextValue: number, shouldDirty = true) => {
      form.setValue(
        submissionsPerUserName,
        nextValue as FieldPathValue<
          TFieldValues,
          typeof submissionsPerUserName
        >,
        { shouldDirty, shouldValidate: true },
      );
    },
    [form, submissionsPerUserName],
  );

  useEffect(() => {
    if (disabled) {
      return;
    }

    if (!Number.isFinite(submissionsPerUser)) {
      return;
    }

    if (submissionsPerUser === 1 && selectedMode !== "single") {
      setSubmissionMode("single", false);
      return;
    }

    if (submissionsPerUser > 1 && selectedMode === "single") {
      setSubmissionMode("multi", false);
    }
  }, [disabled, selectedMode, setSubmissionMode, submissionsPerUser]);

  const handleModeChange = (nextMode: RoundSubmissionMode) => {
    setSubmissionMode(nextMode);
    if (nextMode === "single") {
      setSubmissionsPerUser(1);
      return;
    }

    if (
      !Number.isFinite(submissionsPerUser) ||
      submissionsPerUser < MIN_MULTI_SUBMISSIONS_PER_USER
    ) {
      setSubmissionsPerUser(MIN_MULTI_SUBMISSIONS_PER_USER);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <FormField
        control={control}
        name={submissionsPerUserName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Songs per Participant</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={1}
                max={MAX_SUBMISSIONS_PER_USER}
                {...field}
                value={
                  typeof field.value === "number" ||
                  typeof field.value === "string"
                    ? field.value
                    : ""
                }
                disabled={disabled}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  field.onChange(nextValue);
                  const nextNumber = toNumber(nextValue);
                  if (!Number.isFinite(nextNumber) || nextNumber < 1) {
                    return;
                  }
                  if (nextNumber === 1) {
                    setSubmissionMode("single");
                  } else if (selectedMode === "single") {
                    setSubmissionMode("multi");
                  }
                }}
              />
            </FormControl>
            <FormDescription>
              How many songs each participant can submit
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={submissionModeName}
        render={() => (
          <FormItem className="w-full">
            <FormLabel>Submission Mode</FormLabel>
            <FormControl>
              <div className="grid gap-2 sm:grid-cols-3">
                {modeOptions.map(({ value, label, Icon }) => {
                  const selected = selectedMode === value;
                  return (
                    <Button
                      key={value}
                      type="button"
                      variant="outline"
                      disabled={disabled}
                      aria-pressed={selected}
                      className={cn(
                        "h-auto min-h-28 flex-col items-stretch justify-start gap-0 whitespace-normal p-3 text-left",
                        selected &&
                          "border-primary bg-primary/10 text-foreground",
                      )}
                      onClick={() => handleModeChange(value)}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Icon className="size-4" />
                        {label}
                      </span>
                      <ModeIllustration mode={value} selected={selected} />
                    </Button>
                  );
                })}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
