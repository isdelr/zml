"use client";

import { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import Image from "next/image";
import { toSvg } from "jdenticon";
import { Song } from "@/types";
import { cn } from "@/lib/utils";

const formatDistanceWithHours = (deadline: number) => {
  const now = Date.now();
  const diffMs = deadline - now;

  if (diffMs <= 0) {
    return "ending soon";
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  const parts = [];
  if (days > 0) {
    parts.push(`${days} day${days > 1 ? 's' : ''}`);
  }
  if (hours > 0) {
    parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  }

  if (parts.length === 0) {
    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    return "less than a minute";
  }

  return parts.join(" and ");
};

interface RoundHeaderProps {
  round: Doc<"rounds"> & { art: string | null; submissionCount: number };
  submissions: unknown[] | undefined;
  onPlayAll: (submissions: Song[], startIndex: number) => void;
  positiveVotesRemaining: number;
  negativeVotesRemaining: number;
  hasVoted: boolean; // This now means "isFinal"
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
                ? `Submissions close in ${formatDistanceWithHours(round.submissionDeadline)}`
                : round.status === 'voting'
                  ? `Voting ends in ${formatDistanceWithHours(round.votingDeadline)}`
                  : "Finished"}
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
                {hasVoted ? "Your Vote is Final" : "Your Vote Budget"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {hasVoted
                  ? "Your votes are locked in and cannot be changed."
                  : "Votes are saved automatically. You must use all votes to avoid a penalty."}
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