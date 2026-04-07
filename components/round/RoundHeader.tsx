"use client";
import { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { toSvg } from "jdenticon";
import { Song } from "@/types";
import { formatDeadline } from "@/lib/utils";
import { RoundParticipationSummary } from "@/components/round/RoundParticipationSummary";
import type { ReactNode } from "react";
import { MediaImage } from "@/components/ui/media-image";

type Participant = {
  _id?: string;
  name?: string | null;
  image?: string | null;
};

interface RoundHeaderProps {
  round: Doc<"rounds"> & { art: string | null };
  submissionCount: number;
  submissions: Song[] | undefined;
  onPlayAll: (submissions: Song[], startIndex: number) => void;
  totalDuration: string | null;
  // UI clarity for custom per-round vote limits
  usesCustomLimits?: boolean;
  effectiveMaxUp?: number;
  effectiveMaxDown?: number;
  leagueMaxUp?: number;
  leagueMaxDown?: number;
  participationGroups?: {
    label: string;
    users: Participant[];
  }[];
  adminControls?: ReactNode;
}

export function RoundHeader({
  round,
  submissionCount,
  submissions,
  onPlayAll,
  totalDuration,
  usesCustomLimits,
  effectiveMaxUp,
  effectiveMaxDown,
  leagueMaxUp,
  leagueMaxDown,
  participationGroups,
  adminControls,
}: RoundHeaderProps) {
  const showPlayAll =
    round.status !== "submissions" &&
    round.status !== "scheduled" &&
    submissions &&
    submissions.length > 0;
  const showParticipationSummary =
    participationGroups && participationGroups.length > 0;

  return (
    <div className="mb-8 flex flex-col gap-6 xl:flex-row xl:gap-8">
      {round.art ? (
        <MediaImage
          src={round.art}
          alt="Round Art"
          width={256}
          height={256}
          className="aspect-square h-auto w-full max-w-sm shrink-0 rounded-md object-cover xl:h-64 xl:w-64"
          renderFallback={() => (
            <div
              className="generated-art aspect-square h-auto w-full max-w-sm shrink-0 rounded-md bg-muted xl:h-64 xl:w-64"
              dangerouslySetInnerHTML={{ __html: toSvg(round._id, 256) }}
            />
          )}
        />
      ) : (
        <div
          className="generated-art aspect-square h-auto w-full max-w-sm shrink-0 rounded-md bg-muted xl:h-64 xl:w-64"
          dangerouslySetInnerHTML={{ __html: toSvg(round._id, 256) }}
        />
      )}

      <div className="flex flex-1 flex-col justify-between gap-6">
        <div className="flex flex-col justify-end gap-2">
          <div>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">
              {round.title}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {round.status.charAt(0).toUpperCase() + round.status.slice(1)} •{" "}
              {round.status === "scheduled"
                ? `Submissions open ${formatDeadline(round.submissionStartsAt ?? round.submissionDeadline)}`
                : round.status === "submissions"
                  ? `Submissions close ${formatDeadline(round.submissionDeadline)}`
                  : round.status === "voting"
                    ? `Voting ends ${formatDeadline(round.votingDeadline)}`
                    : "Finished"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {submissionCount > 0 && (
                <>
                  {submissionCount} {submissionCount > 1 ? "songs" : "song"}
                  {totalDuration && `, ${totalDuration}`}
                </>
              )}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {round.description}
            </p>
            {usesCustomLimits && (
              <span
                className="accent-pill mt-2 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium text-primary"
                title={`League defaults: +${leagueMaxUp} / -${leagueMaxDown}`}
              >
                Custom vote limits:{" "}
                <span className="font-semibold">+{effectiveMaxUp}</span> /{" "}
                <span className="font-semibold">-{effectiveMaxDown}</span>
              </span>
            )}
          </div>
          {(showPlayAll || showParticipationSummary || adminControls) && (
            <div className="mt-4 flex flex-col gap-4">
              {(showPlayAll || showParticipationSummary) && (
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
                  {showPlayAll && (
                    <Button
                      onClick={() => onPlayAll(submissions as Song[], 0)}
                      size="lg"
                      className="w-full bg-primary text-primary-foreground lg:w-fit"
                    >
                      <Play className="mr-2 size-5" />
                      Play All
                    </Button>
                  )}
                  {showParticipationSummary && (
                    <RoundParticipationSummary groups={participationGroups} />
                  )}
                </div>
              )}
              {adminControls}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
