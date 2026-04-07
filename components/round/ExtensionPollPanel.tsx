"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import {
  CheckCircle2,
  LockKeyhole,
  MessageSquareQuote,
  TimerReset,
  Vote,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/convex/api";
import type { FunctionReturnType } from "convex/server";
import { toErrorMessage } from "@/lib/errors";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  EXTENSION_REASON_MIN_LENGTH,
  formatExtensionPollRequestWindowLabel,
  getExtensionPollMinimumTurnout,
} from "@/lib/rounds/extension-polls";
import { cn } from "@/lib/utils";

type ExtensionPollState = FunctionReturnType<typeof api.extensionPolls.getForRound>;

function getRequestEligibilityCopy(
  reason: NonNullable<ExtensionPollState>["request"]["eligibilityReason"],
  requestWindowLabel: string,
) {
  switch (reason) {
    case "already_used_limit":
      return "You have already used both extension requests available in this league. Opening a poll spends a request whether it passes or fails.";
    case "not_pending_voter":
      return "Only participants who are still voting can request more time.";
    case "no_eligible_voters":
      return "An extension poll needs at least one completed voter before it can open.";
    case "outside_window":
      return `Extension requests only open during the last ${requestWindowLabel} of voting.`;
    case "round_not_voting":
      return "Extension requests are only available while voting is open.";
    case "not_authenticated":
    case "not_member":
    case "spectator":
      return "This panel is visible to everyone, but only active league participants can request an extension.";
    default:
      return null;
  }
}

function getPollStatusCopy(
  poll: NonNullable<NonNullable<ExtensionPollState>["poll"]>,
) {
  if (poll.status === "open") {
    return {
      title: "Extension Request",
      description: "An anonymous extension poll is currently open for this round.",
    };
  }

  switch (poll.result) {
    case "approved":
      return {
        title: "Extension approved",
        description: "Voting was extended by 24 hours.",
      };
    case "tie":
      return {
        title: "Extension tied",
        description: "The poll tied, so voting was extended by 8 hours.",
      };
    case "rejected":
      return {
        title: "Extension rejected",
        description: "The voting deadline stayed the same.",
      };
    case "insufficient_turnout":
      return {
        title: "Extension poll invalid",
        description:
          "Fewer than 50% of eligible voters participated, so no result was applied.",
      };
    default:
      return {
        title: "Extension poll closed",
        description: "Voting ended before an extension needed to be applied.",
      };
  }
}

interface ExtensionPollPanelProps {
  state: ExtensionPollState | undefined;
  roundId: Id<"rounds">;
  roundStatus: "scheduled" | "submissions" | "voting" | "finished";
}

export function ExtensionPollPanel({
  state,
  roundId,
  roundStatus,
}: ExtensionPollPanelProps) {
  const createPoll = useMutation(api.extensionPolls.create);
  const castVote = useMutation(api.extensionPolls.castVote);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVoting, setIsVoting] = useState<"grant" | "deny" | null>(null);

  const trimmedReason = reason.trim();
  const remainingChars = Math.max(
    0,
    EXTENSION_REASON_MIN_LENGTH - trimmedReason.length,
  );

  if (!state) {
    return null;
  }

  const { poll, request } = state;
  const requestWindowLabel = formatExtensionPollRequestWindowLabel(
    request.requestWindowMs,
  );
  const helperCopy = !poll
    ? getRequestEligibilityCopy(request.eligibilityReason, requestWindowLabel)
    : null;
  const minimumTurnout = getExtensionPollMinimumTurnout(
    poll?.eligibleVoterCount ?? request.eligibleVoterCount,
  );

  const handleCreatePoll = async () => {
    if (trimmedReason.length < EXTENSION_REASON_MIN_LENGTH) {
      toast.error(
        `Please enter at least ${EXTENSION_REASON_MIN_LENGTH} characters for the reason.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await createPoll({ roundId, reason: trimmedReason });
      toast.success("Extension poll opened.");
      setReason("");
      setIsDialogOpen(false);
    } catch (error: unknown) {
      toast.error(toErrorMessage(error, "Failed to open extension poll."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (vote: "grant" | "deny") => {
    if (!poll) {
      return;
    }

    setIsVoting(vote);
    try {
      const result = await castVote({ pollId: poll._id, vote });
      toast.success(result.resolved ? "Vote recorded. Poll resolved." : "Vote recorded.");
    } catch (error: unknown) {
      toast.error(toErrorMessage(error, "Failed to submit poll vote."));
    } finally {
      setIsVoting(null);
    }
  };

  if (!poll) {
    return (
      <>
        <Card className="accent-panel">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="accent-pill text-primary">
                Last {requestWindowLabel}
              </Badge>
              <Badge variant="outline">
                {request.remainingRequests} request
                {request.remainingRequests === 1 ? "" : "s"} left
              </Badge>
            </div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TimerReset className="size-5 text-primary" />
              Extension Request
            </CardTitle>
            <CardDescription>Rules</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Available during the last {requestWindowLabel} of voting.</li>
              <li>
                The voter list is snapshotted when the poll opens.
              </li>
              <li>
                At least {minimumTurnout} of {request.eligibleVoterCount} eligible
                voter{request.eligibleVoterCount === 1 ? "" : "s"} must respond.
              </li>
              <li>
                Opening a poll uses 1 of your 2 league-wide requests, even if it
                fails.
              </li>
              <li>Each round only gets 1 extension poll.</li>
              {!request.canRequest && helperCopy ? <li>{helperCopy}</li> : null}
            </ul>
            {request.canRequest ? (
              <Button onClick={() => setIsDialogOpen(true)}>
                Request Extension
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open Anonymous Extension Poll</DialogTitle>
              <DialogDescription>
                The requester stays anonymous. The votes stay anonymous. Only
                the reason below will be shown in the poll.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-2">
                <label
                  htmlFor="extension-reason"
                  className="text-sm font-medium text-foreground"
                >
                  Reason
                </label>
                <Textarea
                  id="extension-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Explain why you need more time. This will be shown in the poll."
                  className="min-h-28"
                  maxLength={500}
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Minimum {EXTENSION_REASON_MIN_LENGTH} characters.
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      remainingChars === 0
                        ? "text-success"
                        : "text-muted-foreground",
                    )}
                  >
                    {remainingChars === 0
                      ? "Ready to submit"
                      : `${remainingChars} character${remainingChars === 1 ? "" : "s"} to go`}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreatePoll}
                disabled={isSubmitting || trimmedReason.length < EXTENSION_REASON_MIN_LENGTH}
              >
                Open Poll
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const statusCopy = getPollStatusCopy(poll);
  const isOpen = poll.status === "open";
  const canCurrentUserVote =
    isOpen && poll.currentUserEligibleToVote && poll.currentUserVote === null;

  return (
    <Card className="border-border/80 bg-background/95">
      <CardHeader className="gap-3">
        <CardTitle className="text-lg">{statusCopy.title}</CardTitle>
        <CardDescription>{statusCopy.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <MessageSquareQuote className="size-4" />
            Reason
          </div>
          <p className="text-sm leading-6 text-foreground">{poll.reason}</p>
        </div>

        {isOpen ? (
          canCurrentUserVote ? (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                You can vote in this poll.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-success/30 text-success hover:bg-success/10 hover:text-success"
                  onClick={() => handleVote("grant")}
                  disabled={isVoting !== null}
                >
                  {isVoting === "grant" ? "Saving..." : "Grant Extension"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleVote("deny")}
                  disabled={isVoting !== null}
                >
                  {isVoting === "deny" ? "Saving..." : "No Extension"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
              {poll.currentUserVote ? (
                <CheckCircle2 className="mt-0.5 size-4 text-success" />
              ) : (
                <LockKeyhole className="mt-0.5 size-4" />
              )}
              <div>
                {poll.currentUserVote ? (
                  <p>
                    Voted:{" "}
                    <span className="font-medium text-foreground">
                      {poll.currentUserVote === "grant"
                        ? "Grant extension"
                        : "No extension"}
                    </span>
                    .
                  </p>
                ) : (
                  <p>
                    Voting is limited to the people who were eligible when this
                    poll opened.
                  </p>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
            {poll.appliedExtensionMs > 0 ? (
              <CheckCircle2 className="mt-0.5 size-4 text-success" />
            ) : poll.result === "rejected" ? (
              <XCircle className="mt-0.5 size-4 text-destructive" />
            ) : (
              <Vote className="mt-0.5 size-4" />
            )}
            <p>
              {poll.result === "approved" &&
                "The anonymous poll passed and the deadline moved by 24 hours."}
              {poll.result === "tie" &&
                "The anonymous poll tied, so the deadline moved by 8 hours."}
              {poll.result === "rejected" &&
                "The anonymous poll did not pass, so the deadline stayed the same."}
              {poll.result === "insufficient_turnout" &&
                "Fewer than 50% of eligible voters responded, so the poll had no effect."}
              {poll.result === "closed" &&
                "The round finished before any extension needed to be applied."}
            </p>
          </div>
        )}

        {roundStatus !== "voting" && poll ? (
          <p className="text-xs text-muted-foreground">
            This poll remains visible for round history.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
