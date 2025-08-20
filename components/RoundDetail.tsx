"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Song } from "@/types";
import { dynamicImport } from "@/components/ui/dynamic-import";
import { useMemo, useState, useEffect, useRef } from "react";
import { AvatarStack } from "./AvatarStack";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { SubmissionCommentsPanel } from "./round/SubmissionCommentsPanel";
import { Ban, Headphones } from "lucide-react";
// New imports for the confirmation dialog
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const RoundAdminControls = dynamicImport(() =>
  import("./round/RoundAdminControls").then((mod) => ({
    default: mod.RoundAdminControls,
  })),
);
const RoundHeader = dynamicImport(() =>
  import("./round/RoundHeader").then((mod) => ({ default: mod.RoundHeader })),
);
const SubmissionForm = dynamicImport(() =>
  import("./round/SubmissionForm").then((mod) => ({
    default: mod.SubmissionForm,
  })),
);
const SubmissionsList = dynamicImport(() =>
  import("./round/SubmissionsList").then((mod) => ({
    default: mod.SubmissionsList,
  })),
);
const RoundVoteSummary = dynamicImport(() =>
  import("./round/RoundVoteSummary").then((mod) => ({
    default: mod.RoundVoteSummary,
  })),
);

interface RoundDetailProps {
  round: Doc<"rounds"> & { art: string | null; submissionCount: number };
  league: NonNullable<Awaited<ReturnType<typeof api.leagues.get>>>;
  isOwner: boolean;
}

export function RoundDetail({ round, league, isOwner }: RoundDetailProps) {
  const {
    actions: playerActions,
    currentTrackIndex,
    isPlaying,
    queue,
  } = useMusicPlayerStore();

  const [isVoteSummaryVisible, setIsVoteSummaryVisible] = useState(false);
  const summaryTriggerRef = useRef<HTMLDivElement | null>(null);
  const [activeCommentsSubmissionId, setActiveCommentsSubmissionId] =
    useState<Id<"submissions"> | null>(null);
  // State for the confirmation dialog
  const [confirmationState, setConfirmationState] = useState<{
    isOpen: boolean;
    submissionId: Id<"submissions"> | null;
    delta: 1 | -1 | null;
  }>({ isOpen: false, submissionId: null, delta: null });
  const [confirmText, setConfirmText] = useState("");

  const currentUser = useQuery(api.users.getCurrentUser);
  const listenersBySubmission = useQuery(api.presence.listForRound, {
    roundId: round._id,
  });
  const listenProgressData = useQuery(api.listenProgress.getForRound, {
    roundId: round._id,
  });
  const promotePresubs = useMutation(
    api.submissions.promotePresubmissionsForRound,
  );
  const promotedRef = useRef<string | null>(null);
  const submissions = useQuery(api.submissions.getForRound, {
    roundId: round._id,
  });
  const castVote = useMutation(api.votes.castVote).withOptimisticUpdate(
    (
      localStore,
      {
        submissionId,
        delta,
      }: { submissionId: Id<"submissions">; delta: 1 | -1 },
    ) => {
      const voteStatus = localStore.getQuery(api.votes.getForUserInRound, {
        roundId: round._id,
      });
      if (!voteStatus || !currentUser) return;

      const newVoteStatus = JSON.parse(
        JSON.stringify(voteStatus),
      ) as NonNullable<typeof voteStatus>;

      const idx = newVoteStatus.votes.findIndex(
        (v: Doc<"votes">) => v.submissionId === submissionId,
      );
      if (idx > -1) {
        const currentVal = newVoteStatus.votes[idx].vote;
        const nextVal = currentVal + delta;
        if (nextVal === 0) {
          newVoteStatus.votes.splice(idx, 1);
        } else {
          newVoteStatus.votes[idx].vote = nextVal;
        }
      } else {
        if (delta !== 0) {
          newVoteStatus.votes.push({
            _id: `optimistic_${submissionId}_${Date.now()}` as unknown as Id<"votes">,
            _creationTime: Date.now(),
            roundId: round._id,
            submissionId,
            userId: currentUser._id,
            vote: delta,
          });
        }
      }

      newVoteStatus.upvotesUsed = newVoteStatus.votes.reduce(
        (sum: number, v: Doc<"votes">) => sum + Math.max(0, v.vote),
        0,
      );
      newVoteStatus.downvotesUsed = newVoteStatus.votes.reduce(
        (sum: number, v: Doc<"votes">) => sum + Math.abs(Math.min(0, v.vote)),
        0,
      );

      newVoteStatus.hasVoted =
        newVoteStatus.upvotesUsed === league.maxPositiveVotes &&
        newVoteStatus.downvotesUsed === league.maxNegativeVotes;

      localStore.setQuery(
        api.votes.getForUserInRound,
        { roundId: round._id },
        newVoteStatus,
      );
    },
  );
  const userVoteStatus = useQuery(api.votes.getForUserInRound, {
    roundId: round._id,
  });
  const voters = useQuery(api.votes.getVotersForRound, { roundId: round._id });
  const votes = useQuery(api.votes.getForRound, { roundId: round._id });

  useEffect(() => {
    if (round.status === "submissions" && promotedRef.current !== round._id) {
      promotedRef.current = round._id as string;
      promotePresubs({ roundId: round._id }).catch((e) => {
        console.error("Failed to promote presubmissions:", e);
      });
    }
  }, [round._id, round.status, promotePresubs]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVoteSummaryVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px 200px 0px" },
    );

    if (summaryTriggerRef.current) {
      observer.observe(summaryTriggerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const listenProgressMap = useMemo(() => {
    if (!listenProgressData) return {};
    const map: Record<string, Doc<"listenProgress">> = {};
    for (const progress of listenProgressData) {
      if (progress) {
        map[progress.submissionId] = progress;
      }
    }
    return map;
  }, [listenProgressData]);

  const songsLeftToListen = useMemo(() => {
    if (!league.enforceListenPercentage || !submissions || !currentUser)
      return [];
    const requiredSubs = submissions.filter(
      (s) => s.submissionType === "file" && s.userId !== currentUser._id,
    );
    if (requiredSubs.length === 0) return [];
    return requiredSubs.filter(
      (sub) => listenProgressMap[sub._id]?.isCompleted !== true,
    );
  }, [
    league.enforceListenPercentage,
    submissions,
    currentUser,
    listenProgressMap,
  ]);

  const isReadyToVoteOverall = useMemo(() => {
    if (!league.enforceListenPercentage || !submissions || !currentUser)
      return true;
    const requiredSubs = submissions.filter(
      (s) => s.submissionType === "file" && s.userId !== currentUser._id,
    );
    if (requiredSubs.length === 0) return true;
    return requiredSubs.every(
      (sub) => listenProgressMap[sub._id]?.isCompleted === true,
    );
  }, [
    league.enforceListenPercentage,
    submissions,
    currentUser,
    listenProgressMap,
  ]);

  const sortedSubmissions = useMemo(() => {
    if (!submissions) return undefined;

    if (round.status === "finished") {
      return [...submissions].sort((a, b) => b.points - a.points);
    }

    const createSeed = (str: string) => {
      let seed = 0;
      for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        seed = (seed << 5) - seed + charCode;
        seed |= 0;
      }
      return seed;
    };

    const seededRandom = (seed: number) => {
      return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };

    const seed = createSeed(round._id);
    const random = seededRandom(seed);

    const shuffleArray = <T,>(array: T[]): T[] => {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    };

    const fileSubmissions = submissions.filter(
      (s) => s.submissionType === "file",
    );
    const linkSubmissions = submissions.filter(
      (s) => s.submissionType === "spotify" || s.submissionType === "youtube",
    );

    const sortById = (
      a: { _id: Id<"submissions"> },
      b: { _id: Id<"submissions"> },
    ) => a._id.localeCompare(b._id);
    fileSubmissions.sort(sortById);
    linkSubmissions.sort(sortById);

    const shuffledFiles = shuffleArray(fileSubmissions);
    const shuffledLinks = shuffleArray(linkSubmissions);

    return [...shuffledFiles, ...shuffledLinks];
  }, [submissions, round.status, round._id]);

  const activeSubmissionForPanel = useMemo(() => {
    if (!activeCommentsSubmissionId || !sortedSubmissions) {
      return null;
    }
    return (
      sortedSubmissions.find((s) => s._id === activeCommentsSubmissionId) ??
      null
    );
  }, [activeCommentsSubmissionId, sortedSubmissions]);

  const handleConfirmFinalVote = () => {
    if (confirmationState.submissionId && confirmationState.delta) {
      castVote({
        submissionId: confirmationState.submissionId,
        delta: confirmationState.delta,
      })
        .then((result) => {
          if (result.isFinal) {
            toast.success(result.message);
          }
        })
        .catch((err) => {
          toast.error((err as Error).message || "Failed to save vote.");
        });
    }
    setConfirmationState({ isOpen: false, submissionId: null, delta: null });
    setConfirmText("");
  };

  const handleVoteClick = (submissionId: Id<"submissions">, delta: 1 | -1) => {
    if (userVoteStatus?.hasVoted) {
      toast.info("Your votes for this round are final and cannot be changed.");
      return;
    }

    const upvotesUsed = userVoteStatus?.upvotesUsed ?? 0;
    const downvotesUsed = userVoteStatus?.downvotesUsed ?? 0;

    // Current vote on this submission (0 if none)
    const currentVote =
      userVoteStatus?.votes.find((v) => v.submissionId === submissionId)
        ?.vote ?? 0;

    // Apply the click, clamp to league rules, and derive the actual delta to send
    let nextVote = currentVote + delta;
    if (league.limitVotesPerSubmission) {
      if (nextVote > (league.maxPositiveVotesPerSubmission ?? Infinity)) {
        nextVote = league.maxPositiveVotesPerSubmission ?? nextVote;
      }
      if (nextVote < -(league.maxNegativeVotesPerSubmission ?? Infinity)) {
        nextVote = -(league.maxNegativeVotesPerSubmission ?? nextVote);
      }
    }
    const deltaToSend = (nextVote - currentVote) as -1 | 0 | 1;

    if (deltaToSend === 0) return;

    // Predict post-click usage
    const nextUpvotesUsed =
      upvotesUsed - Math.max(0, currentVote) + Math.max(0, nextVote);
    const nextDownvotesUsed =
      downvotesUsed -
      Math.abs(Math.min(0, currentVote)) +
      Math.abs(Math.min(0, nextVote));

    // Only prompt if this click would actually make votes final
    const willBeFinal =
      nextUpvotesUsed === league.maxPositiveVotes &&
      nextDownvotesUsed === league.maxNegativeVotes;

    if (willBeFinal) {
      setConfirmationState({
        isOpen: true,
        submissionId,
        delta: deltaToSend as 1 | -1,
      });
      return;
    }

    castVote({ submissionId, delta: deltaToSend as 1 | -1 })
      .then((result) => {
        if (result.isFinal) {
          toast.success(result.message);
        }
      })
      .catch((err) => {
        toast.error((err as Error).message || "Failed to save vote.");
      });
  };

  const handlePlaySong = (song: Song, index: number) => {
    const isThisSongCurrent =
      currentTrackIndex !== null && queue[currentTrackIndex]?._id === song._id;
    if (isThisSongCurrent) {
      playerActions.togglePlayPause();
    } else {
      playerActions.playRound(sortedSubmissions as Song[], index);
    }
  };

  const handlePlaySongFromPanel = (song: Song) => {
    const indexInQueue =
      sortedSubmissions?.findIndex((s) => s._id === song._id) ?? -1;
    if (indexInQueue !== -1) {
      handlePlaySong(song, indexInQueue);
    } else {
      playerActions.playSong(song);
    }
  };

  const upvotesUsed = userVoteStatus?.upvotesUsed ?? 0;
  const downvotesUsed = userVoteStatus?.downvotesUsed ?? 0;
  const positiveVotesRemaining = league.maxPositiveVotes - upvotesUsed;
  const negativeVotesRemaining = league.maxNegativeVotes - downvotesUsed;
  const isVoteFinal = userVoteStatus?.hasVoted ?? false;
  const totalDurationSeconds = useMemo(
    () =>
      submissions?.reduce((total, sub) => total + (sub.duration || 0), 0) ?? 0,
    [submissions],
  );
  const mySubmissions = useMemo(
    () => submissions?.filter((s) => s.userId === currentUser?._id),
    [submissions, currentUser],
  );
  const submittedUsers = useMemo(
    () =>
      submissions?.map((sub) => ({
        name: sub.submittedBy,
        image: sub.submittedByImage,
      })) ?? [],
    [submissions],
  );

  const formatDuration = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds <= 0) return null;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const parts = [];
    if (hours > 0) parts.push(`${hours} hr`);
    if (minutes > 0) parts.push(`${minutes} min`);
    if (parts.length === 0) {
      const seconds = Math.round(totalSeconds % 60);
      parts.push(`${seconds} sec`);
    }
    return parts.join(" ");
  };

  return (
    <section>
      {isOwner && (
        <RoundAdminControls
          round={round}
          submissions={submissions}
          votes={votes}
        />
      )}

      {round.status === "voting" &&
        userVoteStatus &&
        !userVoteStatus.hasVoted &&
        !userVoteStatus.canVote && (
          <Alert className="mb-8 border-yellow-500/50 bg-yellow-500/10 text-yellow-400">
            <Ban className="size-4" />
            <AlertTitle className="font-bold">Voting Restricted</AlertTitle>
            <AlertDescription className="text-yellow-400/80">
              You must submit a song to a round to be eligible to vote.
            </AlertDescription>
          </Alert>
        )}

      <RoundHeader
        round={round}
        submissions={sortedSubmissions}
        onPlayAll={(songs, startIndex) =>
          playerActions.playRound(songs, startIndex)
        }
        positiveVotesRemaining={positiveVotesRemaining}
        negativeVotesRemaining={negativeVotesRemaining}
        hasVoted={isVoteFinal}
        upvotesUsed={upvotesUsed}
        downvotesUsed={downvotesUsed}
        totalDuration={formatDuration(totalDurationSeconds)}
      />

      {round.status === "voting" &&
        league.enforceListenPercentage &&
        songsLeftToListen.length > 0 && (
          <Alert className="mb-8 border-blue-500/50 bg-blue-500/10 text-blue-400">
            <AlertTitle className="font-bold text-xl mb-2">
              Listening Requirement
            </AlertTitle>
            <AlertDescription className="text-blue-800/80 dark:text-blue-400/80">
              <div className="flex gap-2 items-center">
                <span>
                  You have:{" "}
                  <span className="font-bold">{songsLeftToListen.length} </span>
                  <span className="font-bold">
                    {songsLeftToListen.length > 1 ? "songs" : "song"}
                  </span>{" "}
                  left to listen to, before you can vote. Unlistened file
                  submissions are marked with a
                </span>
                <Headphones className="inline-block size-4" />
              </div>
            </AlertDescription>
          </Alert>
        )}

      <div className="mt-8">
        <SubmissionForm
          round={round as Doc<"rounds">}
          roundStatus={round.status}
          currentUser={currentUser}
          mySubmissions={mySubmissions}
        />
        {round.status === "submissions" && (
          <div className="mt-8 rounded-lg border bg-card p-6 text-center">
            <h3 className="font-semibold">Who&apos;s Submitted So Far?</h3>
            {submittedUsers.length > 0 ? (
              <div className="mt-4 flex flex-col items-center justify-center gap-2">
                <AvatarStack users={submittedUsers} />
                <p className="text-sm text-muted-foreground">
                  {submittedUsers.length} submission
                  {submittedUsers.length > 1 ? "s" : ""}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No one has submitted yet. Be the first!
              </p>
            )}
          </div>
        )}
      </div>

      {(round.status === "voting" || round.status === "finished") && (
        <>
          {round.status === "voting" && voters && voters.length > 0 && (
            <div className="my-8 rounded-lg border bg-card p-6 text-center">
              <h3 className="font-semibold">Who&apos;s Voted So Far?</h3>
              <div className="mt-4 flex flex-col items-center justify-center gap-2">
                <AvatarStack users={voters} />
                <p className="text-sm text-muted-foreground">
                  {voters.length} member{voters.length !== 1 ? "s" : ""} have
                  cast their votes.
                </p>
              </div>
            </div>
          )}
          <SubmissionsList
            submissions={sortedSubmissions}
            userVoteStatus={userVoteStatus}
            userVotes={userVoteStatus?.votes ?? []}
            currentUser={currentUser}
            roundStatus={round.status}
            league={league}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            queue={queue}
            onPlaySong={handlePlaySong}
            onVoteClick={handleVoteClick}
            listenProgressMap={listenProgressMap}
            isReadyToVoteOverall={isReadyToVoteOverall}
            activeCommentsSubmissionId={activeCommentsSubmissionId}
            onToggleComments={setActiveCommentsSubmissionId}
            listenersBySubmission={listenersBySubmission}
          />
          {round.status === "finished" && (
            <div ref={summaryTriggerRef}>
              {isVoteSummaryVisible ? (
                <RoundVoteSummary roundId={round._id} />
              ) : (
                <div className="my-8 min-h-[24rem]" />
              )}
            </div>
          )}
        </>
      )}

      <SubmissionCommentsPanel
        submission={activeSubmissionForPanel}
        roundStatus={round.status}
        onOpenChange={(isOpen) =>
          !isOpen && setActiveCommentsSubmissionId(null)
        }
        onPlaySong={handlePlaySongFromPanel}
      />

      <AlertDialog
        open={confirmationState.isOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setConfirmationState({
              isOpen: false,
              submissionId: null,
              delta: null,
            });
            setConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Final Vote Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              This is your last vote for this round. Once you cast this vote,
              all your votes will be locked and cannot be changed. Are you sure
              you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label htmlFor="confirm-input" className="text-sm font-medium">
              To confirm, please type &quot;confirm&quot; below.
            </Label>
            <Input
              id="confirm-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setConfirmationState({
                  isOpen: false,
                  submissionId: null,
                  delta: null,
                });
                setConfirmText("");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmFinalVote}
              disabled={confirmText.toLowerCase() !== "confirm"}
            >
              Confirm Final Vote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}