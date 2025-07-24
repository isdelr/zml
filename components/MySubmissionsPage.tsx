"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Crown,
  ListMusic,
  Medal,
  Play,
  Search,
  TrendingDown,
  TrendingUp,
  Ban,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Song } from "@/types";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "./ui/skeleton";
import { FaSpotify, FaYoutube } from "react-icons/fa";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

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
  const [searchTerm, setSearchTerm] = useState("");
  const { actions: playerActions } = useMusicPlayerStore();
  const mySubmissions = useQuery(api.submissions.getMySubmissions);

  const filteredSubmissions = useMemo(() => {
    if (!mySubmissions) return [];
    if (!searchTerm) return mySubmissions;

    return mySubmissions.filter(
      (submission) =>
        submission &&
        (submission.songTitle
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
          submission.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
          submission.roundTitle
            .toLowerCase()
            .includes(searchTerm.toLowerCase())),
    );
  }, [mySubmissions, searchTerm]);

  const groupedSubmissions = useMemo(() => {
    return filteredSubmissions.reduce<
      Record<string, NonNullable<(typeof filteredSubmissions)[number]>[]>
    >((acc, submission) => {
      if (!submission) return acc;
      const league = submission.leagueName;
      if (!acc[league]) {
        acc[league] = [];
      }
      acc[league].push(submission);
      return acc;
    }, {});
  }, [filteredSubmissions]);

  const SubmissionsSkeleton = () => (
    <div className="space-y-10">
      {[...Array(2)].map((_, i) => (
        <section key={i}>
          <Skeleton className="mb-4 h-7 w-1/3" />
          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-[auto_4fr_3fr_2fr_auto] items-center gap-4 border-b bg-secondary/50 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
              <span className="w-4 text-center">#</span>
              <span>Track</span>
              <span>Round</span>
              <span className="text-center">Result</span>
              <span className="w-24"></span>
            </div>
            <div>
              {[...Array(2)].map((_, j) => (
                <div
                  key={j}
                  className="grid grid-cols-[auto_4fr_3fr_2fr_auto] items-center gap-4 border-b px-4 py-3"
                >
                  <Skeleton className="h-5 w-4" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="size-10 rounded" />
                    <div className="w-full space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <div className="flex justify-center">
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <div className="w-24"></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );

  return (
<div className="flex-1 overflow-y-auto bg-background text-foreground">
      <div className="p-4 md:p-8">
        {/* Header */}
        <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <h1 className="text-4xl font-bold">My Submissions</h1>
          <div className="relative w-full flex-1 md:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search in your submissions..."
              className="h-10 w-full rounded-md border-none bg-secondary pl-10 pr-4 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </header>

        {mySubmissions === undefined ? (
          <SubmissionsSkeleton />
        ) : Object.keys(groupedSubmissions).length === 0 ? (
          <div className="rounded-lg border border-dashed py-20 text-center">
            <h2 className="text-xl font-semibold">
              {searchTerm ? "No Submissions Found" : "No Submissions Yet"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {searchTerm
                ? "Try a different search term."
                : "You haven't submitted any songs to any rounds. Join a league and submit a track!"}
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(groupedSubmissions).map(
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
                    <div className="hidden grid-cols-[auto_4fr_3fr_2fr_auto] items-center gap-4 border-b bg-secondary/50 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground md:grid">
                      <span className="w-4 text-center">#</span>
                      <span>Track</span>
                      <span>Round</span>
                      <span className="text-center">Result</span>
                      <span className="w-24"></span>
                    </div>
                    <div>
                      {submissions.map((submission, index) => (
                        <div
                          key={submission._id}
                          className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b p-3 transition-colors last:border-b-0 hover:bg-accent md:grid-cols-[auto_4fr_3fr_2fr_auto] md:gap-4"
                        >
                          <span className="hidden w-4 text-center text-muted-foreground md:block">
                            {index + 1}
                          </span>
                          <div className="flex items-center gap-4">
                            <Image
                              src={submission.albumArtUrl!}
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
                          <div className="hidden text-sm md:block md:text-base">
                            <p className="font-medium">
                              {submission.roundTitle}
                            </p>
                            <p className="text-muted-foreground capitalize">
                              {submission.status.replace(/_/g, " ")}
                            </p>
                          </div>
                          <div className="flex justify-center">
                            {submission.result.type !== "pending" ? (
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
                                {submission.result.penaltyApplied && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex align-middle">
                                          <Ban className="size-3 text-yellow-500" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>
                                          Your positive votes were annulled in
                                          this round because you did not vote.
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                                  getResultColor(submission.result),
                                )}
                              >
                                <Medal className="size-4" />
                                <span>Pending</span>
                              </div>
                            )}
                          </div>
                          <div className="flex w-auto justify-end gap-1 md:w-24">
                            {submission.submissionType === "file" ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={() =>
                                  playerActions.playSong(submission as Song)
                                }
                              >
                                <Play className="size-4" />
                              </Button>
                            ) : (
                              <a
                                href={submission.songLink!}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                  {submission.submissionType === "spotify" && (
                                    <FaSpotify className="size-4 text-green-500" />
                                  )}
                                  {submission.submissionType === "youtube" && (
                                    <FaYoutube className="size-4 text-red-500" />
                                  )}
                                </Button>
                              </a>
                            )}
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
                          {/* Mobile-only round info */}
                          <div className="col-span-1 -mt-2 pl-[56px] text-sm text-muted-foreground md:hidden">
                            <p className="font-medium">
                              {submission.roundTitle}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}