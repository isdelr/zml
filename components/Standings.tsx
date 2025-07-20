"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Crown, TrendingDown, TrendingUp, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import { toSvg } from "jdenticon";

interface StandingsProps {
  leagueId: Id<"leagues">;
}

const StandingsSkeleton = () => (
  <Card>
    <CardHeader>
      <CardTitle>League Standings</CardTitle>
      <CardDescription>Calculating the current scores...</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center justify-between p-2">
          <div className="flex items-center gap-4">
            <Skeleton className="size-6 w-6" />
            <Skeleton className="size-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      ))}
    </CardContent>
  </Card>
);

export function Standings({ leagueId }: StandingsProps) {
  const standings = useQuery(api.leagues.getLeagueStandings, { leagueId });

  if (standings === undefined) {
    return <StandingsSkeleton />;
  }

  if (standings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>League Standings</CardTitle>
          <CardDescription>The leaderboard for this league.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-10 text-center text-muted-foreground">
            <p>No standings to show yet.</p>
            <p className="text-sm">
              Finish a round and cast some votes to get started!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>League Standings</CardTitle>
        <CardDescription>
          The leaderboard based on points from finished rounds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {standings.map((player, index) => (
            <div
              key={player.userId}
              className="flex items-center justify-between gap-4 rounded-md p-2 transition-colors hover:bg-accent"
            >
              <div className="flex items-center gap-4">
                <div className="flex w-6 items-center justify-center text-lg font-bold text-muted-foreground">
                  {index === 0 ? (
                    <Crown className="size-6 text-yellow-400" />
                  ) : index === 1 ? (
                    <span className="text-gray-400">2</span>
                  ) : index === 2 ? (
                    <span className="text-amber-600">3</span>
                  ) : (
                    <span className="text-sm">{index + 1}</span>
                  )}
                </div>
                <Avatar className="size-10">
                  <AvatarImage src={player.image} alt={player.name} />
                  <AvatarFallback
                    dangerouslySetInnerHTML={{ __html: toSvg(player.userId, 40) }}
                  />
                </Avatar>
                <div>
                  <p className="font-semibold">{player.name}</p>
                </div>
              </div>
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
                  player.totalPoints > 0 && "bg-green-500/10 text-green-400",
                  player.totalPoints < 0 && "bg-red-500/10 text-red-400",
                  player.totalPoints === 0 &&
                    "bg-secondary text-muted-foreground",
                )}
              >
                {player.totalPoints > 0 && <TrendingUp className="size-4" />}
                {player.totalPoints < 0 && <TrendingDown className="size-4" />}
                {player.totalPoints === 0 && <Medal className="size-4" />}
                <span>{player.totalPoints} pts</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}