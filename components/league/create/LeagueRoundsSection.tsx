import { PlusCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { createDefaultRound } from "@/lib/leagues/create-league-form";
import {
  DEFAULT_SUBMISSION_DURATION_MINUTES,
  DEFAULT_VOTING_DURATION_MINUTES,
} from "@/lib/time/duration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoundCard } from "@/components/league/create/RoundCard";
import type { CreateLeagueForm, PreviewMapSetter } from "./form-types";

type LeagueRoundsSectionProps = {
  form: CreateLeagueForm;
  previews: Record<number, string>;
  setPreviews: PreviewMapSetter;
};

export function LeagueRoundsSection({
  form,
  previews,
  setPreviews,
}: LeagueRoundsSectionProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rounds",
  });
  const watchedRounds = useWatch({ control: form.control, name: "rounds" });
  const submissionDurationMinutes = useWatch({
    control: form.control,
    name: "submissionDurationMinutes",
  });
  const votingDurationMinutes = useWatch({
    control: form.control,
    name: "votingDurationMinutes",
  });
  const [expandedRoundIndex, setExpandedRoundIndex] = useState<number | null>(0);
  const defaultSubmissionDurationMinutes =
    typeof submissionDurationMinutes === "number"
      ? submissionDurationMinutes
      : undefined;
  const defaultVotingDurationMinutes =
    typeof votingDurationMinutes === "number"
      ? votingDurationMinutes
      : undefined;

  useEffect(() => {
    const rounds = form.getValues("rounds") ?? [];

    rounds.forEach((round, index) => {
      if (
        defaultSubmissionDurationMinutes !== undefined &&
        round.submissionDurationMinutes === defaultSubmissionDurationMinutes
      ) {
        form.setValue(
          `rounds.${index}.submissionDurationMinutes` as const,
          undefined,
          { shouldDirty: false, shouldValidate: false },
        );
      }

      if (
        defaultVotingDurationMinutes !== undefined &&
        round.votingDurationMinutes === defaultVotingDurationMinutes
      ) {
        form.setValue(
          `rounds.${index}.votingDurationMinutes` as const,
          undefined,
          { shouldDirty: false, shouldValidate: false },
        );
      }
    });
  }, [
    defaultSubmissionDurationMinutes,
    defaultVotingDurationMinutes,
    fields.length,
    form,
  ]);

  const handleAddRound = () => {
    setExpandedRoundIndex(fields.length);
    append(createDefaultRound());
  };

  const handleRemoveRound = (index: number) => {
    setPreviews((current) => {
      const removedPreview = current[index];
      if (removedPreview) {
        URL.revokeObjectURL(removedPreview);
      }

      return Object.fromEntries(
        Object.entries(current).flatMap(([key, value]) => {
          const currentIndex = Number(key);
          if (currentIndex < index) {
            return [[key, value]];
          }
          if (currentIndex > index) {
            return [[String(currentIndex - 1), value]];
          }
          return [];
        }),
      );
    });

    setExpandedRoundIndex((current) => {
      if (current === null) {
        return null;
      }
      if (current === index) {
        return index < fields.length - 1 ? index : Math.max(0, index - 1);
      }
      if (current > index) {
        return current - 1;
      }
      return current;
    });
    remove(index);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Rounds</h3>
          <Badge variant="secondary">Required</Badge>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleAddRound}>
          <PlusCircle className="mr-2 size-4" />
          Add Round
        </Button>
      </div>

      <div className="space-y-4">
        {fields.map((field, index) => (
          <RoundCard
            key={field.id}
            form={form}
            index={index}
            fieldsLength={fields.length}
            onRemove={() => handleRemoveRound(index)}
            previewUrl={previews[index]}
            setPreviews={setPreviews}
            isAlbumMode={watchedRounds?.[index]?.submissionMode === "album"}
            isExpanded={expandedRoundIndex === index}
            onToggle={() =>
              setExpandedRoundIndex((current) =>
                current === index ? null : index,
              )
            }
            title={watchedRounds?.[index]?.title}
            description={watchedRounds?.[index]?.description}
            defaultSubmissionDurationMinutes={
              defaultSubmissionDurationMinutes ??
              DEFAULT_SUBMISSION_DURATION_MINUTES
            }
            defaultVotingDurationMinutes={
              defaultVotingDurationMinutes ?? DEFAULT_VOTING_DURATION_MINUTES
            }
          />
        ))}
      </div>

      {form.formState.errors.rounds && (
        <p className="text-sm font-medium text-destructive">
          {(form.formState.errors.rounds as { message?: string }).message}
        </p>
      )}
    </div>
  );
}
