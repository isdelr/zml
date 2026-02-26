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
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Song } from "@/types";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import type { FunctionReturnType } from "convex/server";
import { YouTubeIcon } from "@/components/icons/BrandIcons";

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
      return "text-warning border-warning/50 bg-warning/10";
    case "positive":
      return "text-success border-success/50 bg-success/10";
    case "negative":
      return "text-destructive border-destructive/50 bg-destructive/10";
    default:
      return "text-muted-foreground border-border bg-secondary";
  }
};

type MySubmission = FunctionReturnType<typeof api.submissions.getMySubmissions>[number];

function toSong(submission: MySubmission): Song {
  return {
    ...submission,
    albumArtUrl: submission.albumArtUrl ?? "/icons/web-app-manifest-192x192.png",
    songFileUrl: submission.songFileUrl ?? null,
    songLink: submission.songLink ?? null,
  };
}

export function MySubmissionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { actions: playerActions } = useMusicPlayerStore();
  const mySubmissions = useQuery(api.submissions.getMySubmissions, {});
  const isLoading = mySubmissions === undefined;

  const filteredSubmissions = useMemo(() => {
    if (!mySubmissions) return [];
    if (!searchTerm) return mySubmissions;
    return mySubmissions.filter(
      (submission) =>
        submission &&
        (submission.songTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
          submission.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
          submission.roundTitle.toLowerCase().includes(searchTerm.toLowerCase())),
    );
  }, [mySubmissions, searchTerm]);

  const groupedSubmissions = useMemo(() => {
    return filteredSubmissions.reduce<Record<string, NonNullable<(typeof filteredSubmissions)[number]>[]>>(
      (acc, submission) => {
        if (!submission) return acc;
        const league = submission.leagueName;
        if (!acc[league]) {
          acc[league] = [];
        }
        acc[league].push(submission);
        return acc;
      },
      {},
    );
  }, [filteredSubmissions]);

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="p-4 md:p-8">
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

        {isLoading ? (
          <div className="rounded-lg border border-dashed py-20 text-center">
            <h2 className="text-xl font-semibold">Loading Submissions</h2>
            <p className="mt-2 text-muted-foreground">
              Fetching your submission history...
            </p>
          </div>
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
            {Object.entries(groupedSubmissions).map(([leagueName, submissions]) => {
              const firstSubmission = submissions[0];
              if (!firstSubmission) return null;
              return (
                <section key={leagueName}>
                  <h2 className="mb-4 text-xl font-bold">
                    <Link href={`/leagues/${firstSubmission.leagueId}`} className="hover:underline">
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
                              src={submission.albumArtUrl || "/icons/web-app-manifest-192x192.png"}
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
                            <p className="font-medium">{submission.roundTitle}</p>
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
                                onClick={() => playerActions.playSong(toSong(submission))}
                              >
                                <Play className="size-4" />
                              </Button>
                            ) : (
                              <a href={submission.songLink!} target="_blank" rel="noopener noreferrer">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                  {submission.submissionType === "youtube" && (
                                    <YouTubeIcon className="size-4 text-red-500" />
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
                          <div className="col-span-1 -mt-2 pl-[56px] text-sm text-muted-foreground md:hidden">
                            <p className="font-medium">{submission.roundTitle}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
