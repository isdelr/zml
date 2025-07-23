"use client";

import { Doc } from "@/convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import Image from "next/image";
import { toSvg } from "jdenticon";
import { Song } from "@/types";
import { cn } from "@/lib/utils";

interface RoundHeaderProps {
  round: Doc<"rounds"> & { art: string | null; submissionCount: number };
  submissions: unknown[] | undefined;
  onPlayAll: (submissions: Song[], startIndex: number) => void;
  positiveVotesRemaining: number;
  negativeVotesRemaining: number;
  hasVoted: boolean;
  upvotesUsed: number;
  downvotesUsed: number;
  totalDuration: string | null;
}

export function RoundHeader({
  round,
  submissions,
  onPlayAll,
  positiveVotesRemaining,
  negativeVotesRemaining,
  hasVoted,
  upvotesUsed,
  downvotesUsed,
  totalDuration,
}: RoundHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-6 md:flex-row md:gap-8">
      {round.art ? (
        <Image
          src={round.art}
          alt="Round Art"
          width={256}
          height={256}
          className="h-64 w-64 flex-shrink-0 rounded-md object-cover"
        />
      ) : (
        <div
          className="h-64 w-64 flex-shrink-0 rounded-md bg-muted"
          dangerouslySetInnerHTML={{ __html: toSvg(round._id, 256) }}
        />
      )}
      <div className="flex flex-1 flex-col justify-between gap-6">
        <div className="flex flex-col justify-end gap-2">
          <div>
            <p className="text-sm font-bold uppercase">
              {round.status === "submissions"
                ? "Submissions Open"
                : "Viewing Round"}
            </p>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">
              {round.title}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {round.status.charAt(0).toUpperCase() + round.status.slice(1)} •{" "}
              {round.status === "submissions"
                ? `Submissions close in ${formatDistanceToNow(round.submissionDeadline)}`
                : `Voting ends in ${formatDistanceToNow(round.votingDeadline)}`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {round.submissionCount > 0 && (
                <>
                  {round.submissionCount} {round.submissionCount > 1 ? "songs" : "song"}
                  {totalDuration && `, ${totalDuration}`}
                </>
              )}
            </p>
          </div>
          {round.status !== "submissions" &&
            submissions &&
            submissions.length > 0 && (
              <Button
                onClick={() => onPlayAll(submissions as Song[], 0)}
                size="lg"
                className="mt-4 w-full bg-primary text-primary-foreground md:w-fit"
              >
                <Play className="mr-2 size-5" />
                Play All
              </Button>
            )}
        </div>
        {round.status === "voting" && (
          <div
            className={cn(
              "flex flex-col items-start gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between",
              hasVoted ? "border-green-500/50 bg-green-500/10" : "bg-card",
            )}
          >
            <div>
              <h3 className="font-semibold text-foreground">
                {hasVoted ? "Your Submitted Votes" : "Your Vote Budget"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {hasVoted
                  ? "You cannot change your votes for this round."
                  : "You must use all votes to submit."}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-lg font-bold text-green-400">
                  {hasVoted ? upvotesUsed : positiveVotesRemaining}
                </p>
                <p className="text-xs text-muted-foreground">
                  {hasVoted ? "Upvotes Cast" : "Upvotes Left"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-red-400">
                  {hasVoted ? downvotesUsed : negativeVotesRemaining}
                </p>
                <p className="text-xs text-muted-foreground">
                  {hasVoted ? "Downvotes Cast" : "Downvotes Left"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}