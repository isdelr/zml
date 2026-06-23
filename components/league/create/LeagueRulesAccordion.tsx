import { useWatch } from "react-hook-form";
import { useEffect, useRef } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getDefaultNegativeVotesPerSubmission,
  getDefaultPositiveVotesPerSubmission,
} from "@/lib/leagues/vote-limits";
import type { CreateLeagueForm } from "./form-types";

function toFiniteNumber(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function LeagueRulesAccordion({ form }: { form: CreateLeagueForm }) {
  const limitVotesPerSubmission = useWatch({
    control: form.control,
    name: "limitVotesPerSubmission",
  });
  const enforceListenPercentage = useWatch({
    control: form.control,
    name: "enforceListenPercentage",
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

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="voting" className="rounded-lg border px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">Voting Rules</span>
            <Badge variant="secondary">Recommended</Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="submissionDeadline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Submission Period (Hours)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={(field.value as number) || ""} />
                  </FormControl>
                  <FormDescription>Default: 7 days (168 hours)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="votingDeadline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Voting Period (Hours)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={(field.value as number) || ""} />
                  </FormControl>
                  <FormDescription>Default: 3 days (72 hours)</FormDescription>
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
                    <Input type="number" {...field} value={(field.value as number) || ""} />
                  </FormControl>
                  <FormDescription>How many upvotes each member gets per round</FormDescription>
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
                    <Input type="number" {...field} value={(field.value as number) || ""} />
                  </FormControl>
                  <FormDescription>How many downvotes each member gets per round</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4 border-t pt-4">
            <FormField
              control={form.control}
              name="limitVotesPerSubmission"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-4">
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
              <div className="grid grid-cols-1 gap-6 rounded-lg border bg-muted/50 p-4 sm:grid-cols-2">
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
                          placeholder="e.g., 3"
                          {...field}
                          value={(field.value as number) || ""}
                        />
                      </FormControl>
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
                          placeholder="e.g., 1"
                          {...field}
                          value={(field.value as number) || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>

          <div className="space-y-4 border-t pt-4">
            <FormField
              control={form.control}
              name="enforceListenPercentage"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Enforce Listening Requirement</FormLabel>
                    <FormDescription>
                      Require participants to finish each song before voting, unless it exceeds the protection cap.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            {enforceListenPercentage && (
              <div className="grid grid-cols-1 gap-6 rounded-lg border bg-muted/50 p-4">
                <FormField
                  control={form.control}
                  name="listenTimeLimitMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Protection Time Limit (Minutes)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 30"
                          {...field}
                          value={(field.value as number) || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Songs shorter than this must be fully heard. Longer songs only require listening up to this cap.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
