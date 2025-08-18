"use client";
import { Skeleton } from "@/components/ui/skeleton";
import { RoundListItem } from "./RoundListItem";
import { Doc } from "@/convex/_generated/dataModel";

interface LeagueRoundsProps {
  rounds: Doc<"rounds">[];
  selectedRoundId: string | null;
  leagueId: string;
}

export function LeagueRounds({
                               rounds,
                               selectedRoundId,
                               leagueId,
                             }: LeagueRoundsProps) {
  if (!rounds || rounds.length === 0) {
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
          isSelected={selectedRoundId === (round)._id}
        />
      ))}
    </div>
  );
}

export function RoundsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="flex h-[68px] items-center gap-4 rounded-lg border p-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-6 rounded-md" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="flex-1">
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-6 w-24 hidden md:block" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}
