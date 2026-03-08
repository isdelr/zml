// File: components/round/RoundAdminControls.tsx
"use client";

import { useMutation } from "convex/react";
import { api } from "@/lib/convex/api";
import { Doc } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { toErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Clock3, Edit, Flag, Minus, Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState, type ComponentProps } from "react";
import { EditRoundDialog } from "./EditRoundDialog";
import { getSubmissionFileProcessingStatus } from "@/lib/submission/file-processing";
import { Input } from "@/components/ui/input";
import { formatShortDateTime } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  DEADLINE_ADJUSTMENT_PRESETS,
  formatDeadlineAdjustment,
  getAdjustedDeadline,
  getDeadlineAdjustmentHours,
  getSignedDeadlineAdjustmentLabel,
  type DeadlineAdjustmentDirection,
  type DeadlineAdjustmentPreset,
} from "@/lib/rounds/deadline-adjustments";

interface RoundAdminControlsProps {
  round: Doc<"rounds">;
  submissions:
    | FunctionReturnType<typeof api.submissions.getForRound>
    | undefined;
  voteCount?: number;
}

export function RoundAdminControls({
  round,
  submissions,
  voteCount = 0,
}: RoundAdminControlsProps) {
  const manageRoundState = useMutation(api.rounds.manageRoundState);
  const adjustRoundTime = useMutation(api.rounds.adjustRoundTime);
  const [isEditRoundOpen, setIsEditRoundOpen] = useState(false);

  const handleAction = async <TArgs extends object>(
    mutation: (args: TArgs) => Promise<unknown>,
    args: TArgs,
    successMsg: string,
  ) => {
    try {
      const promise = mutation(args);
      toast.promise(promise, {
        loading: "Processing...",
        success: () => successMsg,
        error: (error) => toErrorMessage(error, "An error occurred."),
      });
      await promise;
      return true;
    } catch {
      return false;
    }
  };

  const canEndVoting = (submissions?.length ?? 0) > 0 && voteCount > 0;
  const canEditRound = round.status !== "finished";
  const pendingSubmissionCount =
    submissions?.filter(
      (submission) =>
        submission.submissionType === "file" &&
        getSubmissionFileProcessingStatus({
          submissionType: submission.submissionType,
          songFileKey: submission.songFileKey ?? null,
          fileProcessingStatus: submission.fileProcessingStatus,
        }) !== "ready",
    ).length ?? 0;
  const canStartVoting = pendingSubmissionCount === 0;
  if (round.status === "finished") {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {canEditRound && (
          <Dialog open={isEditRoundOpen} onOpenChange={setIsEditRoundOpen}>
            <DialogTrigger asChild>
              <InlineAdminButton icon={Edit}>Edit round</InlineAdminButton>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Round: {round.title}</DialogTitle>
              </DialogHeader>
              <EditRoundDialog
                round={round}
                onClose={() => setIsEditRoundOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}

        {(round.status === "submissions" || round.status === "voting") && (
          <>
            <DeadlineAdjustmentDialog
              direction="increase"
              round={round}
              onAdjust={(hours, successMessage) =>
                handleAction(
                  adjustRoundTime,
                  { roundId: round._id, hours },
                  successMessage,
                )
              }
            />
            <DeadlineAdjustmentDialog
              direction="decrease"
              round={round}
              onAdjust={(hours, successMessage) =>
                handleAction(
                  adjustRoundTime,
                  { roundId: round._id, hours },
                  successMessage,
                )
              }
            />
          </>
        )}

        {round.status === "submissions" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <InlineAdminButton
                icon={Flag}
                disabled={!canStartVoting}
                title={
                  !canStartVoting
                    ? `${pendingSubmissionCount} file submission${pendingSubmissionCount === 1 ? "" : "s"} still processing.`
                    : "Close submissions and open voting immediately."
                }
              >
                Start voting now
              </InlineAdminButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start voting early?</AlertDialogTitle>
                <AlertDialogDescription>
                  This closes submissions before the current deadline and opens
                  voting immediately.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!canStartVoting}
                  onClick={() =>
                    void handleAction(
                      manageRoundState,
                      { roundId: round._id, action: "startVoting" },
                      "Voting started.",
                    )
                  }
                >
                  Start voting
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {round.status === "voting" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <InlineAdminButton
                icon={Flag}
                disabled={!canEndVoting}
                title={
                  canEndVoting
                    ? "Close voting and finish the round now."
                    : "Finishing early requires at least 1 submission and 1 vote."
                }
              >
                End round now
              </InlineAdminButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End voting early?</AlertDialogTitle>
                <AlertDialogDescription>
                  This closes voting before the current deadline, calculates the
                  results, and finishes the round immediately.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!canEndVoting}
                  onClick={() =>
                    void handleAction(
                      manageRoundState,
                      { roundId: round._id, action: "endVoting" },
                      "Round finished.",
                    )
                  }
                >
                  End round
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {round.status === "submissions" && !canStartVoting ? (
          <span>
            {pendingSubmissionCount} file submission
            {pendingSubmissionCount === 1 ? "" : "s"} still processing before
            voting can start.
          </span>
        ) : null}
        {round.status === "voting" && !canEndVoting ? (
          <span>
            Finishing early requires at least 1 submission and 1 vote.
          </span>
        ) : null}
      </div>
    </div>
  );
}

type InlineAdminButtonProps = ComponentProps<typeof Button> & {
  icon: LucideIcon;
};

function InlineAdminButton({
  children,
  className,
  icon: Icon,
  ...props
}: InlineAdminButtonProps) {
  return (
    <Button
      variant="ghost"
      className={[
        "h-auto gap-2 px-0 py-0 text-primary hover:bg-transparent hover:text-primary/80",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <Icon className="size-4" />
      <span>{children}</span>
    </Button>
  );
}

type DeadlineAdjustmentDialogProps = {
  direction: DeadlineAdjustmentDirection;
  round: Doc<"rounds">;
  onAdjust: (hours: number, successMessage: string) => Promise<boolean>;
};

function DeadlineAdjustmentDialog({
  direction,
  round,
  onAdjust,
}: DeadlineAdjustmentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const [days, setDays] = useState("");
  const [hours, setHours] = useState("");

  const currentDeadline =
    round.status === "submissions"
      ? round.submissionDeadline
      : round.votingDeadline;
  const phaseLabel = round.status === "submissions" ? "Submission" : "Voting";
  const directionLabel = direction === "increase" ? "Increase" : "Decrease";
  const buttonLabel =
    direction === "increase" ? "Increase deadline" : "Decrease deadline";
  const Icon = direction === "increase" ? Plus : Minus;

  const parsedDays = parseAdjustmentValue(days);
  const parsedHours = parseAdjustmentValue(hours);
  const customPreset = { days: parsedDays, hours: parsedHours };
  const totalHours = getDeadlineAdjustmentHours(customPreset);
  const nextDeadline = getAdjustedDeadline(
    currentDeadline,
    direction,
    customPreset,
  );
  const comparisonTime = openedAt ?? 0;
  const wouldBeInPast = totalHours > 0 && nextDeadline < comparisonTime;
  const canApplyCustom = totalHours > 0 && !wouldBeInPast;

  const reset = () => {
    setDays("");
    setHours("");
  };

  const runAdjustment = async (preset: DeadlineAdjustmentPreset) => {
    const absoluteHours = getDeadlineAdjustmentHours(preset);
    if (absoluteHours <= 0) return;

    const signedHours =
      direction === "increase" ? absoluteHours : -absoluteHours;
    const verb = direction === "increase" ? "extended" : "shortened";
    const success = await onAdjust(
      signedHours,
      `${phaseLabel} deadline ${verb} by ${formatDeadlineAdjustment(preset)}.`,
    );

    if (success) {
      setIsOpen(false);
      reset();
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) {
          setOpenedAt(Date.now());
          return;
        }
        setOpenedAt(null);
        reset();
      }}
    >
      <DialogTrigger asChild>
        <InlineAdminButton icon={Icon}>{buttonLabel}</InlineAdminButton>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{directionLabel} deadline</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              Current {phaseLabel.toLowerCase()} deadline:{" "}
              {formatShortDateTime(currentDeadline)}
            </span>
            <span className="block">
              {round.status === "submissions"
                ? "This also shifts the voting deadline by the same amount."
                : "Only the voting deadline changes."}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Quick presets</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DEADLINE_ADJUSTMENT_PRESETS.map((preset) => {
                const disabled =
                  getAdjustedDeadline(currentDeadline, direction, preset) <
                  comparisonTime;
                const key = `${direction}-${preset.days}-${preset.hours}`;
                return (
                  <Button
                    key={key}
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => void runAdjustment(preset)}
                  >
                    <Clock3 className="size-4" />
                    {getSignedDeadlineAdjustmentLabel(direction, preset)}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Custom amount</p>
              <p className="text-sm text-muted-foreground">
                Choose days, hours, or both.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Days</span>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="0"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Hours</span>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="0"
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                />
              </label>
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                {totalHours > 0
                  ? `${directionLabel} by ${formatDeadlineAdjustment(customPreset)}`
                  : "Enter a custom amount to preview the new deadline."}
              </p>
              {totalHours > 0 && (
                <p>
                  New deadline:{" "}
                  <span className="font-medium text-foreground">
                    {formatShortDateTime(nextDeadline)}
                  </span>
                </p>
              )}
              {wouldBeInPast && (
                <p className="text-destructive">
                  This change would move the deadline into the past.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canApplyCustom}
            onClick={() => void runAdjustment(customPreset)}
          >
            {directionLabel} deadline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parseAdjustmentValue(value: string): number {
  if (!value.trim()) return 0;

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;

  return parsed;
}
