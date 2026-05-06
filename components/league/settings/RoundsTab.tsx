"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, usePaginatedQuery } from "convex/react";
import { type Id } from "@/convex/_generated/dataModel";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  ArrowLeftRight,
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

function isRoundSwappable(round: RoundForLeague) {
  return round.status === "scheduled" || round.status === "submissions";
}

function getRoundSwapPreview(
  firstRound: RoundForLeague | null,
  secondRound: RoundForLeague | null,
) {
  if (!firstRound || !secondRound) {
    return "Choose two rounds to preview the swap.";
  }

  const firstSummary = getRoundScheduleSummary(firstRound).toLowerCase();
  const secondSummary = getRoundScheduleSummary(secondRound).toLowerCase();

  if (
    firstRound.status === "submissions" &&
    secondRound.status === "scheduled"
  ) {
    return `"${secondRound.title}" will open for submissions with the current submission deadline. "${firstRound.title}" will move to the scheduled slot: ${secondSummary}.`;
  }

  if (
    firstRound.status === "scheduled" &&
    secondRound.status === "submissions"
  ) {
    return `"${firstRound.title}" will open for submissions with the current submission deadline. "${secondRound.title}" will move to the scheduled slot: ${firstSummary}.`;
  }

  return `"${firstRound.title}" will move to ${secondSummary}, and "${secondRound.title}" will move to ${firstSummary}.`;
}

export function RoundsTab({ league }: RoundsTabProps) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const createRound = useMutation(api.rounds.createRound);
  const deleteRound = useMutation(api.rounds.deleteRound);
  const swapRoundScheduleSlots = useMutation(api.rounds.swapRoundScheduleSlots);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSwapDialogOpen, setIsSwapDialogOpen] = useState(false);
  const [swapFirstRoundId, setSwapFirstRoundId] =
    useState<Id<"rounds"> | null>(null);
  const [swapSecondRoundId, setSwapSecondRoundId] =
    useState<Id<"rounds"> | null>(null);
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
  const swappableRounds = rounds.filter(isRoundSwappable);
  const selectedSwapFirstRound =
    swappableRounds.find((round) => round._id === swapFirstRoundId) ?? null;
  const selectedSwapSecondRound =
    swappableRounds.find((round) => round._id === swapSecondRoundId) ?? null;
  const canSubmitSwap =
    swapFirstRoundId !== null &&
    swapSecondRoundId !== null &&
    swapFirstRoundId !== swapSecondRoundId;

  const getDefaultSwapSecondRoundId = (firstRoundId: Id<"rounds"> | null) =>
    swappableRounds.find((round) => round._id !== firstRoundId)?._id ?? null;

  const openSwapDialog = (initialRound?: RoundForLeague) => {
    const firstRoundId =
      initialRound && isRoundSwappable(initialRound)
        ? initialRound._id
        : (swappableRounds[0]?._id ?? null);

    setSwapFirstRoundId(firstRoundId);
    setSwapSecondRoundId(getDefaultSwapSecondRoundId(firstRoundId));
    setIsSwapDialogOpen(true);
  };

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

  const handleSwapRounds = async () => {
    if (!canSubmitSwap || !swapFirstRoundId || !swapSecondRoundId) {
      return;
    }

    const promise = swapRoundScheduleSlots({
      firstRoundId: swapFirstRoundId,
      secondRoundId: swapSecondRoundId,
    });

    toast.promise(promise, {
      loading: "Swapping rounds...",
      success: "Rounds swapped.",
      error: (error) => toErrorMessage(error, "Failed to swap rounds."),
    });

    await promise;
    setIsSwapDialogOpen(false);
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={swappableRounds.length < 2}
              onClick={() => openSwapDialog()}
            >
              <ArrowLeftRight className="mr-2 size-4" />
              Swap rounds
            </Button>
            <Button type="button" onClick={() => setIsCreateDialogOpen(true)}>
              <PlusCircle className="mr-2 size-4" />
              Add Round
            </Button>
          </div>
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
                const canSwap = isRoundSwappable(round);

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

                      <div className="flex flex-wrap justify-end gap-2">
                        {canSwap ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={swappableRounds.length < 2}
                            onClick={() => openSwapDialog(round)}
                          >
                            <ArrowLeftRight className="mr-2 size-4" />
                            Swap
                          </Button>
                        ) : null}
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
                        ) : null}
                        {!canSwap && !canDelete ? (
                          <span className="text-xs text-muted-foreground">
                            Locked
                          </span>
                        ) : null}
                      </div>
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

      <Dialog
        open={isSwapDialogOpen}
        onOpenChange={(open) => {
          setIsSwapDialogOpen(open);
          if (!open) {
            setSwapFirstRoundId(null);
            setSwapSecondRoundId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Swap rounds</DialogTitle>
            <DialogDescription>
              Exchange the schedule slots for two scheduled or submission
              rounds. Voting and finished rounds stay locked.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">First round</label>
                <Select
                  value={swapFirstRoundId ?? ""}
                  onValueChange={(value) => {
                    const nextRoundId = value as Id<"rounds">;
                    setSwapFirstRoundId(nextRoundId);
                    if (nextRoundId === swapSecondRoundId) {
                      setSwapSecondRoundId(
                        getDefaultSwapSecondRoundId(nextRoundId),
                      );
                    }
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="First round">
                    <SelectValue placeholder="Select a round" />
                  </SelectTrigger>
                  <SelectContent>
                    {swappableRounds.map((round) => (
                      <SelectItem
                        key={round._id}
                        value={round._id}
                        disabled={round._id === swapSecondRoundId}
                      >
                        {round.title} - {getRoundStatusBadge(round).label} -{" "}
                        {getRoundScheduleSummary(round)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Second round</label>
                <Select
                  value={swapSecondRoundId ?? ""}
                  onValueChange={(value) => {
                    const nextRoundId = value as Id<"rounds">;
                    setSwapSecondRoundId(nextRoundId);
                    if (nextRoundId === swapFirstRoundId) {
                      setSwapFirstRoundId(
                        getDefaultSwapSecondRoundId(nextRoundId),
                      );
                    }
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="Second round">
                    <SelectValue placeholder="Select a round" />
                  </SelectTrigger>
                  <SelectContent>
                    {swappableRounds.map((round) => (
                      <SelectItem
                        key={round._id}
                        value={round._id}
                        disabled={round._id === swapFirstRoundId}
                      >
                        {round.title} - {getRoundStatusBadge(round).label} -{" "}
                        {getRoundScheduleSummary(round)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              {getRoundSwapPreview(
                selectedSwapFirstRound,
                selectedSwapSecondRound,
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSwapDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canSubmitSwap}
              onClick={() => void handleSwapRounds()}
            >
              Swap rounds
            </Button>
          </DialogFooter>
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
