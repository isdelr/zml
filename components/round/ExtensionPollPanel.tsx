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
} from "@/lib/rounds/extension-polls";
import { cn } from "@/lib/utils";

type ExtensionPollState = FunctionReturnType<
  typeof api.extensionPolls.getForRound
>;
type ExtensionPollType = NonNullable<ExtensionPollState>["type"];

function getPhaseLabel(
  pollType: ExtensionPollType,
  options: { capitalized?: boolean } = {},
) {
  const label = pollType === "submission" ? "submission" : "voting";
  return options.capitalized
    ? `${label.charAt(0).toUpperCase()}${label.slice(1)}`
    : label;
}

function getDeadlineLabel(pollType: ExtensionPollType) {
  return `${getPhaseLabel(pollType)} deadline`;
}

function getEligibilitySnapshotCopy(pollType: ExtensionPollType) {
  return pollType === "submission"
    ? "had already submitted"
    : "had already finished voting";
}

function getPendingParticipantCopy(pollType: ExtensionPollType) {
  return pollType === "submission"
    ? "Only participants who are still submitting can request more time."
    : "Only participants who are still voting can request more time.";
}

function getRequestEligibilityCopy(
  reason: NonNullable<ExtensionPollState>["request"]["eligibilityReason"],
  requestWindowLabel: string,
  pollType: ExtensionPollType,
) {
  const phaseLabel = getPhaseLabel(pollType);

  switch (reason) {
    case "already_used_limit":
      return "You have already used both shared extension requests available in this league. Submission and voting polls spend from the same pool, and opening a poll spends a request whether it passes or fails.";
    case "not_pending_participant":
      return getPendingParticipantCopy(pollType);
    case "no_eligible_voters":
      return pollType === "submission"
        ? "A submission extension poll needs at least one member who had already submitted before it can open."
        : "A voting extension poll needs at least one completed voter before it can open.";
    case "outside_window":
      return pollType === "submission"
        ? null
        : `${getPhaseLabel(pollType, { capitalized: true })} extension requests only open during the last ${requestWindowLabel} of ${phaseLabel}.`;
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
  pollType: ExtensionPollType,
) {
  const phaseTitle = getPhaseLabel(pollType, { capitalized: true });
  const deadlineLabel = getDeadlineLabel(pollType);

  if (poll.status === "open") {
    return {
      title: `${phaseTitle} Extension Request`,
      description: `A ${getPhaseLabel(pollType)} extension poll is currently open for this round.`,
    };
  }

  switch (poll.result) {
    case "approved":
      return {
        title: `${phaseTitle} extension approved`,
        description: `The ${deadlineLabel} was extended by 24 hours.`,
      };
    case "tie":
      return {
        title: `${phaseTitle} extension tied`,
        description: `The poll tied, so the ${deadlineLabel} was extended by 8 hours.`,
      };
    case "rejected":
      return {
        title: `${phaseTitle} extension rejected`,
        description: `The ${deadlineLabel} stayed the same.`,
      };
    case "insufficient_turnout":
      return {
        title: `${phaseTitle} extension poll invalid`,
        description:
          "Fewer than 50% of eligible members participated, so no result was applied.",
      };
    default:
      return {
        title: `${phaseTitle} extension poll closed`,
        description: `The ${deadlineLabel} did not change.`,
      };
  }
}

interface ExtensionPollPanelProps {
  state: ExtensionPollState | undefined;
  roundId: Id<"rounds">;
  roundStatus: "scheduled" | "submissions" | "voting" | "finished";
  pollType: ExtensionPollType;
}

export function ExtensionPollPanel({
  state,
  roundId,
  roundStatus,
  pollType,
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

  const phaseLabel = getPhaseLabel(pollType);
  const phaseTitle = getPhaseLabel(pollType, { capitalized: true });
  const deadlineLabel = getDeadlineLabel(pollType);
  const { poll, request } = state;
  const requestWindowLabel = formatExtensionPollRequestWindowLabel(
    request.requestWindowMs,
  );
  const helperCopy = !poll
    ? getRequestEligibilityCopy(
        request.eligibilityReason,
        requestWindowLabel,
        pollType,
      )
    : null;

  const handleCreatePoll = async () => {
    if (trimmedReason.length < EXTENSION_REASON_MIN_LENGTH) {
      toast.error(
        `Please enter at least ${EXTENSION_REASON_MIN_LENGTH} characters for the reason.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await createPoll({ roundId, type: pollType, reason: trimmedReason });
      toast.success(`${phaseTitle} extension poll opened.`);
      setReason("");
      setIsDialogOpen(false);
    } catch (error: unknown) {
      toast.error(
        toErrorMessage(error, `Failed to open ${phaseLabel} extension poll.`),
      );
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
      toast.success(
        result.resolved ? "Vote recorded. Poll resolved." : "Vote recorded.",
      );
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
              {phaseTitle} Extension Request
            </CardTitle>
            <CardDescription>Rules</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {pollType === "voting" ? (
                <li>
                  Available during the last {requestWindowLabel} of {phaseLabel}.
                </li>
              ) : null}
              <li>The voter list is snapshotted when the poll opens.</li>
              {pollType === "voting" ? (
                <li>
                  Voting is limited to members who{" "}
                  {getEligibilitySnapshotCopy(pollType)} when the poll opens.
                </li>
              ) : null}
              <li>
                Opening a poll uses 1 of your 2 league-wide requests, shared
                between submission and voting, even if it fails.
              </li>
              <li>Each round only gets 1 {phaseLabel} extension poll.</li>
              {!request.canRequest && helperCopy ? <li>{helperCopy}</li> : null}
            </ul>
            {request.canRequest ? (
              <Button onClick={() => setIsDialogOpen(true)}>
                Request {phaseTitle} Extension
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open Anonymous {phaseTitle} Extension Poll</DialogTitle>
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
                  placeholder={`Explain why you need more time for ${phaseLabel}. This will be shown in the poll.`}
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
                disabled={
                  isSubmitting ||
                  trimmedReason.length < EXTENSION_REASON_MIN_LENGTH
                }
              >
                Open {phaseTitle} Poll
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const statusCopy = getPollStatusCopy(poll, pollType);
  const isOpen = poll.status === "open";
  const canCurrentUserVote =
    isOpen && poll.currentUserEligibleToVote && poll.currentUserVote === null;
  const showLiveVoteCount = isOpen && poll.canCurrentUserSeeLiveVoteCount;

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

        {showLiveVoteCount ? (
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <Vote className="mt-0.5 size-4 text-primary" />
            <div className="space-y-1">
              <p className="text-foreground">
                Current turnout:{" "}
                <span className="font-medium">
                  {poll.totalVotes} of {poll.eligibleVoterCount}
                </span>{" "}
                eligible votes cast.
              </p>
              <p className="text-muted-foreground">
                At least {poll.minimumTurnout} vote
                {poll.minimumTurnout === 1 ? "" : "s"} are needed for the poll
                to count.
              </p>
            </div>
          </div>
        ) : null}

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
                    Voting is limited to the members who {getEligibilitySnapshotCopy(pollType)} when this poll opened.
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
                `The anonymous poll passed and the ${deadlineLabel} moved by 24 hours.`}
              {poll.result === "tie" &&
                `The anonymous poll tied, so the ${deadlineLabel} moved by 8 hours.`}
              {poll.result === "rejected" &&
                `The anonymous poll did not pass, so the ${deadlineLabel} stayed the same.`}
              {poll.result === "insufficient_turnout" &&
                "Fewer than 50% of eligible members responded, so the poll had no effect."}
              {poll.result === "closed" &&
                `The ${phaseLabel} extension poll closed before any extension needed to be applied.`}
            </p>
          </div>
        )}

        {roundStatus === "finished" ? (
          <p className="text-xs text-muted-foreground">
            This {phaseLabel} extension poll remains visible for round history.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
