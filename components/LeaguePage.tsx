"use client";

import { Bell, Play, Search, Users } from "lucide-react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { RoundDetail } from "./RoundDetail";
import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "./ui/skeleton";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";

interface LeaguePageProps {
  leagueId: string;
}

export function LeaguePage({ leagueId }: LeaguePageProps) {
  const leagueData = useQuery(api.leagues.get, {
    id: leagueId as Id<"leagues">,
  });
  const rounds = useQuery(api.rounds.getForLeague, {
    leagueId: leagueId as Id<"leagues">,
  });
  const [selectedRoundId, setSelectedRoundId] = useState<Id<"rounds"> | null>(
    null,
  );
  const currentTrackIndex = useMusicPlayerStore(
    (state) => state.currentTrackIndex,
  );

  useEffect(() => {
    // Set the first round as selected by default when rounds load
    if (rounds && rounds.length > 0 && !selectedRoundId) {
      setSelectedRoundId(rounds[0]._id);
    }
  }, [rounds, selectedRoundId]);

  const selectedRound = rounds?.find((r) => r._id === selectedRoundId);

  const RoundsSkeleton = () => (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-1/4" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );

  if (leagueData === undefined) {
    return (
      <div className="flex-1 overflow-y-auto bg-background p-8 ">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full max-w-xs" />
          <Skeleton className="size-6" />
        </header>
        <div className="mb-12">
          <Skeleton className="mb-4 h-16 w-3/4" />
          <div className="flex items-center gap-6">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-48" />
          </div>
        </div>
        <div className="py-10 text-center">
          <p className="text-muted-foreground">Loading League...</p>
        </div>
      </div>
    );
  }

  if (leagueData === null) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background ">
        <div className="text-center">
          <h1 className="text-4xl font-bold">League Not Found</h1>
          <p className="mt-4 text-muted-foreground">
            This league does not exist or you may not have permission to view
            it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto bg-background  ", // Keep existing classes
        currentTrackIndex !== null && "pb-24",
      )}
    >
      <div className="p-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4"></div>
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search in League"
              className="h-10 w-full rounded-md border-none bg-secondary pl-10 pr-4 text-sm"
            />
          </div>
          <div>
            <Bell className="size-6 text-muted-foreground" />
          </div>
        </header>

        {/* League Info */}
        <div className="mb-12">
          <h1 className="text-6xl font-bold">{leagueData.name}</h1>
          <div className="mt-4 flex items-center gap-6 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="size-5" />
              <span>{leagueData.memberCount} Members</span>
            </div>
            <span>
              Created by{" "}
              <strong className="text-foreground">
                {leagueData.creatorName}
              </strong>
            </span>
          </div>
        </div>

        {rounds === undefined ? (
          <RoundsSkeleton />
        ) : rounds.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center">
            <h3 className="text-lg font-semibold">No Rounds Yet</h3>
            <p className="mt-1 text-muted-foreground">
              Create the first round for this league.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rounds.map((round) => (
              <Card
                key={round._id}
                onClick={() => setSelectedRoundId(round._id)}
                className={`cursor-pointer bg-card transition-colors hover:bg-accent ${
                  selectedRoundId === round._id ? "ring-2 ring-primary" : ""
                }`}
              >
                <CardHeader>
                  <CardTitle>{round.title}</CardTitle>
                  <CardDescription>
                    {round.status.charAt(0).toUpperCase() +
                      round.status.slice(1)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {round.submissionCount} submissions
                  </p>
                </CardContent>
                <CardFooter>
                  <Button className="w-full bg-primary font-bold text-primary-foreground hover:bg-primary/90">
                    <Play className="mr-2 size-4 fill-primary-foreground" />
                    View Round
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="my-12 border-b border-border"></div>

        {/* Selected Round Details */}
        {selectedRound && leagueData ? (
          <RoundDetail
            round={selectedRound}
            league={{
              maxPositiveVotes: leagueData.maxPositiveVotes,
              maxNegativeVotes: leagueData.maxNegativeVotes,
            }}
            isOwner={leagueData.isOwner}
          />
        ) : rounds && rounds.length > 0 ? (
          <div className="py-10 text-center">
            <p className="text-muted-foreground">
              Select a round to see the details.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
