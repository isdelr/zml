import { PlusCircle } from "lucide-react";
import { useFieldArray, useWatch } from "react-hook-form";
import { createDefaultRound } from "@/lib/leagues/create-league-form";
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Rounds</h3>
          <Badge variant="secondary">Required</Badge>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => append(createDefaultRound())}>
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
            onRemove={() => remove(index)}
            previewUrl={previews[index]}
            setPreviews={setPreviews}
            isAlbumMode={watchedRounds?.[index]?.submissionMode === "album"}
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
