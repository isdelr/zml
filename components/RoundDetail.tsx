"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Song } from "@/types";
import type { LeagueData, RoundForLeague } from "@/lib/convex/types";
import { dynamicImport } from "@/components/ui/dynamic-import";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { SubmissionCommentsPanel } from "./round/SubmissionCommentsPanel";
import { getSortedRoundSubmissions } from "@/lib/rounds/submission-order";
import { getRoundSubmitterSummary } from "@/lib/rounds/submitter-summary";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { useRoundYouTubePlaylist } from "@/hooks/useRoundYouTubePlaylist";
import { useRoundVoting } from "@/hooks/useRoundVoting";
import { RoundStatusAlerts } from "./round/RoundStatusAlerts";
import { RoundSubmissionProgressCard } from "./round/RoundSubmissionProgressCard";
import { RoundVotingProgressCard } from "./round/RoundVotingProgressCard";
import { FinalVoteConfirmationDialog } from "./round/FinalVoteConfirmationDialog";

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
  round: RoundForLeague;
  league: LeagueData;
  canManageLeague: boolean;
}

type RoundYouTubeEntry = {
  submissionId: Id<"submissions">;
  videoId: string;
  duration: number;
};

function getRoundYouTubeEntries(
  submissions:
    | {
        _id: Id<"submissions">;
        submissionType: string;
        songLink?: string | null;
        duration?: number | null;
      }[]
    | undefined,
): RoundYouTubeEntry[] {
  if (!submissions) return [];
  const seen = new Set<string>();
  const list: RoundYouTubeEntry[] = [];
  for (const submission of submissions) {
    if (submission.submissionType !== "youtube" || !submission.songLink)
      continue;
    const videoId = extractYouTubeVideoId(submission.songLink);
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);
    const duration =
      Number.isFinite(submission.duration) && (submission.duration ?? 0) > 0
        ? Math.floor(submission.duration as number)
        : 180;
    list.push({ submissionId: submission._id, videoId, duration });
  }
  return list;
}

export function RoundDetail({
  round,
  league,
  canManageLeague,
}: RoundDetailProps) {
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

  const currentUser = useQuery(api.users.getCurrentUser);
  const listenersBySubmission = useQuery(
    api.presence.listForRound,
    isPlaying ? { roundId: round._id } : "skip",
  );
  const listenProgressData = useQuery(
    api.listenProgress.getForRound,
    league.enforceListenPercentage ? { roundId: round._id } : "skip",
  );
  const submissions = useQuery(api.submissions.getForRound, {
    roundId: round._id,
  });
  const shouldLoadVoteStatus =
    !league.isSpectator &&
    (round.status === "voting" || round.status === "finished");
  const {
    userVoteStatus,
    confirmationState,
    confirmText,
    setConfirmText,
    closeConfirmation,
    handleConfirmFinalVote,
    handleVoteClick,
    upvotesUsed,
    downvotesUsed,
    effectiveMaxUp,
    effectiveMaxDown,
    positiveVotesRemaining,
    negativeVotesRemaining,
    isVoteFinal,
    usesCustomLimits,
  } = useRoundVoting({
    round,
    league,
    currentUserId: currentUser?._id,
    enabled: shouldLoadVoteStatus,
  });
  const voters = useQuery(
    api.votes.getVotersForRound,
    round.status === "voting" ? { roundId: round._id } : "skip",
  );
  const votes = useQuery(
    api.votes.getForRound,
    canManageLeague ? { roundId: round._id } : "skip",
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
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
      (s) =>
        ["file", "youtube"].includes(s.submissionType) &&
        s.userId !== currentUser._id &&
        !s.isTrollSubmission,
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
      (s) =>
        ["file", "youtube"].includes(s.submissionType) &&
        s.userId !== currentUser._id &&
        !s.isTrollSubmission,
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

  const roundWithArt = useMemo(
    () => ({
      ...round,
      art: round.art ?? null,
    }),
    [round],
  );

  const sortedSubmissions = useMemo(() => {
    if (!submissions) return undefined;
    return getSortedRoundSubmissions(submissions, round.status, round._id);
  }, [submissions, round.status, round._id]);

  const toSong = useCallback(
    (submission: NonNullable<typeof sortedSubmissions>[number]): Song => ({
      ...submission,
      albumArtUrl:
        submission.albumArtUrl ?? "/icons/web-app-manifest-192x192.png",
      songFileUrl: submission.songFileUrl ?? null,
      songLink: submission.songLink ?? null,
    }),
    [],
  );

  const activeSubmissionForPanel = useMemo(() => {
    if (!activeCommentsSubmissionId || !sortedSubmissions) {
      return null;
    }
    const found =
      sortedSubmissions.find((s) => s._id === activeCommentsSubmissionId) ??
      null;
    return found ? toSong(found) : null;
  }, [activeCommentsSubmissionId, sortedSubmissions, toSong]);

  const handlePlaySong = (song: Song, index: number) => {
    // For YouTube submissions, open playlist with that song first
    if (song.submissionType === "youtube") {
      if (youtubeVideoIds.length > 0) {
        const idx = youtubeData.findIndex((d) => d.submissionId === song._id);
        const ordered =
          idx >= 0
            ? [...youtubeVideoIds.slice(idx), ...youtubeVideoIds.slice(0, idx)]
            : youtubeVideoIds;
        openPlaylistAndStart(ordered);
      }
      return;
    }

    // Default internal player flow for file submissions
    const isThisSongCurrent =
      currentTrackIndex !== null && queue[currentTrackIndex]?._id === song._id;
    if (isThisSongCurrent) {
      playerActions.togglePlayPause();
    } else {
      const queueSongs = sortedSubmissions?.map(toSong) ?? [];
      playerActions.playRound(queueSongs, index);
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

  const totalDurationSeconds = useMemo(
    () =>
      submissions?.reduce((total, sub) => total + (sub.duration || 0), 0) ?? 0,
    [submissions],
  );
  const mySubmissions = useMemo(
    () => submissions?.filter((s) => s.userId === currentUser?._id),
    [submissions, currentUser],
  );

  const youtubeData = getRoundYouTubeEntries(sortedSubmissions);
  const youtubeVideoIds = youtubeData.map((entry) => entry.videoId);
  const youtubeSubmissionIds = youtubeData.map((entry) => entry.submissionId);
  const totalYouTubeDurationSec = youtubeData.reduce(
    (sum, entry) => sum + entry.duration,
    0,
  );

  const { ytInfo, ensureAutoOpenOnce, openPlaylistAndStart } =
    useRoundYouTubePlaylist({
      roundId: round._id,
      roundStatus: round.status,
      youtubeSubmissionIds,
      youtubeVideoIds,
      totalYouTubeDurationSec,
      onMarkCompletedLocal: (submissionId) => {
        playerActions.setListenProgress(submissionId.toString(), true);
      },
    });

  const submissionsPerUser = round.submissionsPerUser ?? 1;

  const { completedSubmitters, missingSubmitters, totalMembers } = useMemo(
    () =>
      getRoundSubmitterSummary(
        league.members ?? [],
        submissions,
        submissionsPerUser,
      ),
    [league.members, submissions, submissionsPerUser],
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
      {canManageLeague && (
        <RoundAdminControls
          round={round}
          submissions={submissions}
          votes={votes}
        />
      )}

      <RoundStatusAlerts
        isSpectator={Boolean(league.isSpectator)}
        roundStatus={round.status}
        userVoteStatus={userVoteStatus}
        enforceListenPercentage={Boolean(league.enforceListenPercentage)}
        songsLeftToListenCount={songsLeftToListen.length}
      />

      <RoundHeader
        round={roundWithArt}
        submissions={sortedSubmissions?.map(toSong)}
        onPlayAll={(songs, startIndex) =>
          playerActions.playRound(songs, startIndex)
        }
        positiveVotesRemaining={positiveVotesRemaining}
        negativeVotesRemaining={negativeVotesRemaining}
        hasVoted={isVoteFinal}
        upvotesUsed={upvotesUsed}
        downvotesUsed={downvotesUsed}
        totalDuration={formatDuration(totalDurationSeconds)}
        usesCustomLimits={usesCustomLimits}
        effectiveMaxUp={effectiveMaxUp}
        effectiveMaxDown={effectiveMaxDown}
        leagueMaxUp={league.maxPositiveVotes}
        leagueMaxDown={league.maxNegativeVotes}
      />

      {!league.isSpectator && (
        <div className="mt-8">
          <SubmissionForm
            round={round}
            roundStatus={round.status}
            currentUser={currentUser}
            mySubmissions={mySubmissions}
            leagueName={league.name}
          />
          {round.status === "submissions" ? (
            <RoundSubmissionProgressCard
              completedSubmitters={completedSubmitters}
              missingSubmitters={missingSubmitters}
              totalMembers={totalMembers}
            />
          ) : null}
        </div>
      )}

      {/* YouTube playlist info banner removed in favor of inline wrapper in the list */}

      {(round.status === "voting" || round.status === "finished") && (
        <>
          {round.status === "voting" && voters ? (
            <RoundVotingProgressCard voters={voters} />
          ) : null}
          <SubmissionsList
            submissions={sortedSubmissions}
            userVoteStatus={
              league.isSpectator
                ? {
                    hasVoted: true,
                    canVote: false,
                    votes: [],
                    upvotesUsed: 0,
                    downvotesUsed: 0,
                  }
                : userVoteStatus
            }
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
            onReachYouTube={ensureAutoOpenOnce}
            ytInfo={ytInfo}
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

      <FinalVoteConfirmationDialog
        open={confirmationState.isOpen}
        confirmText={confirmText}
        onConfirmTextChange={setConfirmText}
        onCancel={closeConfirmation}
        onConfirm={handleConfirmFinalVote}
      />
    </section>
  );
}
