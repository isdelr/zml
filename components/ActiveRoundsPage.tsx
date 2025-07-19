"use client";

import { Clock, Play, Plus, Search, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";

// Mock data for active rounds across different leagues
const activeRounds = [
  {
    id: 1,
    roundTitle: "Guilty Pleasures",
    leagueName: "80s Pop Throwback",
    leagueId: "2",
    status: "Voting Active",
    timeRemaining: "2 days",
    art: "https://i.ytimg.com/vi/J7tp_0lFI0I/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDnX9OH1KITaxV876Nn-gONVGbK_w",
  },
  {
    id: 2,
    roundTitle: "Rainy Day Vibes",
    leagueName: "Indie Heads Unite",
    leagueId: "1",
    status: "Submissions Open",
    timeRemaining: "4 days",
    art: "https://sp.universal-music.co.jp/moricalliope/sinderella/common/images/main01_sp.png",
  },
  {
    id: 3,
    roundTitle: "West Coast Anthems",
    leagueName: "Hip-Hop Heavyweights",
    leagueId: "3",
    status: "Voting Active",
    timeRemaining: "1 day",
    art: "https://i.ytimg.com/vi/J7tp_0lFI0I/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDnX9OH1KITaxV876Nn-gONVGbK_w",
  },
  {
    id: 4,
    roundTitle: "Movie Scores",
    leagueName: "Cinema Sonics",
    leagueId: "4",
    status: "Submissions Open",
    timeRemaining: "6 days",
    art: "https://sp.universal-music.co.jp/moricalliope/sinderella/common/images/main01_sp.png",
  },
];

export function ActiveRoundsPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground">
      <div className="p-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-4xl font-bold">Active Rounds</h1>
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search in your active rounds..."
              className="h-10 w-full rounded-md border-none bg-secondary pl-10 pr-4 text-sm"
            />
          </div>
          <Link href="/leagues/create">
            <Button>
              <Plus className="mr-2 size-4" />
              Create League
            </Button>
          </Link>
        </header>

        {/* Rounds Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {activeRounds.map((round) => (
            <Card
              key={round.id}
              className="group bg-card transition-colors hover:bg-accent flex flex-col"
            >
              <CardHeader>
                <div className="relative mb-4">
                  <Image
                    src={round.art}
                    alt={round.leagueName}
                    width={250}
                    height={250}
                    className="aspect-square w-full rounded-md object-cover"
                  />
                </div>
                <CardTitle>{round.roundTitle}</CardTitle>
                <CardDescription>
                  In{" "}
                  <span className="font-semibold text-foreground">
                    {round.leagueName}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" />
                  <span>
                    {round.status} • Ends in {round.timeRemaining}
                  </span>
                </div>
              </CardContent>
              <CardFooter>
                <Link href={`/leagues/${round.leagueId}`} className="w-full">
                  <Button className="w-full font-bold">
                    {round.status === "Voting Active" ? (
                      <>
                        <Play className="mr-2 size-4 fill-primary-foreground" />
                        Vote Now
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 size-4" />
                        Submit Track
                      </>
                    )}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
