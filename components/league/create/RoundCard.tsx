import { ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DurationPicker } from "@/components/ui/duration-picker";
import { AlbumSettingsFields } from "@/components/league/create/AlbumSettingsFields";
import { RoundImagePicker } from "@/components/league/create/RoundImagePicker";
import { SubmissionModeSettings } from "@/components/round/SubmissionModeSettings";
import {
  MIN_ROUND_DURATION_MINUTES,
  formatDurationMinutes,
} from "@/lib/time/duration";
import { cn } from "@/lib/utils";
import type { CreateLeagueForm, PreviewMapSetter } from "./form-types";

type RoundCardProps = {
  form: CreateLeagueForm;
  index: number;
  fieldsLength: number;
  onRemove: () => void;
  previewUrl?: string;
  setPreviews: PreviewMapSetter;
  isAlbumMode: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  title?: string;
  description?: string;
  defaultSubmissionDurationMinutes: number;
  defaultVotingDurationMinutes: number;
};

export function RoundCard({
  form,
  index,
  fieldsLength,
  onRemove,
  previewUrl,
  setPreviews,
  isAlbumMode,
  isExpanded,
  onToggle,
  title,
  description,
  defaultSubmissionDurationMinutes,
  defaultVotingDurationMinutes,
}: RoundCardProps) {
  const displayTitle = title?.trim();
  const displayDescription = description?.trim();
  const summaryLabel = [
    `Round ${index + 1}`,
    displayTitle || "Untitled round",
    displayDescription,
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    <Card className="relative gap-0 py-0">
      <div className="flex items-center gap-2 p-3 sm:p-4">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={isExpanded}
          aria-label={summaryLabel}
          onClick={onToggle}
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              isExpanded && "rotate-180",
            )}
          />
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="shrink-0 text-sm font-semibold">
              Round {index + 1}
            </span>
            <span className="min-w-0 truncate text-sm">
              {displayTitle || "Untitled round"}
            </span>
            {displayDescription ? (
              <span className="min-w-0 truncate text-sm text-muted-foreground">
                {displayDescription}
              </span>
            ) : null}
          </span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
          disabled={fieldsLength <= 1}
          aria-label={`Delete round ${index + 1}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {isExpanded ? (
        <CardContent className="space-y-4 border-t px-4 pb-4 pt-4 sm:px-5">
        <div className="flex flex-col-reverse gap-6 md:flex-row">
          <div className="flex-1 space-y-4">
            <FormField
              control={form.control}
              name={`rounds.${index}.title`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Round Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Guilty Pleasures" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`rounds.${index}.description`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the theme of this round."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SubmissionModeSettings
              form={form}
              submissionsPerUserName={`rounds.${index}.submissionsPerUser`}
              submissionModeName={`rounds.${index}.submissionMode`}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name={`rounds.${index}.submissionDurationMinutes`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Submission Period</FormLabel>
                    <FormControl>
                      <DurationPicker
                        value={
                          (field.value as number | undefined) ??
                          defaultSubmissionDurationMinutes
                        }
                        onChange={field.onChange}
                        minMinutes={MIN_ROUND_DURATION_MINUTES}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      League default:{" "}
                      {formatDurationMinutes(defaultSubmissionDurationMinutes)}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`rounds.${index}.votingDurationMinutes`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voting Period</FormLabel>
                    <FormControl>
                      <DurationPicker
                        value={
                          (field.value as number | undefined) ??
                          defaultVotingDurationMinutes
                        }
                        onChange={field.onChange}
                        minMinutes={MIN_ROUND_DURATION_MINUTES}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      League default:{" "}
                      {formatDurationMinutes(defaultVotingDurationMinutes)}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="w-full md:w-52">
            <RoundImagePicker
              form={form}
              index={index}
              previewUrl={previewUrl}
              setPreviews={setPreviews}
            />
          </div>
        </div>

        {isAlbumMode && <AlbumSettingsFields form={form} index={index} />}
      </CardContent>
      ) : null}
    </Card>
  );
}
