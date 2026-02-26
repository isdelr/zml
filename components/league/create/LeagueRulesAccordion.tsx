import { useWatch } from "react-hook-form";
import { Info } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CreateLeagueForm } from "./form-types";

export function LeagueRulesAccordion({ form }: { form: CreateLeagueForm }) {
  const limitVotesPerSubmission = useWatch({
    control: form.control,
    name: "limitVotesPerSubmission",
  });
  const enforceListenPercentage = useWatch({
    control: form.control,
    name: "enforceListenPercentage",
  });

  return (
    <Accordion type="multiple" className="w-full">
      <AccordionItem value="voting" className="mb-4 rounded-lg border px-4">
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
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="advanced" className="rounded-lg border px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">Advanced Options</span>
            <Badge variant="outline">Optional</Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>These settings are optional and add extra rules</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-6 pt-4">
          <div className="space-y-4">
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
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
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

          <Separator />

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="enforceListenPercentage"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Enforce Listen Duration</FormLabel>
                    <FormDescription>
                      Require participants to listen to a portion of each song before voting.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            {enforceListenPercentage && (
              <div className="grid grid-cols-1 gap-6 rounded-lg border bg-muted/50 p-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="listenPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Listen Percentage (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 50"
                          {...field}
                          value={(field.value as number) || ""}
                        />
                      </FormControl>
                      <FormDescription>Percentage of song that must be played</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="listenTimeLimitMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Time Limit (Minutes)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 30"
                          {...field}
                          value={(field.value as number) || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Maximum time to count towards listen requirement
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
