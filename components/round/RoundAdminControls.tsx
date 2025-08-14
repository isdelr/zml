"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
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

interface RoundAdminControlsProps {
  round: Doc<"rounds">;
  submissions: Record<string, unknown>[] | undefined;
  votes: Record<string, unknown>[] | undefined;
}

export function RoundAdminControls({
                                     round,
                                     submissions,
                                     votes,
                                   }: RoundAdminControlsProps) {
  const manageRoundState = useMutation(api.rounds.manageRoundState);
  const adjustRoundTime = useMutation(api.rounds.adjustRoundTime);
  const [isEditRoundOpen, setIsEditRoundOpen] = useState(false);

  const handleAction = async (
    mutation: typeof manageRoundState | typeof adjustRoundTime,
    args: Record<string, unknown>,
    successMsg: string,
  ) => {
    toast.promise(mutation(args), {
      loading: "Processing...",
      success: () => successMsg,
      error: (err) => err.data?.message || "An error occurred.",
    });
  };

  const canEndVoting =
    submissions && submissions.length > 0 && votes && votes.length > 0;
  const canEditRound =
    round.status === "submissions" &&
    (!submissions || submissions.length === 0);

  return (
    <Card className="mb-8 border-primary/20 bg-secondary/30">
      <CardHeader>
        <CardTitle>Admin Controls</CardTitle>
        <CardDescription>
          Manage the current round state and timing. These controls are only
          visible to you.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        {round.status === "submissions" && (
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button>Start Voting Now</Button>
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
            <Dialog open={isEditRoundOpen} onOpenChange={setIsEditRoundOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={!canEditRound}
                  title={
                    !canEditRound ? "Cannot edit a round with submissions." : ""
                  }
                >
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
          </>
        )}
        {round.status === "voting" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={!canEndVoting}
                title={
                  !canEndVoting
                    ? "Requires at least 1 submission and 1 vote."
                    : ""
                }
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
      </CardContent>
    </Card>
  );
}