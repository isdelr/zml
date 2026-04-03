"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  CheckCircle2,
  Clock3,
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
import { formatDeadline } from "@/lib/utils";
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
  getExtensionPollMinimumTurnout,
} from "@/lib/rounds/extension-polls";
import { cn } from "@/lib/utils";

type ExtensionPollState = FunctionReturnType<typeof api.extensionPolls.getForRound>;

function getRequestEligibilityCopy(
  reason: NonNullable<ExtensionPollState>["request"]["eligibilityReason"],
) {
  switch (reason) {
    case "already_used_limit":
      return "You have already used both extension requests available in this league.";
    case "not_pending_voter":
      return "Only participants who are still voting can request more time.";
    case "no_eligible_voters":
      return "An extension poll needs at least one completed voter before it can open.";
    default:
      return null;
  }
}

function getPollStatusCopy(
  poll: NonNullable<NonNullable<ExtensionPollState>["poll"]>,
) {
  if (poll.status === "open") {
    return {
      badge: "Open",
      badgeClassName: "border-primary/30 bg-primary/10 text-primary",
      title: "Anonymous extension request",
      description:
        "Only voters who had already finalized their ballot when this poll opened can respond.",
    };
  }

  switch (poll.result) {
    case "approved":
      return {
        badge: "Approved",
        badgeClassName: "border-success/30 bg-success/10 text-success",
        title: "Extension approved",
        description: "Yes won. Voting was extended by 24 hours.",
      };
    case "tie":
      return {
        badge: "Tie",
        badgeClassName: "border-warning/30 bg-warning/10 text-warning",
        title: "Extension tied",
        description: "The poll tied, so voting was extended by 8 hours.",
      };
    case "rejected":
      return {
        badge: "No Extension",
        badgeClassName: "border-destructive/30 bg-destructive/10 text-destructive",
        title: "Extension rejected",
        description: "No won. The voting deadline stayed the same.",
      };
    case "insufficient_turnout":
      return {
        badge: "Turnout Too Low",
        badgeClassName: "border-warning/30 bg-warning/10 text-warning",
        title: "Extension poll invalid",
        description:
          "Fewer than 50% of eligible voters participated, so no result was applied.",
      };
    default:
      return {
        badge: "Closed",
        badgeClassName: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
        title: "Extension poll closed",
        description: "Voting ended before an extension needed to be applied.",
      };
  }
}

function formatExtensionLabel(extensionMs: number) {
  if (extensionMs === 24 * 60 * 60 * 1000) {
    return "24 hours";
  }
  if (extensionMs === 8 * 60 * 60 * 1000) {
    return "8 hours";
  }
  return `${Math.round(extensionMs / (60 * 60 * 1000))} hours`;
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

  const helperCopy = useMemo(() => {
    if (!state || state.poll) {
      return null;
    }
    return getRequestEligibilityCopy(state.request.eligibilityReason);
  }, [state]);

  if (!state) {
    return null;
  }

  const { poll, request } = state;
  if (!poll && !request.canRequest && !helperCopy) {
    return null;
  }
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
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-primary/30 bg-primary/10 text-primary">
                Last 24 hours
              </Badge>
              <Badge variant="outline">
                {request.remainingRequests} request
                {request.remainingRequests === 1 ? "" : "s"} left
              </Badge>
            </div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TimerReset className="size-5 text-primary" />
              Need more time to finish voting?
            </CardTitle>
            <CardDescription>
              Open an anonymous poll. People who had already finished voting
              when it opens will decide whether this round gets +24h, +8h on a
              tie, or no extension. At least 50% of eligible voters must
              respond for the result to count.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {request.canRequest
                ? `The poll electorate snapshots ${request.eligibleVoterCount} completed voter${request.eligibleVoterCount === 1 ? "" : "s"} right away, and at least ${minimumTurnout} vote${minimumTurnout === 1 ? "" : "s"} must come in for the result to count.`
                : helperCopy}
            </div>
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
              <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                <p>Yes wins: +24 hours</p>
                <p>Tie: +8 hours</p>
                <p>No wins: no extension</p>
                <p>
                  Minimum turnout: {minimumTurnout} of {request.eligibleVoterCount}{" "}
                  eligible voter{request.eligibleVoterCount === 1 ? "" : "s"}
                </p>
              </div>

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
  const resultLine =
    poll.appliedExtensionMs > 0
      ? `Applied extension: ${formatExtensionLabel(poll.appliedExtensionMs)}`
      : poll.status === "resolved"
        ? "No extension was applied."
        : `Yes wins: +24h, tie: +8h, no wins: no change. At least ${minimumTurnout} anonymous vote${minimumTurnout === 1 ? "" : "s"} are required for the result to count.`;

  return (
    <Card className="border-border/80 bg-background/95">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={statusCopy.badgeClassName}>{statusCopy.badge}</Badge>
          <Badge variant="outline">
            {poll.totalVotes}/{poll.eligibleVoterCount} anonymous vote
            {poll.eligibleVoterCount === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline">
            50% turnout: {minimumTurnout}/{poll.eligibleVoterCount}
          </Badge>
          {poll.status === "open" ? (
            <Badge variant="outline" className="gap-1">
              <Clock3 className="size-3.5" />
              Closes {formatDistanceToNowStrict(poll.resolvesAt, { addSuffix: true })}
            </Badge>
          ) : null}
        </div>
        <CardTitle className="text-lg">{statusCopy.title}</CardTitle>
        <CardDescription>{statusCopy.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <MessageSquareQuote className="size-4" />
            Reason shown to voters
          </div>
          <p className="text-sm leading-6 text-foreground">{poll.reason}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-success/20 bg-success/5 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-success">
              Grant
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {poll.yesVotes}
            </div>
          </div>
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-destructive">
              No Extension
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {poll.noVotes}
            </div>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Timing
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {poll.status === "open"
                ? `Closes ${formatDeadline(poll.resolvesAt)}`
                : `Resolved ${poll.resolvedAt ? format(new Date(poll.resolvedAt), "MMM d, yyyy 'at' h:mm a") : "just now"}`}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
          {resultLine}
        </div>

        {isOpen ? (
          poll.canCurrentUserVote ? (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                You can vote in this poll because you had already finalized your
                ballot when it opened.
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
                    Your anonymous vote is locked in:{" "}
                    <span className="font-medium text-foreground">
                      {poll.currentUserVote === "grant"
                        ? "Grant extension"
                        : "No extension"}
                    </span>
                    .
                  </p>
                ) : (
                  <p>
                    Only voters who had already finished voting when this poll
                    opened can respond.
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
