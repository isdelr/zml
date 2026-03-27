"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, usePaginatedQuery } from "convex/react";
import { type Id } from "@/convex/_generated/dataModel";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  Clock3,
  Loader2,
  PlusCircle,
  Send,
  Trash2,
  Vote,
} from "lucide-react";
import { type VariantProps } from "class-variance-authority";

import { api } from "@/lib/convex/api";
import type { LeagueData, RoundForLeague } from "@/lib/convex/types";
import { toErrorMessage } from "@/lib/errors";
import { genres as availableGenres } from "@/lib/genres";
import {
  buildLeagueRoundHref,
  getPreferredRoundId,
} from "@/lib/leagues/navigation";
import {
  createDefaultRoundManagementValues,
  roundManagementSchema,
  type RoundManagementInput,
  type RoundManagementValues,
} from "@/lib/rounds/round-management-form";
import { formatShortDateTime } from "@/lib/utils";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

interface RoundsTabProps {
  league: LeagueData;
}

function getRoundStatusBadge(
  round: RoundForLeague,
): {
  label: string;
  variant: VariantProps<typeof badgeVariants>["variant"];
  icon: typeof Clock3;
} {
  switch (round.status) {
    case "scheduled":
      return { label: "Scheduled", variant: "outline", icon: Clock3 };
    case "submissions":
      return { label: "Submissions", variant: "secondary", icon: Send };
    case "voting":
      return { label: "Voting", variant: "secondary", icon: Vote };
    case "finished":
      return { label: "Finished", variant: "outline", icon: Clock3 };
  }
}

function getRoundScheduleSummary(round: RoundForLeague) {
  if (round.status === "scheduled") {
    return `Starts ${formatShortDateTime(
      round.submissionStartsAt ?? round.submissionDeadline,
    )}`;
  }

  if (round.status === "submissions") {
    return `Submission deadline ${formatShortDateTime(round.submissionDeadline)}`;
  }

  if (round.status === "voting") {
    return `Voting deadline ${formatShortDateTime(round.votingDeadline)}`;
  }

  return `Finished ${formatShortDateTime(round.votingDeadline)}`;
}

export function RoundsTab({ league }: RoundsTabProps) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const createRound = useMutation(api.rounds.createRound);
  const deleteRound = useMutation(api.rounds.deleteRound);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [roundPendingDelete, setRoundPendingDelete] =
    useState<RoundForLeague | null>(null);
  const selectedRoundId = (
    typeof params.roundId === "string" ? params.roundId : null
  ) as Id<"rounds"> | null;

  const { results: rounds, status, loadMore } = usePaginatedQuery(
    api.rounds.getForLeague,
    { leagueId: league._id },
    { initialNumItems: 50 },
  );

  const form = useForm<RoundManagementInput, unknown, RoundManagementValues>({
    resolver: zodResolver(roundManagementSchema),
    defaultValues: createDefaultRoundManagementValues(),
  });
  const submissionMode = useWatch({
    control: form.control,
    name: "submissionMode",
  });

  const handleCreateRound = async (values: RoundManagementValues) => {
    const promise = createRound({
      leagueId: league._id,
      title: values.title,
      description: values.description,
      submissionsPerUser: values.submissionsPerUser,
      genres: values.genres,
      submissionMode: values.submissionMode,
      submissionInstructions: values.submissionInstructions,
      albumConfig: values.albumConfig,
    });

    toast.promise(promise, {
      loading: "Adding round...",
      success: "Round added.",
      error: (error) => toErrorMessage(error, "Failed to add round."),
    });

    await promise;
    setIsCreateDialogOpen(false);
    form.reset(createDefaultRoundManagementValues());
  };

  const handleDeleteRound = async () => {
    if (!roundPendingDelete) {
      return;
    }

    const roundToDelete = roundPendingDelete;
    const remainingRounds = rounds.filter(
      (round) => round._id !== roundToDelete._id,
    );
    const fallbackRoundId = getPreferredRoundId(remainingRounds);
    const promise = deleteRound({ roundId: roundToDelete._id });

    toast.promise(promise, {
      loading: "Removing round...",
      success: "Round removed.",
      error: (error) => toErrorMessage(error, "Failed to remove round."),
    });

    await promise;
    setRoundPendingDelete(null);

    if (selectedRoundId === roundToDelete._id) {
      if (fallbackRoundId) {
        router.replace(
          buildLeagueRoundHref({
            leagueId: league._id,
            roundId: fallbackRoundId,
            searchParams,
          }),
        );
      } else {
        router.replace(`/leagues/${league._id}`);
      }
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Round Schedule</h3>
            <p className="text-sm text-muted-foreground">
              Add new rounds to the end of the current schedule. Only scheduled
              rounds can be removed to protect active play and finished results.
            </p>
          </div>
          <Button type="button" onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 size-4" />
            Add Round
          </Button>
        </div>

        <div className="space-y-3">
          {status === "LoadingFirstPage"
            ? Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-lg border p-4"
                >
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-3 h-4 w-64" />
                </div>
              ))
            : rounds.map((round) => {
                const statusBadge = getRoundStatusBadge(round);
                const StatusIcon = statusBadge.icon;
                const canDelete = round.status === "scheduled";

                return (
                  <div
                    key={round._id}
                    className="rounded-lg border p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{round.title}</p>
                          <Badge variant={statusBadge.variant}>
                            <StatusIcon className="mr-1 size-3.5" />
                            {statusBadge.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getRoundScheduleSummary(round)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {round.description}
                        </p>
                      </div>

                      {canDelete ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setRoundPendingDelete(round)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Locked
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
        </div>

        {status === "CanLoadMore" ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => loadMore(50)}
          >
            Load More Rounds
          </Button>
        ) : null}
      </div>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            form.reset(createDefaultRoundManagementValues());
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Round</DialogTitle>
            <DialogDescription>
              New rounds are appended after the current schedule using this
              league&apos;s submission and voting windows.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => void handleCreateRound(values))}
              className="space-y-6"
            >
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Round Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Desert Island Songs" {...field} />
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
                          placeholder="Describe the theme and what belongs in this round."
                          {...field}
                        />
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
                      <FormLabel>Songs per Participant</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          {...field}
                          value={(field.value as number) || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Choose how many songs each participant can submit.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="advanced" className="rounded-lg border px-4">
                  <AccordionTrigger className="hover:no-underline">
                    Advanced Options
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <FormField
                      control={form.control}
                      name="submissionMode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Submission Mode</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a submission mode" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="single">Single song</SelectItem>
                              <SelectItem value="multi">
                                Multiple songs (shuffled)
                              </SelectItem>
                              <SelectItem value="album">
                                Multiple songs (keep track order)
                              </SelectItem>
                            </SelectContent>
                          </Select>
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
                              placeholder="Optional guidance shown when members submit."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {submissionMode === "album" ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="albumConfig.minTracks"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Minimum Tracks</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  {...field}
                                  value={
                                    typeof field.value === "number"
                                      ? field.value
                                      : ""
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="albumConfig.maxTracks"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Maximum Tracks</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  {...field}
                                  value={
                                    typeof field.value === "number"
                                      ? field.value
                                      : ""
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="albumConfig.allowPartial"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Allow Partial Albums</FormLabel>
                              <FormControl>
                                <Select
                                  onValueChange={(value) =>
                                    field.onChange(value === "true")
                                  }
                                  value={
                                    field.value === undefined
                                      ? "false"
                                      : String(field.value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="false">No</SelectItem>
                                    <SelectItem value="true">Yes</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="albumConfig.requireReleaseYear"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Require Release Year</FormLabel>
                              <FormControl>
                                <Select
                                  onValueChange={(value) =>
                                    field.onChange(value === "true")
                                  }
                                  value={
                                    field.value === undefined
                                      ? "true"
                                      : String(field.value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="true">Yes</SelectItem>
                                    <SelectItem value="false">No</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ) : null}

                    <FormField
                      control={form.control}
                      name="genres"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Genres</FormLabel>
                          <FormDescription>
                            Optional tags that help define the round.
                          </FormDescription>
                          <FormControl>
                            <div className="flex flex-wrap gap-2">
                              {availableGenres.map((genre) => {
                                const isSelected = field.value?.includes(genre);
                                return (
                                  <Badge
                                    key={genre}
                                    variant={isSelected ? "default" : "outline"}
                                    className="cursor-pointer"
                                    onClick={() => {
                                      const currentValue = field.value ?? [];
                                      const nextValue = isSelected
                                        ? currentValue.filter(
                                            (value) => value !== genre,
                                          )
                                        : [...currentValue, genre];
                                      field.onChange(nextValue);
                                    }}
                                  >
                                    {genre}
                                  </Badge>
                                );
                              })}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Add round
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={roundPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRoundPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete round?</AlertDialogTitle>
            <AlertDialogDescription>
              {roundPendingDelete
                ? `Remove "${roundPendingDelete.title}" from this league? Any later scheduled rounds will move up to close the gap.`
                : "Remove this round from the league?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDeleteRound()}
            >
              Delete round
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
