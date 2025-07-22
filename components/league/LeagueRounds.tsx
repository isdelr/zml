"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LeagueRoundsProps {
  rounds: unknown[] | undefined;
  selectedRoundId: string | null;
  onRoundSelect: (roundId: string) => void;
}

export function LeagueRounds({
  rounds,
  selectedRoundId,
  onRoundSelect,
}: LeagueRoundsProps) {
  if (rounds === undefined) {
    return <RoundsSkeleton />;
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
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rounds.map((round) => (
        <Card
          key={round._id}
          onClick={() => onRoundSelect(round._id)}
          className={cn(
            "cursor-pointer bg-card transition-colors hover:bg-accent",
            selectedRoundId === round._id ? "ring-2 ring-primary" : ""
          )}
        >
          <CardHeader>
            <CardTitle>{round.title}</CardTitle>
            <CardDescription>
              {round.status.charAt(0).toUpperCase() + round.status.slice(1)}
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
  );
}

function RoundsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="mb-1 mt-4 h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-5 w-1/3" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}