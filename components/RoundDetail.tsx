"use client";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Music,
  Pause,
  Play,
  User,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "./ui/button";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { SongSubmissionForm } from "./SongSubmissionForm";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Skeleton } from "./ui/skeleton";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Song } from "@/types";

interface RoundDetailProps {
  round: Doc<"rounds"> & { art: string; submissionCount: number };
  league: { maxPositiveVotes: number; maxNegativeVotes: number };
  isOwner: boolean;
}

function AdminControls({
  round,
  submissions,
  votes,
}: {
  round: Doc<"rounds">;
  submissions: any[] | undefined;
  votes: any[] | undefined;
}) {
  const manageRoundState = useMutation(api.rounds.manageRoundState);
  const adjustRoundTime = useMutation(api.rounds.adjustRoundTime);
  const handleAction = async (
    mutation: any,
    args: any,
    successMsg: string,
  ) => {
    toast.promise(mutation(args), {
      loading: "Processing...",
      success: () => successMsg,
      error: (err) => err.data?.message || "An error occurred.",
    });
  };
  const canEndVoting =
    submissions && submissions.length > 0 && votes && votes.length > 0;
  return (
    <Card className="mb-8 border-primary/20 bg-secondary/30">
      <CardHeader>
        <CardTitle>Admin Controls</CardTitle>
        <CardDescription>
          Manage the current round state and timing. These controls are only
          visible to you.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        {round.status === "submissions" && (
          <Button
            onClick={() =>
              handleAction(
                manageRoundState,
                { roundId: round._id, action: "startVoting" },
                "Voting has been started!",
              )
            }
          >
            Start Voting Now
          </Button>
        )}
        {round.status === "voting" && (
          <Button
            onClick={() =>
              handleAction(
                manageRoundState,
                { roundId: round._id, action: "endVoting" },
                "Round has been finished!",
              )
            }
            disabled={!canEndVoting}
            title={
              !canEndVoting ? "Requires at least 1 submission and 1 vote." : ""
            }
          >
            End Round Now
          </Button>
        )}
        {(round.status === "submissions" || round.status === "voting") && (
          <>
            <Button
              variant="outline"
              onClick={() =>
                handleAction(
                  adjustRoundTime,
                  { roundId: round._id, days: 1 },
                  "Added 1 day to the current phase.",
                )
              }
            >
              +1 Day
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                handleAction(
                  adjustRoundTime,
                  { roundId: round._id, days: -1 },
                  "Removed 1 day from the current phase.",
                )
              }
            >
              -1 Day
            </Button>
          </>
        )}
        {round.status === "finished" && (
          <p className="text-sm text-muted-foreground">
            This round is finished. No further actions can be taken.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
export function RoundDetail({ round, league, isOwner }: RoundDetailProps) {
  const {
    actions: playerActions,
    currentTrackIndex,
    isPlaying,
    queue,
  } = useMusicPlayerStore();

  const submissions = useQuery(api.submissions.getForRound, {
    roundId: round._id,
  });
  const userVoteStatus = useQuery(api.votes.getForUserInRound, {
    roundId: round._id,
  });
  const votes = useQuery(api.votes.getForRound, { roundId: round._id });
  const currentUser = useQuery(api.users.getCurrentUser);
  const castVote = useMutation(api.votes.castVote);
  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);

  const positiveVotesRemaining =
    league.maxPositiveVotes - (userVoteStatus?.upvotesUsed ?? 0);
  const negativeVotesRemaining =
    league.maxNegativeVotes - (userVoteStatus?.downvotesUsed ?? 0);

  const userHasSubmitted = submissions?.some(
    (s) => s.userId === currentUser?._id,
  );

  const handleVote = (
    submissionId: Id<"submissions">,
    voteType: "up" | "down",
  ) => {
    toast.promise(castVote({ submissionId, voteType }), {
      loading: "Casting vote...",
      success: (msg) => msg,
      error: (err) => err.data?.message || "Failed to vote.",
    });
  };

  const handleBookmark = (submissionId: Id<"submissions">) => {
    toast.promise(toggleBookmark({ submissionId }), {
      loading: "Updating bookmark...",
      success: (data) =>
        data.bookmarked ? "Song bookmarked!" : "Bookmark removed.",
      error: (err) => err.data?.message || "Failed to update bookmark.",
    });
  };

  return (
    <section>
      {isOwner && (
        <AdminControls round={round} submissions={submissions} votes={votes} />
      )}
      <div className="mb-8 flex flex-col gap-8 md:flex-row">
        <Image
          src={round.art}
          alt="Round Art"
          width={256}
          height={256}
          className="h-64 w-64 flex-shrink-0 rounded-md object-cover"
        />
        <div className="flex flex-1 flex-col justify-between gap-6">
          <div className="flex flex-col justify-end gap-2">
            <div>
              <p className="text-sm font-bold uppercase">
                {round.status === "submissions"
                  ? "Submissions Open"
                  : "Viewing Round"}
              </p>
              <h1 className="text-5xl font-bold text-foreground">
                {round.title}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {round.status.charAt(0).toUpperCase() + round.status.slice(1)} •{" "}
                {round.status === "submissions"
                  ? `Submissions close in ${formatDistanceToNow(round.submissionDeadline)}`
                  : `Voting ends in ${formatDistanceToNow(round.votingDeadline)}`}
              </p>
            </div>
            {submissions && submissions.length > 0 && (
              <Button
                onClick={() =>
                  playerActions.playRound(submissions as Song[], 0)
                }
                size="lg"
                className="mt-4 w-fit bg-primary text-primary-foreground"
              >
                <Play className="mr-2 size-5" />
                Play All
              </Button>
            )}
          </div>
          {round.status === "voting" && (
            <div className="flex items-center justify-between rounded-lg border bg-card p-4">
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
                  <p className="text-xs text-muted-foreground">
                    Downvotes Left
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="border-b border-border text-xs font-semibold text-muted-foreground">
        <div className="grid grid-cols-[auto_4fr_3fr_2fr_minmax(180px,auto)] items-center gap-4 px-4 py-2">
          <span className="w-10 text-center">#</span>
          <span>TRACK</span>
          <span>SUBMITTED BY</span>
          <span className="text-right">POINTS</span>
          <span className="text-center">ACTIONS</span>
        </div>
      </div>
      {round.status === "submissions" && (
        <div className="mt-8">
          {currentUser === undefined || submissions === undefined ? (
            <Skeleton className="h-64 w-full" />
          ) : userHasSubmitted ? (
            <Alert>
              <Music className="size-4" />
              <AlertTitle>You're All Set!</AlertTitle>
              <AlertDescription>
                You've submitted your track for this round. Sit tight until the
                voting period begins!
              </AlertDescription>
            </Alert>
          ) : (
            <SongSubmissionForm roundId={round._id} />
          )}
          <div className="mt-8 rounded-lg border bg-card p-6 text-center">
            <h3 className="font-semibold">Who's Submitted So Far?</h3>
            {submissions && submissions.length > 0 ? (
              <ul className="mt-2 text-sm text-muted-foreground">
                {submissions.map((s) => (
                  <li key={s._id}>{s.submittedBy}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No one has submitted yet. Be the first!
              </p>
            )}
          </div>
        </div>
      )}
      {(round.status === "voting" || round.status === "finished") && (
        <>
          {submissions === undefined && <Skeleton className="h-64 w-full" />}
          {submissions && submissions.length === 0 && (
            <div className="py-20 text-center">
              <h2 className="text-xl font-semibold">No Submissions</h2>
              <p className="mt-2 text-muted-foreground">
                Looks like no one submitted a track for this round.
              </p>
            </div>
          )}
          {submissions &&
            submissions.map((song, index) => {
              const currentTrack =
                currentTrackIndex !== null ? queue[currentTrackIndex] : null;
              const isThisSongPlaying =
                isPlaying && currentTrack?._id === song._id;
              const isThisSongCurrent = currentTrack?._id === song._id;

              const { points, userVoteValue, isBookmarked } = song;
              const pointColor =
                points > 0
                  ? "text-green-400"
                  : points < 0
                    ? "text-red-400"
                    : "text-muted-foreground";
              const userIsSubmitter = song.userId === currentUser?._id;

              return (
                <div
                  key={song._id}
                  className={cn(
                    "grid grid-cols-[auto_4fr_3fr_2fr_minmax(180px,auto)] items-center gap-4 rounded-md px-4 py-2 hover:bg-accent",
                    isThisSongCurrent && "bg-accent text-primary-foreground",
                  )}
                >
                  <div className="flex w-10 items-center justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={!song.songFileUrl}
                      onClick={() => {
                        if (isThisSongCurrent) {
                          playerActions.togglePlayPause();
                        } else {
                          playerActions.playRound(submissions as Song[], index);
                        }
                      }}
                    >
                      {isThisSongPlaying ? (
                        <Pause className="size-4 text-foreground" />
                      ) : (
                        <Play className="size-4 text-foreground" />
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-4">
                    <Image
                      src={song.albumArtUrl}
                      alt={song.songTitle}
                      width={40}
                      height={40}
                      className="rounded"
                    />
                    <div>
                      <p
                        className={cn(
                          "font-semibold",
                          isThisSongCurrent && "text-primary",
                        )}
                      >
                        {song.songTitle}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {song.artist}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="size-4" />
                    {round.status === "voting" ? "Anonymous" : song.submittedBy}
                  </div>
                  <div className={cn("text-right font-bold", pointColor)}>
                    {round.status === "finished" ? points : "?"}
                  </div>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Upvote"
                      onClick={() => handleVote(song._id, "up")}
                      disabled={
                        round.status !== "voting" ||
                        userIsSubmitter ||
                        (positiveVotesRemaining <= 0 && userVoteValue !== 1)
                      }
                    >
                      <ArrowUp
                        className={cn(
                          "size-5",
                          userVoteValue === 1 &&
                            "fill-green-400/20 text-green-400",
                        )}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Downvote"
                      onClick={() => handleVote(song._id, "down")}
                      disabled={
                        round.status !== "voting" ||
                        userIsSubmitter ||
                        (negativeVotesRemaining <= 0 && userVoteValue !== -1)
                      }
                    >
                      <ArrowDown
                        className={cn(
                          "size-5",
                          userVoteValue === -1 &&
                            "fill-red-400/20 text-red-400",
                        )}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Bookmark"
                      className="ml-2"
                      onClick={() => handleBookmark(song._id)}
                    >
                      <Bookmark
                        className={cn(
                          "size-5 hover:text-foreground",
                          isBookmarked && "fill-yellow-400 text-yellow-400",
                        )}
                      />
                    </Button>
                  </div>
                </div>
              );
            })}
        </>
      )}
    </section>
  );
}