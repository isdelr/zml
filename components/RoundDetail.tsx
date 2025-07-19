"use client";

import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Bookmark, User } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "./ui/button";

// Mock data for song submissions in a round
// Added maxPositive and maxNegative to simulate per-song limits
const initialSubmissions = [
  {
    id: 1,
    title: "Let Me Down Slowly",
    artist: "Alec Benjamin",
    time: "2:49",
    submittedBy: "Dave",
    points: 0,
    isBookmarked: false,
    isPlaying: true,
    albumArt:
      "https://sp.universal-music.co.jp/moricalliope/sinderella/common/images/main01_sp.png",
    maxPositive: 3,
    maxNegative: -1,
  },
  {
    id: 2,
    title: "lovely",
    artist: "Billie Eilish, Khalid",
    time: "3:20",
    submittedBy: "Alice",
    points: 0,
    isBookmarked: false,
    isPlaying: false,
    albumArt:
      "https://sp.universal-music.co.jp/moricalliope/sinderella/common/images/main01_sp.png",
    maxPositive: 3,
    maxNegative: -1,
  },
  {
    id: 3,
    title: "Be Alright",
    artist: "Dean Lewis",
    time: "3:16",
    submittedBy: "Charlie",
    points: 0,
    isBookmarked: true,
    isPlaying: false,
    albumArt:
      "https://sp.universal-music.co.jp/moricalliope/sinderella/common/images/main01_sp.png",
    maxPositive: 2,
    maxNegative: -1,
  },
  {
    id: 4,
    title: "Someone You Loved",
    artist: "Lewis Capaldi",
    time: "3:02",
    submittedBy: "Eve",
    points: 0,
    isBookmarked: false,
    isPlaying: false,
    albumArt:
      "https://sp.universal-music.co.jp/moricalliope/sinderella/common/images/main01_sp.png",
    maxPositive: 5,
    maxNegative: -1,
  },
  {
    id: 5,
    title: "changes",
    artist: "XXXTENTACION",
    time: "2:02",
    submittedBy: "Bob",
    points: 0,
    isBookmarked: false,
    isPlaying: false,
    albumArt:
      "https://sp.universal-music.co.jp/moricalliope/sinderella/common/images/main01_sp.png",
    maxPositive: 1,
    maxNegative: -1,
  },
  {
    id: 6,
    title: "Kiss It Better",
    artist: "Rihanna",
    time: "4:13",
    submittedBy: "Frank",
    points: 0,
    isBookmarked: true,
    isPlaying: false,
    albumArt:
      "https://sp.universal-music.co.jp/moricalliope/sinderella/common/images/main01_sp.png",
    maxPositive: 3,
    maxNegative: -1,
  },
];

interface Round {
  id: number;
  title: string;
  submissions: number;
  status: string;
}

interface RoundDetailProps {
  round: Round;
  positiveVotesRemaining: number;
  negativeVotesRemaining: number;
  totalPositiveVotes: number;
  totalNegativeVotes: number;
  setPositiveVotesRemaining: React.Dispatch<React.SetStateAction<number>>;
  setNegativeVotesRemaining: React.Dispatch<React.SetStateAction<number>>;
}

export function RoundDetail({
  round,
  positiveVotesRemaining,
  negativeVotesRemaining,
  totalPositiveVotes,
  totalNegativeVotes,
  setPositiveVotesRemaining,
  setNegativeVotesRemaining,
}: RoundDetailProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);

  const handleVote = (songId: number, voteType: "up" | "down") => {
    const song = submissions.find((s) => s.id === songId);
    if (!song) return;

    setSubmissions(
      submissions.map((s) => {
        if (s.id !== songId) return s;

        let newPoints = s.points;
        if (voteType === "up") {
          // If it's downvoted, the first upvote neutralizes it.
          if (s.points < 0) {
            newPoints++;
            setNegativeVotesRemaining((prev) => prev + 1);
          }
          // Otherwise, add a point if budget and song limit allow.
          else if (positiveVotesRemaining > 0 && s.points < s.maxPositive) {
            newPoints++;
            setPositiveVotesRemaining((prev) => prev - 1);
          }
        } else {
          // voteType is 'down'
          // If it's upvoted, the first downvote neutralizes it.
          if (s.points > 0) {
            newPoints--;
            setPositiveVotesRemaining((prev) => prev + 1);
          }
          // Otherwise, subtract a point if budget and song limit allow.
          else if (negativeVotesRemaining > 0 && s.points > s.maxNegative) {
            newPoints--;
            setNegativeVotesRemaining((prev) => prev - 1);
          }
        }
        return { ...s, points: newPoints };
      }),
    );
  };

  return (
    <section>
      <div className="mb-8 flex gap-8">
        <Image
          src="https://i.ytimg.com/vi/J7tp_0lFI0I/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDnX9OH1KITaxV876Nn-gONVGbK_w"
          alt="Round Art"
          width={256}
          height={256}
          className="h-64 w-64 rounded-md object-cover"
        />
        <div className="flex flex-1 flex-col justify-end gap-6">
          <div>
            <p className="text-sm font-bold uppercase">Viewing Round</p>
            <h1 className="text-5xl font-bold text-foreground">
              {round.title}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {round.status} • Voting ends in 2 days.
            </p>
          </div>

          {/* Vote Pool Display */}
          <div className="flex items-center justify-between rounded-lg bg-card border p-4">
            <div>
              <h3 className="font-semibold text-foreground">
                Your Vote Budget
              </h3>
              <p className="text-sm text-muted-foreground">
                Use your votes on the submissions below.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-lg font-bold text-green-400">
                  {positiveVotesRemaining}
                </p>
                <p className="text-xs text-muted-foreground">Upvotes Left</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-red-400">
                  {negativeVotesRemaining}
                </p>
                <p className="text-xs text-muted-foreground">Downvotes Left</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submissions Table Header */}
      <div className="border-b border-border text-xs font-semibold text-muted-foreground">
        <div className="grid grid-cols-[auto_4fr_3fr_2fr_minmax(180px,auto)] items-center gap-4 px-4 py-2">
          <span>#</span>
          <span>TITLE</span>
          <span>SUBMITTED BY</span>
          <span className="text-right">TIME</span>
          <span className="text-center">VOTE</span>
        </div>
      </div>

      {/* Submissions List */}
      <div>
        {submissions.map((song, index) => {
          const canUpvote =
            song.points < 0 ||
            (positiveVotesRemaining > 0 && song.points < song.maxPositive);
          const canDownvote =
            song.points > 0 ||
            (negativeVotesRemaining > 0 && song.points > song.maxNegative);
          const pointColor =
            song.points > 0
              ? "text-green-400"
              : song.points < 0
                ? "text-red-400"
                : "text-muted-foreground";

          return (
            <div
              key={song.id}
              className={cn(
                "grid grid-cols-[auto_4fr_3fr_2fr_minmax(180px,auto)] items-center gap-4 rounded-md px-4 py-2 hover:bg-accent",
                song.isPlaying && "bg-accent text-primary",
              )}
            >
              <div className="flex items-center gap-4">
                <span className="w-4 text-center text-muted-foreground">
                  {index + 1}
                </span>
                <Image
                  src={song.albumArt}
                  alt={song.title}
                  width={40}
                  height={40}
                  className="rounded"
                />
              </div>
              <div>
                <p
                  className={cn(
                    "font-semibold",
                    song.isPlaying ? "text-primary" : "text-foreground",
                  )}
                >
                  {song.title}
                </p>
                <p className="text-sm text-muted-foreground">{song.artist}</p>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="size-4" />
                {song.submittedBy}
              </div>
              <div className="text-right text-muted-foreground">
                {song.time}
              </div>
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Upvote"
                  onClick={() => handleVote(song.id, "up")}
                  disabled={!canUpvote}
                >
                  <ArrowUp
                    className={cn(
                      "size-5",
                      song.points > 0 && "text-green-400",
                    )}
                  />
                </Button>
                <span
                  className={cn(
                    "w-8 text-center font-bold text-lg",
                    pointColor,
                  )}
                >
                  {song.points}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Downvote"
                  onClick={() => handleVote(song.id, "down")}
                  disabled={!canDownvote}
                >
                  <ArrowDown
                    className={cn("size-5", song.points < 0 && "text-red-400")}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Bookmark"
                  className="ml-2"
                >
                  <Bookmark
                    className={cn(
                      "size-5 hover:text-foreground",
                      song.isBookmarked && "fill-yellow-400 text-yellow-400",
                    )}
                  />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
