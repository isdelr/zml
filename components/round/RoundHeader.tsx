"use client";
import { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import Image from "next/image";
import { toSvg } from "jdenticon";
import { Song } from "@/types";
import { cn, formatDeadline } from "@/lib/utils";

interface RoundHeaderProps {
  round: Doc<"rounds"> & { art: string | null; submissionCount: number };
  submissions: Song[] | undefined;
  onPlayAll: (submissions: Song[], startIndex: number) => void;
  positiveVotesRemaining: number;
  negativeVotesRemaining: number;
  hasVoted: boolean;
  upvotesUsed: number;
  downvotesUsed: number;
  totalDuration: string | null;
  // UI clarity for custom per-round vote limits
  usesCustomLimits?: boolean;
  effectiveMaxUp?: number;
  effectiveMaxDown?: number;
  leagueMaxUp?: number;
  leagueMaxDown?: number;
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
                              usesCustomLimits,
                              effectiveMaxUp,
                              effectiveMaxDown,
                              leagueMaxUp,
                              leagueMaxDown,
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
          className="generated-art h-64 w-64 flex-shrink-0 rounded-md bg-muted"
          dangerouslySetInnerHTML={{ __html: toSvg(round._id, 256) }}
        />
      )}

      <div className="flex flex-1 flex-col justify-between gap-6">
        <div className="flex flex-col justify-end gap-2">
          <div>
            <p className="text-sm font-bold uppercase">
              {round.status === "submissions" ? "Submissions Open" : "Viewing Round"}
            </p>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">
              {round.title}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {round.status.charAt(0).toUpperCase() + round.status.slice(1)} •{" "}
              {round.status === "submissions"
                ? `Submissions close ${formatDeadline(round.submissionDeadline)}`
                : round.status === "voting"
                  ? `Voting ends ${formatDeadline(round.votingDeadline)}`
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
            <p className="mt-2 text-sm text-muted-foreground">
              {round.description}
            </p>
            {usesCustomLimits && (
              <span
                className="mt-2 inline-flex w-fit items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                title={`League defaults: +${leagueMaxUp} / -${leagueMaxDown}`}
              >
                Custom vote limits: <span className="font-semibold">+{effectiveMaxUp}</span> / <span className="font-semibold">-{effectiveMaxDown}</span>
              </span>
            )}
          </div>
          {round.status !== "submissions" && submissions && (submissions).length > 0 && (
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
              hasVoted ? "border-success/50 bg-success/10" : "bg-card",
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
                <p className="text-lg font-bold text-success">
                  {hasVoted ? upvotesUsed : positiveVotesRemaining}
                </p>
                <p className="text-xs text-muted-foreground">
                  {hasVoted ? "Upvotes Cast" : "Upvotes Left"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-destructive">
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
