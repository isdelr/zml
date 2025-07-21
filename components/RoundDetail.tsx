"use client";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  MessageSquare,
  Edit,
  Loader2,
  Pause,
  Play,
} from "lucide-react";
import Image from "next/image";
import { Button } from "./ui/button";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { SongSubmissionForm } from "./SongSubmissionForm";

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
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { AvatarStack } from "./AvatarStack";
import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toSvg } from "jdenticon";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { useConvexAuth } from "convex/react";
import { EditSubmissionForm } from "./EditSubmissionForm";

function SubmissionComments({
  submissionId,
  roundStatus,
}: {
  submissionId: Id<"submissions">;
  roundStatus: "voting" | "finished" | "submissions";
}) {
  const [commentText, setCommentText] = useState("");
  const { isAuthenticated } = useConvexAuth();

  const comments = useQuery(api.submissions.getCommentsForSubmission, {
    submissionId,
  });
  const addComment = useMutation(api.submissions.addComment);
  const currentUser = useQuery(api.users.getCurrentUser);

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    toast.promise(addComment({ submissionId, text: commentText }), {
      loading: "Posting comment...",
      success: () => {
        setCommentText("");
        return "Comment posted!";
      },
      error: (err) => err.data?.message || "Failed to post comment.",
    });
  };

  const isAnonymous = roundStatus === "voting";

  return (
    <div className="-mx-4 mt-2 rounded-md bg-muted/50 p-4 pt-4 space-y-4">
      {isAuthenticated && (
        <div className="flex items-start gap-3">
          <Avatar className="mt-1 size-8 flex-shrink-0">
            <AvatarImage src={currentUser?.image ?? undefined} />
            <AvatarFallback>
              <div
                dangerouslySetInnerHTML={{
                  __html: toSvg(currentUser?._id ?? "anon", 32),
                }}
              />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="Add your thoughts..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                size="sm"
              >
                Post
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-4">
        {comments === undefined && <Skeleton className="h-16 w-full" />}
        {comments && comments.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Be the first to comment.
          </p>
        )}
        {comments?.map((comment) => (
          <div key={comment._id} className="flex items-start gap-3">
            <Avatar className="size-8 flex-shrink-0">
              <AvatarImage
                src={isAnonymous ? undefined : comment.authorImage ?? undefined}
              />
              <AvatarFallback>
                <div
                  dangerouslySetInnerHTML={{
                    __html: toSvg(
                      isAnonymous ? comment._id : comment.userId,
                      32,
                    ),
                  }}
                />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">
                  {isAnonymous ? "Anonymous" : comment.authorName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(comment._creationTime, {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {comment.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const roundEditSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters."),
});

function EditRoundDialog({
  round,
  onClose,
}: {
  round: Record<string, unknown>;
  onClose: () => void;
}) {
  const updateRound = useMutation(api.rounds.updateRound);
  const form = useForm<z.infer<typeof roundEditSchema>>({
    resolver: zodResolver(roundEditSchema),
    defaultValues: {
      title: round.title,
      description: round.description,
    },
  });
  async function onSubmit(values: z.infer<typeof roundEditSchema>) {
    toast.promise(updateRound({ roundId: round._id, ...values }), {
      loading: "Updating round...",
      success: (msg) => {
        onClose();
        return msg;
      },
      error: (err) => err.data?.message || "Failed to update round.",
    });
  }
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Round Title</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Round Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          Save Changes
        </Button>
      </form>
    </Form>
  );
}
function AdminControls({
  round,
  submissions,
  votes,
}: {
  round: Doc<"rounds">;
  submissions: Record<string, unknown>[] | undefined;
  votes: Record<string, unknown>[] | undefined;
}) {
  const manageRoundState = useMutation(api.rounds.manageRoundState);
  const adjustRoundTime = useMutation(api.rounds.adjustRoundTime);
  const [isEditRoundOpen, setIsEditRoundOpen] = useState(false);
  const handleAction = async (
    mutation: typeof manageRoundState | typeof adjustRoundTime,
    args: Record<string, unknown>,
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
  const canEditRound =
    round.status === "submissions" &&
    (!submissions || submissions.length === 0);
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
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button>Start Voting Now</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Are you sure you want to start the voting phase?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will close submissions for the current round. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      handleAction(
                        manageRoundState,
                        { roundId: round._id, action: "startVoting" },
                        "Voting has been started!",
                      )
                    }
                  >
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Dialog open={isEditRoundOpen} onOpenChange={setIsEditRoundOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={!canEditRound}
                  title={
                    !canEditRound ? "Cannot edit a round with submissions." : ""
                  }
                >
                  <Edit className="mr-2 size-4" /> Edit Round
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Round: {round.title}</DialogTitle>
                </DialogHeader>
                <EditRoundDialog
                  round={round}
                  onClose={() => setIsEditRoundOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </>
        )}
        {round.status === "voting" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={!canEndVoting}
                title={
                  !canEndVoting
                    ? "Requires at least 1 submission and 1 vote."
                    : ""
                }
              >
                End Round Now
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Are you sure you want to end this round?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will finalize the voting, calculate the results, and
                  finish the round. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!canEndVoting}
                  onClick={() =>
                    handleAction(
                      manageRoundState,
                      { roundId: round._id, action: "endVoting" },
                      "Round has been finished!",
                    )
                  }
                >
                  End Round
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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

interface RoundDetailProps {
  round: Doc<"rounds"> & { art: string | null; submissionCount: number };
  league: { maxPositiveVotes: number; maxNegativeVotes: number };
  isOwner: boolean;
}

type PendingVotes = Record<string, { up: number; down: number }>;

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
  const submitVotes = useMutation(api.votes.submitVotes);
  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);

  const [visibleComments, setVisibleComments] = useState<
    Record<string, boolean>
  >({});

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const toggleComments = (submissionId: Id<"submissions">) => {
    setVisibleComments((prev) => ({
      ...prev,
      [submissionId]: !prev[submissionId],
    }));
  };
  const [pendingVotes, setPendingVotes] = useState<PendingVotes>({});

  useEffect(() => {
    if (userVoteStatus?.votes && submissions) {
      const initialVotes: PendingVotes = {};
      submissions.forEach((sub) => {
        initialVotes[sub._id] = { up: 0, down: 0 };
      });

      userVoteStatus.votes.forEach((vote) => {
        if (vote.vote > 0) {
          initialVotes[vote.submissionId].up += 1;
        } else if (vote.vote < 0) {
          initialVotes[vote.submissionId].down += 1;
        }
      });
      setPendingVotes(initialVotes);
    }
  }, [userVoteStatus, submissions]);

  const { pendingUpvotes, pendingDownvotes } = useMemo(() => {
    let up = 0;
    let down = 0;
    for (const subId in pendingVotes) {
      up += pendingVotes[subId].up;
      down += pendingVotes[subId].down;
    }
    return { pendingUpvotes: up, pendingDownvotes: down };
  }, [pendingVotes]);

  const positiveVotesRemaining = league.maxPositiveVotes - pendingUpvotes;
  const negativeVotesRemaining = league.maxNegativeVotes - pendingDownvotes;

  const canSubmit =
    positiveVotesRemaining === 0 && negativeVotesRemaining === 0;

  const mySubmission = submissions?.find((s) => s.userId === currentUser?._id);

  const handleVoteClick = (
    submissionId: Id<"submissions">,
    voteType: "up" | "down",
  ) => {
    setPendingVotes((prev) => {
      const newVotes = JSON.parse(JSON.stringify(prev));
      const currentSongVotes = newVotes[submissionId] || { up: 0, down: 0 };

      if (voteType === "up") {
        if (currentSongVotes.down > 0) {
          currentSongVotes.down -= 1;
        } else if (positiveVotesRemaining > 0) {
          currentSongVotes.up += 1;
        } else {
          toast.warning("No upvotes remaining.");
        }
      } else if (voteType === "down") {
        if (currentSongVotes.up > 0) {
          currentSongVotes.up -= 1;
        } else if (negativeVotesRemaining > 0) {
          currentSongVotes.down += 1;
        } else {
          toast.warning("No downvotes remaining.");
        }
      }
      newVotes[submissionId] = currentSongVotes;
      return newVotes;
    });
  };

  const handleSubmitVotes = () => {
    if (!canSubmit) {
      toast.error("You must use all your available votes before submitting.");
      return;
    }

    const votesToSubmit: {
      submissionId: Id<"submissions">;
      voteType: "up" | "down";
    }[] = [];
    for (const submissionId in pendingVotes) {
      const { up, down } = pendingVotes[submissionId];
      for (let i = 0; i < up; i++) {
        votesToSubmit.push({
          submissionId: submissionId as Id<"submissions">,
          voteType: "up",
        });
      }
      for (let i = 0; i < down; i++) {
        votesToSubmit.push({
          submissionId: submissionId as Id<"submissions">,
          voteType: "down",
        });
      }
    }

    toast.promise(submitVotes({ roundId: round._id, votes: votesToSubmit }), {
      loading: "Submitting votes...",
      success: "Votes submitted successfully!",
      error: (err) => err.data?.message || "Failed to submit votes.",
    });
  };

  const handleBookmark = (submissionId: Id<"submissions">) => {
    toast.promise(toggleBookmark({ submissionId }), {
      loading: "Updating bookmark...",
      success: (data) =>
        data.bookmarked ? "Song bookmarked!" : "Bookmark removed.",
      error: (err) => err.data?.message || "Failed to update bookmark.",
      position: "bottom-left",
    });
  };

  return (
    <section>
      {isOwner && (
        <AdminControls round={round} submissions={submissions} votes={votes} />
      )}
      <div className="mb-8 flex flex-col gap-8 md:flex-row">
        {round.art ? (
          <Image
            src={round.art}
            alt="Round Art"
            width={256}
            height={256}
            className="h-64 w-64 flex-shrink-0 rounded-md object-cover"
          />
        ) : (
          <div
            className="h-64 w-64 flex-shrink-0 rounded-md bg-muted"
            dangerouslySetInnerHTML={{ __html: toSvg(round._id, 256) }}
          />
        )}
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
            {round.status !== "submissions" &&
              submissions &&
              submissions.length > 0 && (
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
                  You must use all votes to submit.
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
        <div className="grid grid-cols-[auto_4fr_3fr_2fr_minmax(220px,auto)] items-center gap-4 px-4 py-2">
          <span className="w-10 text-center">#</span>
          <span>TRACK</span>
          <span>SUBMITTED BY</span>
          <span className="text-right">TOTAL POINTS</span>
          <span className="text-center">YOUR VOTES</span>
        </div>
      </div>
      {round.status === "submissions" && (
        <div className="mt-8">
          {currentUser === undefined || submissions === undefined ? (
            <Skeleton className="h-64 w-full" />
          ) : mySubmission ? (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Your Submission</h3>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {mySubmission.albumArtUrl && (
                        <Image
                          src={mySubmission.albumArtUrl}
                          alt={mySubmission.songTitle}
                          width={56}
                          height={56}
                          className="rounded"
                        />
                      )}
                      <div>
                        <p className="font-semibold">
                          {mySubmission.songTitle}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {mySubmission.artist}
                        </p>
                      </div>
                    </div>
                    <Dialog
                      open={isEditDialogOpen}
                      onOpenChange={setIsEditDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Edit className="mr-2 size-4" />
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Your Submission</DialogTitle>
                        </DialogHeader>
                        <EditSubmissionForm
                          submission={mySubmission}
                          onSubmitted={() => setIsEditDialogOpen(false)}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                  {mySubmission.comment && (
                    <blockquote className="mt-4 border-l-2 pl-3 text-sm italic text-muted-foreground">
                      {mySubmission.comment}
                    </blockquote>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <SongSubmissionForm roundId={round._id} />
          )}
          <div className="mt-8 rounded-lg border bg-card p-6 text-center">
            <h3 className="font-semibold">Who&apos;s Submitted So Far?</h3>
            {submissions && submissions.length > 0 ? (
              <div className="mt-4 flex justify-center">
                <AvatarStack
                  users={submissions.map((s) => ({
                    name: s.submittedBy,
                    image: s.submittedByImage,
                  }))}
                />
              </div>
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

              const { points, isBookmarked, comment } = song;
              const pendingSongVotes = pendingVotes[song._id] || {
                up: 0,
                down: 0,
              };

              const pointColor =
                points > 0
                  ? "text-green-400"
                  : points < 0
                    ? "text-red-400"
                    : "text-muted-foreground";
              const userIsSubmitter = song.userId === currentUser?._id;
              const isCommentsVisible = !!visibleComments[song._id];

              return (
                <div
                  key={song._id}
                  className="border-b border-border last:border-b-0"
                >
                  <div
                    className={cn(
                      "grid grid-cols-[auto_4fr_3fr_2fr_minmax(220px,auto)] items-center gap-4 px-4 py-2 transition-colors",
                      isThisSongCurrent ? "bg-accent" : "hover:bg-accent/50",
                      isCommentsVisible && "bg-accent/50",
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
                            playerActions.playRound(
                              submissions as Song[],
                              index,
                            );
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
                        {comment && (
                          <blockquote className="mt-2 border-l-2 pl-3 text-sm italic text-muted-foreground">
                            {comment}
                          </blockquote>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Avatar className="size-6">
                        <AvatarImage
                          src={
                            round.status === "voting"
                              ? undefined
                              : song.submittedByImage ?? undefined
                          }
                          alt={
                            round.status === "voting"
                              ? "Anonymous"
                              : song.submittedBy
                          }
                        />
                        <AvatarFallback
                          dangerouslySetInnerHTML={{
                            __html: toSvg(
                              round.status === "voting"
                                ? song._id
                                : song.submittedBy ?? song.userId,
                              24,
                            ),
                          }}
                        />
                      </Avatar>
                      {round.status === "voting"
                        ? "Anonymous"
                        : song.submittedBy}
                    </div>
                    <div className={cn("text-right font-bold", pointColor)}>
                      {round.status === "finished" ? points : "?"}
                    </div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Upvote"
                        onClick={() => handleVoteClick(song._id, "up")}
                        disabled={round.status !== "voting" || userIsSubmitter}
                        className="relative"
                      >
                        <ArrowUp
                          className={cn(
                            "size-5",
                            pendingSongVotes.up > 0 &&
                              "fill-green-400/20 text-green-400",
                          )}
                        />
                        {pendingSongVotes.up > 0 && (
                          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-green-500 text-xs text-white">
                            {pendingSongVotes.up}
                          </span>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Downvote"
                        onClick={() => handleVoteClick(song._id, "down")}
                        disabled={round.status !== "voting" || userIsSubmitter}
                        className="relative"
                      >
                        <ArrowDown
                          className={cn(
                            "size-5",
                            pendingSongVotes.down > 0 &&
                              "fill-red-400/20 text-red-400",
                          )}
                        />
                        {pendingSongVotes.down > 0 && (
                          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                            {pendingSongVotes.down}
                          </span>
                        )}
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
                            "size-5",
                            isBookmarked && "fill-primary text-primary",
                          )}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Comments"
                        onClick={() => toggleComments(song._id)}
                      >
                        <MessageSquare
                          className={cn(
                            "size-5",
                            isCommentsVisible && "fill-accent",
                          )}
                        />
                      </Button>
                    </div>
                  </div>
                  {isCommentsVisible && (
                    <div className="px-4 pb-4">
                      <SubmissionComments
                        submissionId={song._id}
                        roundStatus={round.status}
                      />
                    </div>
                  )}
                </div>
              );
            })}

          {round.status === "voting" &&
            submissions &&
            submissions.length > 0 &&
            !mySubmission && (
              <div className="mt-8 flex justify-end">
                <Button
                  onClick={handleSubmitVotes}
                  disabled={!canSubmit}
                  size="lg"
                >
                  {canSubmit ? "Submit Final Votes" : "Use All Votes to Submit"}
                </Button>
              </div>
            )}
        </>
      )}
    </section>
  );
}