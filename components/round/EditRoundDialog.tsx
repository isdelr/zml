// File: components/round/EditRoundDialog.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Doc } from "@/convex/_generated/dataModel";

const numberOrNull = z.preprocess((val) => {
  if (val === "" || val === undefined || val === null) return null;
  if (typeof val === "string") {
    const n = Number(val);
    return Number.isNaN(n) ? null : n;
  }
  if (typeof val === "number") return val;
  return null;
}, z.union([z.number().int().min(0), z.null()]));

const roundEditSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters."),
  submissionsPerUser: z.coerce
    .number()
    .min(1, "Must be at least 1.")
    .max(5, "Max 5 submissions per user."),
  maxPositiveVotes: numberOrNull.optional(),
  maxNegativeVotes: numberOrNull.optional(),
  submissionMode: z.enum(["single", "multi", "album"]).default("single"),
  submissionInstructions: z.string().optional(),
  albumConfig: z.object({
    allowPartial: z.boolean().optional(),
    requireReleaseYear: z.boolean().optional(),
    minTracks: z.coerce.number().min(1, "Must be at least 1 track.").optional(),
    maxTracks: z.coerce.number().min(1, "Must be at least 1 track.").optional(),
  }).optional(),
}).superRefine((data, ctx) => {
  if (data.submissionMode === "album" && data.albumConfig) {
    const { minTracks, maxTracks } = data.albumConfig;
    if (minTracks !== undefined && maxTracks !== undefined && minTracks > maxTracks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum tracks cannot exceed maximum tracks.",
        path: ["albumConfig", "minTracks"],
      });
    }
  }
});

interface EditRoundDialogProps {
  round: Doc<"rounds">;
  onClose: () => void;
}

export function EditRoundDialog({ round, onClose }: EditRoundDialogProps) {
  const updateRound = useMutation(api.rounds.updateRound);
  const form = useForm<z.infer<typeof roundEditSchema>>({
    resolver: zodResolver(roundEditSchema),
    defaultValues: {
      title: round.title || "",
      description: round.description || "",
      submissionsPerUser: round.submissionsPerUser ?? 1,
      maxPositiveVotes: round.maxPositiveVotes ?? null,
      maxNegativeVotes: round.maxNegativeVotes ?? null,
      submissionMode: round.submissionMode ?? "single",
      submissionInstructions: round.submissionInstructions ?? "",
      albumConfig: round.albumConfig ?? {
        allowPartial: undefined,
        requireReleaseYear: true,
        minTracks: undefined,
        maxTracks: undefined,
      },
    },
  });

  async function onSubmit(values: z.infer<typeof roundEditSchema>) {
    toast.promise(updateRound({ roundId: round._id, ...values }), {
      loading: "Updating round...",
      success: (msg) => {
        onClose();
        return msg;
      },
      error: (err) => err.data?.message || "Failed to update round.",
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Round Title</FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>Round Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="submissionsPerUser"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Submissions per User</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  disabled={round.status === "voting"}
                />
              </FormControl>
              <FormDescription>
                {round.status === "voting"
                  ? "This cannot be changed while a round is in the voting phase."
                  : "Changing this for a round with submissions will delete them and notify users to resubmit."}
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
              <FormLabel>Upvotes per round (override)</FormLabel>
              <FormControl>
                <Input type="number" {...field} placeholder="Leave empty to use league default" />
              </FormControl>
              <FormDescription>
                Leave empty to use league default. Set to 0 or more to override for this round.
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
              <FormLabel>Downvotes per round (override)</FormLabel>
              <FormControl>
                <Input type="number" {...field} placeholder="Leave empty to use league default" />
              </FormControl>
              <FormDescription>
                Leave empty to use league default. Set to 0 or more to override for this round.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="submissionMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Submission Mode</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a submission mode" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="single">Single song per submission</SelectItem>
                  <SelectItem value="multi">Multiple songs per round (shuffled)</SelectItem>
                  <SelectItem value="album">Album round (keep track order)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Choose how submissions should be grouped and presented for this round.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="submissionInstructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Submission Instructions</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Provide any extra guidelines, e.g. 'Upload 3 tracks that fit the theme.'"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                These instructions will be shown to participants when they submit songs.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.watch("submissionMode") === "album" && (
          <div className="space-y-4 rounded-md border p-4">
            <h4 className="text-sm font-semibold uppercase text-muted-foreground">Album Round Settings</h4>
            <FormField
              control={form.control}
              name="albumConfig.allowPartial"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Allow partial albums</FormLabel>
                    <FormDescription>
                      Participants can submit only a selection of tracks instead of the full album.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="albumConfig.requireReleaseYear"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Require album release year</FormLabel>
                    <FormDescription>
                      Ensure every submission includes the album&apos;s release year for context.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="albumConfig.minTracks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Tracks Required</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Optional"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Leave blank to allow any length.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="albumConfig.maxTracks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Tracks Allowed</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Optional"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Leave blank to allow any length.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          Save Changes
        </Button>
      </form>
    </Form>
  );
}