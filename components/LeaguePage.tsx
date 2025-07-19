"use client";

import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Play,
  Plus,
  Search,
  Users,
} from "lucide-react";
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
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "./ui/skeleton";

// Mock data for rounds in a league (to be replaced in a future step)
const rounds = [
  {
    id: 1,
    title: "Guilty Pleasures",
    submissions: 8,
    status: "Voting Active",
    isSelected: true,
  },
  {
    id: 2,
    title: "Songs from a Movie",
    submissions: 10,
    status: "Voting Closed",
  },
];

interface LeaguePageProps {
  leagueId: string;
}

export function LeaguePage({ leagueId }: LeaguePageProps) {
  const leagueData = useQuery(api.leagues.get, {
    id: leagueId as Id<"leagues">,
  });
  const selectedRound = rounds.find((r) => r.isSelected);

  const [positiveVotesRemaining, setPositiveVotesRemaining] = useState(0);
  const [negativeVotesRemaining, setNegativeVotesRemaining] = useState(0);

  useEffect(() => {
    if (leagueData) {
      setPositiveVotesRemaining(leagueData.maxPositiveVotes);
      setNegativeVotesRemaining(leagueData.maxNegativeVotes);
    }
  }, [leagueData]);

  if (leagueData === undefined) {
    return (
      <div className="flex-1 overflow-y-auto bg-background p-8 text-white">
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
        <div className="text-center py-10">
          <p className="text-muted-foreground">Loading League...</p>
        </div>
      </div>
    );
  }

  if (leagueData === null) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold">League Not Found</h1>
          <p className="mt-4 text-muted-foreground">
            This league does not exist or you may not have permission to view it.
          </p>
        </div>
      </div>
    );
  }

  const totalPositiveVotes = leagueData.maxPositiveVotes;
  const totalNegativeVotes = leagueData.maxNegativeVotes;

  return (
    <div className="flex-1 overflow-y-auto bg-background text-white">
      <div className="p-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-secondary"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-secondary"
            >
              <ChevronRight />
            </Button>
          </div>
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

        {/* Rounds Section */}
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Rounds</h2>
          <Button variant="outline">
            <Plus className="mr-2 size-4" />
            New Round
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rounds.map((round) => (
            <Card
              key={round.id}
              className="bg-card hover:bg-accent transition-colors cursor-pointer"
            >
              <CardHeader>
                <CardTitle>{round.title}</CardTitle>
                <CardDescription>{round.status}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {round.submissions} submissions
                </p>
              </CardContent>
              <CardFooter>
                <Button className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
                  <Play className="mr-2 size-4 fill-primary-foreground" />
                  View Round
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Divider */}
        <div className="my-12 border-b border-border"></div>

        {/* Selected Round Details */}
        {selectedRound ? (
          <RoundDetail
            round={selectedRound}
            positiveVotesRemaining={positiveVotesRemaining}
            negativeVotesRemaining={negativeVotesRemaining}
            totalPositiveVotes={totalPositiveVotes}
            totalNegativeVotes={totalNegativeVotes}
            setPositiveVotesRemaining={setPositiveVotesRemaining}
            setNegativeVotesRemaining={setNegativeVotesRemaining}
          />
        ) : (
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              Select a round to see the submissions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}