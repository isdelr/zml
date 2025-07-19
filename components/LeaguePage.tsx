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
import { useState } from "react";

// Mock data for rounds in a league
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
  {
    id: 3,
    title: "90s One-Hit Wonders",
    submissions: 12,
    status: "Voting Closed",
  },
  {
    id: 4,
    title: "Upcoming: Rainy Day Vibes",
    submissions: 0,
    status: "Submissions Open",
  },
];

export function LeaguePage() {
  const selectedRound = rounds.find((r) => r.isSelected);

  // State for the user's pool of votes
  const [positiveVotesRemaining, setPositiveVotesRemaining] = useState(5);
  const [negativeVotesRemaining, setNegativeVotesRemaining] = useState(1);
  const totalPositiveVotes = 5;
  const totalNegativeVotes = 1;

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
          <h1 className="text-6xl font-bold">80s Pop Throwback League</h1>
          <div className="mt-4 flex items-center gap-6 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="size-5" />
              <span>12 Members</span>
            </div>
            <span>
              Created by <strong className="text-foreground">Erin</strong>
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