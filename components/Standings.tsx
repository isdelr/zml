"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Crown, TrendingDown, TrendingUp, Medal, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { toSvg } from "jdenticon";
import { Skeleton } from "./ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface StandingsProps {
  leagueId: Id<"leagues">;
}

export function Standings({ leagueId }: StandingsProps) {
  const standings = useQuery(api.leagues.getLeagueStandings, { leagueId });

  if (standings === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 py-1">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (standings.length === 0) {
    return (
      <div className="py-4 text-left text-sm text-muted-foreground">
        No standings to show yet.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {standings.map((player) => (
        <div
          key={player.userId}
          className="flex items-center gap-3 py-1.5 text-left"
        >
          <div className="flex w-5 items-center justify-center text-sm font-semibold text-muted-foreground">
            {player.rank === 1 ? (
              <Crown className="size-4 text-warning" />
            ) : player.rank === 2 ? (
              <span className="text-gray-400">2</span>
            ) : player.rank === 3 ? (
              <span className="text-primary/80 dark:text-primary">3</span>
            ) : (
              <span>{player.rank}</span>
            )}
          </div>
          <Avatar className="size-8">
            <AvatarImage src={player.image} alt={player.name} />
            <AvatarFallback
              dangerouslySetInnerHTML={{ __html: toSvg(player.userId, 32) }}
            />
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 truncate text-sm font-semibold">
                {player.name}
              </p>
              {player.wonOnTieBreak ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="border-primary/25 bg-primary/10 px-1.5 text-[10px] uppercase tracking-[0.12em] text-primary/80 dark:text-primary"
                    >
                      <Flag className="size-3" />
                      TB
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {player.tieBreakSummary ??
                        "Won tie-break on round placements."}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
              player.totalPoints > 0 && "bg-success/10 text-success",
              player.totalPoints < 0 && "bg-destructive/10 text-destructive",
              player.totalPoints === 0 && "bg-secondary text-muted-foreground",
            )}
          >
            {player.totalPoints > 0 && <TrendingUp className="size-3.5" />}
            {player.totalPoints < 0 && <TrendingDown className="size-3.5" />}
            {player.totalPoints === 0 && <Medal className="size-3.5" />}
            <span>{player.totalPoints} pts</span>
          </div>
        </div>
      ))}
    </div>
  );
}
