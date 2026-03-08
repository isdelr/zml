"use client";
import { RoundListItem } from "./RoundListItem";
import { Id } from "@/convex/_generated/dataModel";
import type { RoundForLeague } from "@/lib/convex/types";
import { Skeleton } from "@/components/ui/skeleton";

interface LeagueRoundsProps {
  rounds: RoundForLeague[];
  hasLoaded: boolean;
  selectedRoundId: Id<"rounds"> | null;
  leagueId: string;
}

export function LeagueRounds({
  rounds,
  hasLoaded,
  selectedRoundId,
  leagueId,
}: LeagueRoundsProps) {
  if (!hasLoaded) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border p-3"
          >
            <div className="flex items-center gap-4 md:hidden">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="hidden items-center gap-4 md:grid md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)]">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-10 text-center">
        <h3 className="text-lg font-semibold">No Rounds Yet</h3>
        <p className="mt-1 text-muted-foreground">
          Create the first round for this league.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rounds.map((round) => (
        <RoundListItem
          key={round._id}
          round={round}
          leagueId={leagueId}
          isSelected={selectedRoundId === round._id}
        />
      ))}
    </div>
  );
}
