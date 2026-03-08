"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Song } from "@/types";
import type { LeagueData, RoundForLeague } from "@/lib/convex/types";
import { dynamicImport } from "@/components/ui/dynamic-import";
import { useMemo, useState, useCallback } from "react";
import { SubmissionCommentsPanel } from "./round/SubmissionCommentsPanel";
import { getSortedRoundSubmissions } from "@/lib/rounds/submission-order";
import { getRoundSubmitterSummary } from "@/lib/rounds/submitter-summary";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { useRoundYouTubePlaylist } from "@/hooks/useRoundYouTubePlaylist";
import { useRoundVoting } from "@/hooks/useRoundVoting";
import { RoundStatusAlerts } from "./round/RoundStatusAlerts";
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

  const [activeCommentsSubmissionId, setActiveCommentsSubmissionId] =
    useState<Id<"submissions"> | null>(null);

  const currentUser = useQuery(api.users.getCurrentUser);
  const listenersBySubmission = useQuery(api.presence.listForRound, {
    roundId: round._id,
  });
  const playlistListeners = useQuery(api.presence.listPlaylistForRound, {
    roundId: round._id,
  });
  const listenProgressData = useQuery(
    api.listenProgress.getForRound,
    league.enforceListenPercentage ? { roundId: round._id } : "skip",
  );
  const submissions = useQuery(api.submissions.getForRound, {
    roundId: round._id,
  });
  const voteSummary = useQuery(
    api.rounds.getVoteSummary,
    round.status === "finished" ? { roundId: round._id } : "skip",
  );
  const shouldLoadVoteStatus =
    !league.isSpectator &&
    (round.status === "voting" || round.status === "finished");
  const voters = useQuery(
    api.votes.getVotersForRound,
    round.status === "voting" ? { roundId: round._id } : "skip",
  );

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

  const canFinalizeVotes = useMemo(() => {
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

  const finalizationBlockedReason = useMemo(() => {
    if (!league.enforceListenPercentage || songsLeftToListen.length === 0) {
      return "Finish listening to every required song before submitting your final vote.";
    }
    return `Listen to the remaining ${songsLeftToListen.length} song${songsLeftToListen.length === 1 ? "" : "s"} before submitting your final vote.`;
  }, [league.enforceListenPercentage, songsLeftToListen.length]);

  const {
    userVoteStatus,
    confirmationState,
    confirmText,
    setConfirmText,
    closeConfirmation,
    handleConfirmFinalVote,
    handleVoteClick,
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
    canFinalizeVotes,
    finalizationBlockedReason,
  });

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

  const voteSummaryBySubmission = useMemo(() => {
    if (!voteSummary) return {};
    return Object.fromEntries(
      voteSummary.map((summary) => [summary.submissionId.toString(), summary]),
    );
  }, [voteSummary]);

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
  const youtubeSubmissionIds = useMemo(() => {
    if (!sortedSubmissions) return [] as Id<"submissions">[];
    return sortedSubmissions
      .filter(
        (submission) =>
          submission.submissionType === "youtube" &&
          Boolean(submission.songLink) &&
          Boolean(
            submission.songLink
              ? extractYouTubeVideoId(submission.songLink)
              : null,
          ),
      )
      .map((submission) => submission._id);
  }, [sortedSubmissions]);
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

  const { completedSubmitters, missingSubmitters } = useMemo(
    () =>
      getRoundSubmitterSummary(
        league.members ?? [],
        submissions,
        submissionsPerUser,
      ),
    [league.members, submissions, submissionsPerUser],
  );

  const votingSummary = useMemo(() => {
    const finalizedVoters =
      voters?.map((voter) => ({
        _id: voter._id.toString(),
        name: voter.name ?? null,
        image: voter.image ?? null,
      })) ?? [];

    const finalizedVoterIds = new Set(
      finalizedVoters.map((voter) => voter._id ?? ""),
    );

    const missingVoters =
      (league.members ?? [])
        .filter((member) => !finalizedVoterIds.has(member._id.toString()))
        .map((member) => ({
          _id: member._id.toString(),
          name: member.name ?? null,
          image: member.image ?? null,
        })) ?? [];

    return {
      finalizedVoters,
      missingVoters,
    };
  }, [league.members, voters]);

  const participationGroups = useMemo(() => {
    if (round.status === "submissions" && !league.isSpectator) {
      return [
        {
          label: "Submitted",
          users: completedSubmitters.map((member, index) => ({
            _id: `submitted-${index}-${member.name ?? "member"}`,
            name: member.name,
            image: member.image,
          })),
        },
        {
          label: "Not submitted",
          users: missingSubmitters.map((member, index) => ({
            _id: `missing-${index}-${member.name ?? "member"}`,
            name: member.name,
            image: member.image,
          })),
        },
      ];
    }

    if (round.status === "voting") {
      return [
        {
          label: "Voted",
          users: votingSummary.finalizedVoters,
        },
        {
          label: "Not voted",
          users: votingSummary.missingVoters,
        },
      ];
    }

    return undefined;
  }, [
    completedSubmitters,
    league.isSpectator,
    missingSubmitters,
    round.status,
    votingSummary.finalizedVoters,
    votingSummary.missingVoters,
  ]);

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
        <RoundAdminControls round={round} submissions={submissions} />
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
        totalDuration={formatDuration(totalDurationSeconds)}
        usesCustomLimits={usesCustomLimits}
        effectiveMaxUp={effectiveMaxUp}
        effectiveMaxDown={effectiveMaxDown}
        leagueMaxUp={league.maxPositiveVotes}
        leagueMaxDown={league.maxNegativeVotes}
        participationGroups={participationGroups}
      />

      {!league.isSpectator && (
        <div className="mt-8 mb-16">
          <SubmissionForm
            round={round}
            roundStatus={round.status}
            currentUser={currentUser}
            mySubmissions={mySubmissions}
            leagueName={league.name}
          />
        </div>
      )}

      {/* YouTube playlist info banner removed in favor of inline wrapper in the list */}

      {(round.status === "voting" || round.status === "finished") && (
        <>
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
            activeCommentsSubmissionId={activeCommentsSubmissionId}
            onToggleComments={setActiveCommentsSubmissionId}
            listenersBySubmission={listenersBySubmission}
            playlistListeners={playlistListeners}
            voteSummaryBySubmission={voteSummaryBySubmission}
            positiveVotesRemaining={positiveVotesRemaining}
            negativeVotesRemaining={negativeVotesRemaining}
            isVoteFinal={isVoteFinal}
            effectiveMaxUp={effectiveMaxUp}
            effectiveMaxDown={effectiveMaxDown}
            onReachYouTube={ensureAutoOpenOnce}
            ytInfo={ytInfo}
          />
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
