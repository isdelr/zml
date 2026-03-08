// File: components/round/RoundAdminControls.tsx
"use client";

import { useMutation } from "convex/react";
import { api } from "@/lib/convex/api";
import { Doc } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { toErrorMessage } from "@/lib/errors";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, Edit } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { EditRoundDialog } from "./EditRoundDialog";
import { getSubmissionFileProcessingStatus } from "@/lib/submission/file-processing";
import { cn } from "@/lib/utils";

interface RoundAdminControlsProps {
  round: Doc<"rounds">;
  submissions: FunctionReturnType<typeof api.submissions.getForRound> | undefined;
}

export function RoundAdminControls({
  round,
  submissions,
}: RoundAdminControlsProps) {
  const manageRoundState = useMutation(api.rounds.manageRoundState);
  const adjustRoundTime = useMutation(api.rounds.adjustRoundTime);
  const rollbackRoundToSubmissions = useMutation(
    api.rounds.rollbackRoundToSubmissions,
  );
  const [isEditRoundOpen, setIsEditRoundOpen] = useState(false);

  const handleAction = async <TArgs extends object>(
    mutation: (args: TArgs) => Promise<unknown>,
    args: TArgs,
    successMsg: string,
  ) => {
    toast.promise(mutation(args), {
      loading: "Processing...",
      success: () => successMsg,
      error: (error) => toErrorMessage(error, "An error occurred."),
    });
  };

  const canEndVoting = submissions && submissions.length > 0;
  const canEditRound = round.status !== "finished";
  const pendingSubmissionCount =
    submissions?.filter((submission) =>
      submission.submissionType === "file" &&
      getSubmissionFileProcessingStatus({
        submissionType: submission.submissionType,
        songFileKey: submission.songFileKey ?? null,
        fileProcessingStatus: submission.fileProcessingStatus,
      }) !== "ready",
    ).length ?? 0;
  const canStartVoting = pendingSubmissionCount === 0;
  const [isExpanded, setIsExpanded] = useState(false);
  const collapsedSummary =
    round.status === "submissions"
      ? canStartVoting
        ? "Submissions are open. Expand to edit timing or start voting."
        : `${pendingSubmissionCount} file submission${
            pendingSubmissionCount === 1 ? "" : "s"
          } still processing before voting can start.`
      : round.status === "voting"
        ? canEndVoting
          ? "Voting is live. Expand to end the round or reopen submissions."
          : "Voting is live. Expand to manage timing. Ending requires at least 1 submission."
        : "Round is finished. Expand to review the admin panel.";

  return (
    <Card
      className={cn(
        "mb-8 border-primary/20 bg-secondary/30 transition-all",
        isExpanded ? "py-6" : "py-4",
      )}
    >
      <CardHeader className={cn("gap-3", !isExpanded && "pb-0")}>
        <div className="space-y-1">
          <CardTitle>Admin Controls</CardTitle>
          <CardDescription>
            {isExpanded
              ? "Manage the current round state and timing. These controls are only visible to you."
              : collapsedSummary}
          </CardDescription>
        </div>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={isExpanded}
            aria-controls="round-admin-controls-panel"
            onClick={() => setIsExpanded((value) => !value)}
          >
            {isExpanded ? "Hide" : "Show"}
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                isExpanded && "rotate-180",
              )}
            />
          </Button>
        </CardAction>
      </CardHeader>
      {isExpanded ? (
        <CardContent
          id="round-admin-controls-panel"
          className="flex flex-wrap items-center gap-4"
        >
          {round.status === "submissions" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={!canStartVoting}
                  title={
                    !canStartVoting
                      ? `${pendingSubmissionCount} file submission(s) are not ready yet.`
                      : ""
                  }
                >
                  Start Voting Now
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Are you sure you want to start the voting phase?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will close submissions for the current round. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={!canStartVoting}
                    onClick={() =>
                      handleAction(
                        manageRoundState,
                        { roundId: round._id, action: "startVoting" },
                        "Voting has been started!",
                      )
                    }
                  >
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {round.status === "voting" && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={!canEndVoting}
                    title={!canEndVoting ? "Requires at least 1 submission." : ""}
                  >
                    End Round Now
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you sure you want to end this round?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will finalize the voting, calculate the results, and
                      finish the round. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={!canEndVoting}
                      onClick={() =>
                        handleAction(
                          manageRoundState,
                          { roundId: round._id, action: "endVoting" },
                          "Round has been finished!",
                        )
                      }
                    >
                      End Round
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">Reopen Submissions (24h)</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Reopen submissions for 24 hours?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will move the round back to the submission phase for
                      24 hours. Existing submissions will remain. Any existing
                      votes will be preserved but voting will pause until
                      submissions close again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        handleAction(
                          rollbackRoundToSubmissions,
                          { roundId: round._id },
                          "Submissions reopened for 24 hours!",
                        )
                      }
                    >
                      Reopen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}

          {canEditRound && (
            <Dialog open={isEditRoundOpen} onOpenChange={setIsEditRoundOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Edit className="mr-2 size-4" /> Edit Round
                </Button>
              </DialogTrigger>
              <DialogContent>
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
              <Button
                variant="outline"
                onClick={() =>
                  handleAction(
                    adjustRoundTime,
                    { roundId: round._id, hours: 24 },
                    "Added 1 day to the current phase.",
                  )
                }
              >
                +1 Day
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  handleAction(
                    adjustRoundTime,
                    { roundId: round._id, hours: -24 },
                    "Removed 1 day from the current phase.",
                  )
                }
              >
                -1 Day
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  handleAction(
                    adjustRoundTime,
                    { roundId: round._id, hours: 1 },
                    "Added 1 hour to the current phase.",
                  )
                }
              >
                +1 Hour
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  handleAction(
                    adjustRoundTime,
                    { roundId: round._id, hours: -1 },
                    "Removed 1 hour from the current phase.",
                  )
                }
              >
                -1 Hour
              </Button>
            </>
          )}
          {round.status === "finished" && (
            <p className="text-sm text-muted-foreground">
              This round is finished. No further actions can be taken.
            </p>
          )}
          {round.status === "submissions" && !canStartVoting ? (
            <p className="text-sm text-muted-foreground">
              Voting is blocked until every file submission is finished and
              ready.
            </p>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
