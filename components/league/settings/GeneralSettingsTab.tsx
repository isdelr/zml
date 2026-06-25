"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Loader2, Info } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/convex/api";
import type { LeagueData } from "@/lib/convex/types";
import {
  leagueEditSchema,
  type LeagueEditInput,
  type LeagueEditOutput,
} from "@/lib/leagues/league-settings-form";
import {
  getDefaultNegativeVotesPerSubmission,
  getDefaultPositiveVotesPerSubmission,
} from "@/lib/leagues/vote-limits";
import {
  DEFAULT_SUBMISSION_DURATION_MINUTES,
  DEFAULT_VOTING_DURATION_MINUTES,
  MIN_ROUND_DURATION_MINUTES,
  getEffectiveDurationMinutes,
} from "@/lib/time/duration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DurationPicker } from "@/components/ui/duration-picker";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GeneralSettingsTabProps {
  league: LeagueData;
  onClose: () => void;
}

function toFiniteNumber(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function GeneralSettingsTab({
  league,
  onClose,
}: GeneralSettingsTabProps) {
  const updateLeague = useMutation(api.leagues.updateLeague);
  const form = useForm<LeagueEditInput, unknown, LeagueEditOutput>({
    resolver: zodResolver(leagueEditSchema),
    defaultValues: {
      name: league.name,
      description: league.description,
      isPublic: league.isPublic,
      submissionDurationMinutes: getEffectiveDurationMinutes({
        durationMinutes: league.submissionDurationMinutes,
        legacyHours: league.submissionDeadline,
        fallbackMinutes: DEFAULT_SUBMISSION_DURATION_MINUTES,
      }),
      votingDurationMinutes: getEffectiveDurationMinutes({
        durationMinutes: league.votingDurationMinutes,
        legacyHours: league.votingDeadline,
        fallbackMinutes: DEFAULT_VOTING_DURATION_MINUTES,
      }),
      maxPositiveVotes: league.maxPositiveVotes,
      maxNegativeVotes: league.maxNegativeVotes,
      limitVotesPerSubmission: league.limitVotesPerSubmission ?? false,
      maxPositiveVotesPerSubmission:
        league.maxPositiveVotesPerSubmission ??
        getDefaultPositiveVotesPerSubmission(league.maxPositiveVotes),
      maxNegativeVotesPerSubmission:
        league.maxNegativeVotesPerSubmission ??
        getDefaultNegativeVotesPerSubmission(league.maxNegativeVotes),
    },
  });

  const limitVotesPerSubmission = useWatch({
    control: form.control,
    name: "limitVotesPerSubmission",
  });
  const maxPositiveVotes = useWatch({
    control: form.control,
    name: "maxPositiveVotes",
  });
  const maxNegativeVotes = useWatch({
    control: form.control,
    name: "maxNegativeVotes",
  });
  const positiveVoteCapDefault = getDefaultPositiveVotesPerSubmission(
    toFiniteNumber(maxPositiveVotes, 1),
  );
  const negativeVoteCapDefault = getDefaultNegativeVotesPerSubmission(
    toFiniteNumber(maxNegativeVotes, 0),
  );
  const previousVoteCapDefaultsRef = useRef({
    positive: positiveVoteCapDefault,
    negative: negativeVoteCapDefault,
  });

  useEffect(() => {
    const previousDefaults = previousVoteCapDefaultsRef.current;
    const currentPositiveLimit = form.getValues(
      "maxPositiveVotesPerSubmission",
    );
    const currentNegativeLimit = form.getValues(
      "maxNegativeVotesPerSubmission",
    );

    if (
      currentPositiveLimit === undefined ||
      currentPositiveLimit === previousDefaults.positive
    ) {
      form.setValue("maxPositiveVotesPerSubmission", positiveVoteCapDefault, {
        shouldValidate: true,
      });
    }

    if (
      currentNegativeLimit === undefined ||
      currentNegativeLimit === previousDefaults.negative
    ) {
      form.setValue("maxNegativeVotesPerSubmission", negativeVoteCapDefault, {
        shouldValidate: true,
      });
    }

    previousVoteCapDefaultsRef.current = {
      positive: positiveVoteCapDefault,
      negative: negativeVoteCapDefault,
    };
  }, [form, negativeVoteCapDefault, positiveVoteCapDefault]);

  async function onSubmit(values: LeagueEditOutput) {
    toast.promise(updateLeague({ leagueId: league._id, ...values }), {
      loading: "Updating league...",
      success: (msg) => {
        onClose();
        return msg;
      },
      error: "Failed to update league.",
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">Basic Information</h3>
            <Badge variant="secondary">Required</Badge>
          </div>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>League Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 90s Rock Anthems" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe what this league is about..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isPublic"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-3">
                <div className="space-y-0.5">
                  <FormLabel>Public League</FormLabel>
                  <FormDescription>
                    Allow anyone to discover and join this league
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <Accordion type="multiple" defaultValue={["timing"]} className="w-full">
          <AccordionItem value="timing" className="mb-4 rounded-lg border px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">
                  Round Timing & Voting
                </span>
                <Badge variant="secondary">Important</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="submissionDurationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Submission Period</FormLabel>
                      <FormControl>
                        <DurationPicker
                          value={field.value as number}
                          onChange={field.onChange}
                          minMinutes={MIN_ROUND_DURATION_MINUTES}
                        />
                      </FormControl>
                      <FormDescription>
                        How long participants have to submit songs
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="votingDurationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voting Period</FormLabel>
                      <FormControl>
                        <DurationPicker
                          value={field.value as number}
                          onChange={field.onChange}
                          minMinutes={MIN_ROUND_DURATION_MINUTES}
                        />
                      </FormControl>
                      <FormDescription>
                        How long participants have to vote
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxPositiveVotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Upvotes per Member</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={(field.value as number) || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Total upvotes each member gets per round
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxNegativeVotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Downvotes per Member</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={(field.value as number) || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Total downvotes each member gets per round
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="advanced" className="rounded-lg border px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">Advanced Voting Rules</span>
                <Badge variant="outline">Optional</Badge>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="size-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Additional voting constraints for more balanced competition
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="limitVotesPerSubmission"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Limit Votes Per Submission</FormLabel>
                      <FormDescription>
                        Prevent members from using all their votes on a single song.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue(
                              "maxPositiveVotesPerSubmission",
                              positiveVoteCapDefault,
                              { shouldValidate: true },
                            );
                            form.setValue(
                              "maxNegativeVotesPerSubmission",
                              negativeVoteCapDefault,
                              { shouldValidate: true },
                            );
                          }
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              {limitVotesPerSubmission && (
                <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/50 p-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="maxPositiveVotesPerSubmission"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Upvotes Per Song</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            value={(field.value as number) ?? ""}
                            placeholder="e.g., 3"
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum upvotes one song can receive from a single member
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxNegativeVotesPerSubmission"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Downvotes Per Song</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            value={(field.value as number) ?? ""}
                            placeholder="e.g., 1"
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum downvotes one song can receive from a single member
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Separator />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
