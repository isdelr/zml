// components/RoundDetail.tsx
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

  const currentUser = useQuery(api.users.getCurrentUser);

  const listenProgressData = useQuery(api.listenProgress.getForRound, {
    roundId: round._id,
  });

  const listenProgressMap = useMemo(() => {
    if (!listenProgressData) return {};
    const map: Record<string, Doc<"listenProgress">> = {};
    for (const progress of listenProgressData) {
      if(progress){
          map[progress.submissionId] = progress;
      }
    }
    return map;
  }, [listenProgressData]);


  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVoteSummaryVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "0px 0px 200px 0px",
      },
    );

    if (summaryTriggerRef.current) {
      observer.observe(summaryTriggerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const castVote = useMutation(api.votes.castVote).withOptimisticUpdate(
    (localStore, { submissionId, newVoteState }) => {
      const voteStatus = localStore.getQuery(api.votes.getForUserInRound, {
        roundId: round._id,
      });
      if (!voteStatus || !currentUser) return;

      const newVoteStatus = JSON.parse(JSON.stringify(voteStatus));

      const existingVoteIndex = newVoteStatus.votes.findIndex(
        (v: Doc<"votes">) => v.submissionId === submissionId,
      );
      if (existingVoteIndex > -1) {
        newVoteStatus.votes.splice(existingVoteIndex, 1);
      }

      if (newVoteState === "up") {
        newVoteStatus.votes.push({
          _id: `optimistic_up_${submissionId}`,
          _creationTime: Date.now(),
          roundId: round._id,
          submissionId: submissionId,
          userId: currentUser._id,
          vote: 1,
        });
      } else if (newVoteState === "down") {
        newVoteStatus.votes.push({
          _id: `optimistic_down_${submissionId}`,
          _creationTime: Date.now(),
          roundId: round._id,
          submissionId: submissionId,
          userId: currentUser._id,
          vote: -1,
        });
      }

      const upvotesUsed = newVoteStatus.votes.filter(
        (v: unknown) => v.vote > 0,
      ).length;
      const downvotesUsed = newVoteStatus.votes.filter(
        (v: unknown) => v.vote < 0,
      ).length;

      newVoteStatus.upvotesUsed = upvotesUsed;
      newVoteStatus.downvotesUsed = downvotesUsed;
      newVoteStatus.hasVoted =
        upvotesUsed === league.maxPositiveVotes &&
        downvotesUsed === league.maxNegativeVotes;

      localStore.setQuery(
        api.votes.getForUserInRound,
        { roundId: round._id },
        newVoteStatus,
      );
    },
  );

  const submissions = useQuery(api.submissions.getForRound, {
    roundId: round._id,
  });

  const userVoteStatus = useQuery(api.votes.getForUserInRound, {
    roundId: round._id,
  });

  const voters = useQuery(api.votes.getVotersForRound, { roundId: round._id });

  const upvotesUsed = userVoteStatus?.upvotesUsed ?? 0;
  const downvotesUsed = userVoteStatus?.downvotesUsed ?? 0;
  const positiveVotesRemaining = league.maxPositiveVotes - upvotesUsed;
  const negativeVotesRemaining = league.maxNegativeVotes - downvotesUsed;
  const isVoteFinal = userVoteStatus?.hasVoted ?? false;

  const handleVoteClick = (
    submissionId: Id<"submissions">,
    newVoteState: "up" | "down" | "none",
  ) => {
    if (isVoteFinal) {
      toast.info("Your votes for this round are final and cannot be changed.");
      return;
    }

    castVote({ submissionId, newVoteState })
      .then((result) => {
        if (result.isFinal) {
          toast.success(result.message);
        }
      })
      .catch((err) => {
        toast.error(err.data?.message || "Failed to save vote.");
      });
  };

  const totalDurationSeconds = useMemo(() => {
    if (!submissions) return 0;
    return submissions.reduce((total, sub) => total + (sub.duration || 0), 0);
  }, [submissions]);

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

  const sortedSubmissions = useMemo(() => {
    if (!submissions) return undefined;
    if (round.status === "finished") {
      return [...submissions].sort((a, b) => b.points - a.points);
    }
    return [...submissions].sort((a, b) => {
      const aIsFile = a.submissionType === "file";
      const bIsFile = b.submissionType === "file";
      if (aIsFile && !bIsFile) return -1;
      if (!aIsFile && bIsFile) return 1;
      return 0;
    });
  }, [submissions, round.status]);

  const votes = useQuery(api.votes.getForRound, { roundId: round._id });
  const mySubmission = submissions?.find((s) => s.userId === currentUser?._id);
  const submittedUsers = useMemo(() => {
    if (!submissions) return [];
    return submissions.map((sub) => ({
      name: sub.submittedBy,
      image: sub.submittedByImage,
    }));
  }, [submissions]);

  const handlePlaySong = (song: Song, index: number) => {
    const isThisSongCurrent =
      currentTrackIndex !== null && queue[currentTrackIndex]?._id === song._id;
    if (isThisSongCurrent) {
      playerActions.togglePlayPause();
    } else {
      playerActions.playRound(sortedSubmissions as Song[], index);
    }
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
            <AlertTitle className="font-bold">Voting Restricted</AlertTitle>
            <AlertDescription className="text-yellow-400/80">
              You cannot vote in this round because you joined the league after
              the voting phase started. You can vote in all future rounds.
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

      {round.status === "submissions" && (
        <div className="mt-8">
          <SubmissionForm
            roundId={round._id}
            currentUser={currentUser}
            submissions={submissions}
            mySubmission={mySubmission}
          />
          <div className="mt-8 rounded-lg border bg-card p-6 text-center">
            <h3 className="font-semibold">Who&apos;s Submitted So Far?</h3>
            {submissions && submissions.length > 0 ? (
              <div className="mt-4 flex flex-col items-center justify-center gap-2">
                <AvatarStack users={submittedUsers} />
                <p className="text-sm text-muted-foreground">
                  {submissions.length} submission
                  {submissions.length > 1 ? "s" : ""}
                </p>
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
    </section>
  );
}