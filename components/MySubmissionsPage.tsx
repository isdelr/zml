"use client";

import { cn } from "@/lib/utils";
import {
  Crown,
  ListMusic,
  Medal,
  Play,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Song } from "@/types";

// Mock data for user's submissions
// NOTE: This should be replaced with real data from Convex.
const mySubmissions: (Song & {
  leagueId: string;
  roundTitle: string;
  leagueName: string;
  status: string;
  result: { type: string; points: number };
})[] = [
  {
    _id: "sub1",
    songTitle: "Kiss It Better",
    artist: "Rihanna",
    roundTitle: "Guilty Pleasures",
    leagueName: "80s Pop Throwback",
    leagueId: "2",
    status: "Round Finished",
    result: { type: "winner", points: 15 },
    albumArtUrl:
      "https://i.ytimg.com/vi/J7tp_0lFI0I/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDnX9OH1KITaxV876Nn-gONVGbK_w",
    songFileUrl:
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  },
  {
    _id: "sub2",
    songTitle: "99 Luftballons",
    artist: "Nena",
    roundTitle: "80s One-Hit Wonders",
    leagueName: "80s Pop Throwback",
    leagueId: "2",
    status: "Round Finished",
    result: { type: "negative", points: -1 },
    albumArtUrl:
      "https://i.ytimg.com/vi/J7tp_0lFI0I/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDnX9OH1KITaxV876Nn-gONVGbK_w",
    songFileUrl:
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
  },
  {
    _id: "sub3",
    songTitle: "Someone You Loved",
    artist: "Lewis Capaldi",
    roundTitle: "Rainy Day Vibes",
    leagueName: "Indie Heads Unite",
    leagueId: "1",
    status: "Voting Active",
    result: { type: "positive", points: 5 },
    albumArtUrl:
      "https://sp.universal-music.co.jp/moricalliope/sinderella/common/images/main01_sp.png",
    songFileUrl:
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
  },
  {
    _id: "sub4",
    songTitle: "Interstellar Main Theme",
    artist: "Hans Zimmer",
    roundTitle: "Movie Scores",
    leagueName: "Cinema Sonics",
    leagueId: "4",
    status: "Voting Active",
    result: { type: "neutral", points: 0 },
    albumArtUrl:
      "https://sp.universal-music.co.jp/moricalliope/sinderella/common/images/main01_sp.png",
    songFileUrl:
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
  },
];

const getResultIcon = (result: { type: string; points: number }) => {
  switch (result.type) {
    case "winner":
      return <Crown className="size-4" />;
    case "positive":
      return <TrendingUp className="size-4" />;
    case "negative":
      return <TrendingDown className="size-4" />;
    default:
      return <Medal className="size-4" />;
  }
};

const getResultColor = (result: { type: string; points: number }) => {
  switch (result.type) {
    case "winner":
      return "text-yellow-400 border-yellow-400/50 bg-yellow-400/10";
    case "positive":
      return "text-green-400 border-green-400/50 bg-green-400/10";
    case "negative":
      return "text-red-400 border-red-400/50 bg-red-400/10";
    default:
      return "text-muted-foreground border-border bg-secondary";
  }
};

export function MySubmissionsPage() {
  const { actions: playerActions, currentTrackIndex } = useMusicPlayerStore();

  const submissionsByLeague = mySubmissions.reduce<
    Record<string, typeof mySubmissions>
  >((acc, submission) => {
    const league = submission.leagueName;
    if (!acc[league]) {
      acc[league] = [];
    }
    acc[league].push(submission);
    return acc;
  }, {});

  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto bg-background text-foreground", // Keep existing classes
        currentTrackIndex !== null && "pb-24",
      )}
    >
      <div className="p-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-4xl font-bold">My Submissions</h1>
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search in your submissions..."
              className="h-10 w-full rounded-md border-none bg-secondary pl-10 pr-4 text-sm"
            />
          </div>
        </header>

        {/* Grouped Submissions List */}
        <div className="space-y-10">
          {Object.entries(submissionsByLeague).map(
            ([leagueName, submissions]) => (
              <section key={leagueName}>
                <h2 className="mb-4 text-xl font-bold">
                  <Link
                    href={`/leagues/${submissions[0].leagueId}`}
                    className="hover:underline"
                  >
                    {leagueName}
                  </Link>
                </h2>
                <div className="overflow-hidden rounded-md border">
                  {/* Table Header */}
                  <div className="grid grid-cols-[auto_4fr_3fr_2fr_auto] items-center gap-4 border-b bg-secondary/50 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
                    <span className="w-4 text-center">#</span>
                    <span>Track</span>
                    <span>Round</span>
                    <span className="text-center">Result</span>
                    <span className="w-24"></span>
                  </div>
                  {/* Table Body */}
                  <div>
                    {submissions.map((submission, index) => (
                      <div
                        key={submission._id}
                        className="group grid grid-cols-[auto_4fr_3fr_2fr_auto] items-center gap-4 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-accent"
                      >
                        <span className="w-4 text-center text-muted-foreground">
                          {index + 1}
                        </span>
                        <div className="flex items-center gap-4">
                          <Image
                            src={submission.albumArtUrl}
                            alt={submission.songTitle}
                            width={40}
                            height={40}
                            className="aspect-square rounded object-cover"
                          />
                          <div>
                            <p className="font-semibold text-foreground">
                              {submission.songTitle}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {submission.artist}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="font-medium">{submission.roundTitle}</p>
                          <p className="text-sm text-muted-foreground">
                            {submission.status}
                          </p>
                        </div>
                        <div className="flex justify-center">
                          <div
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                              getResultColor(submission.result),
                            )}
                          >
                            {getResultIcon(submission.result)}
                            <span>
                              {submission.result.type === "winner"
                                ? "Winner"
                                : `${submission.result.points} pts`}
                            </span>
                          </div>
                        </div>
                        <div className="flex w-24 justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => playerActions.playSong(submission)}
                          >
                            <Play className="size-4" />
                          </Button>
                          <Link href={`/leagues/${submission.leagueId}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <ListMusic className="size-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
