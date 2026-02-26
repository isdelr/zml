"use client";
import { RoundListItem } from "./RoundListItem";
import { Id } from "@/convex/_generated/dataModel";
import type { RoundForLeague } from "@/lib/convex/types";

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
    return null;
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
