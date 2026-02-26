"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { dynamicImport } from "@/components/ui/dynamic-import";
import { extractTimestampedWaveformComments } from "@/lib/music/comments";
import {
  clampSeekTargetToAllowedProgress,
  hasCompletedListenRequirement,
  shouldMarkListenCompleted,
} from "@/lib/music/listen-enforcement";
import {
  getQueueYouTubeVideoIds,
  markRoundYouTubePlaylistOpened,
} from "@/lib/music/youtube-queue";
import { buildYouTubeWatchVideosUrl, extractYouTubeVideoId } from "@/lib/youtube";
import { useListeningPresence } from "@/hooks/useListeningPresence";
import { useSubmissionWaveform } from "@/hooks/useSubmissionWaveform";
import { useAudioPlaybackSync } from "@/hooks/useAudioPlaybackSync";
import { useListenProgressSync } from "@/hooks/useListenProgressSync";
import { usePlayerBookmark } from "@/hooks/usePlayerBookmark";

const PlayerTrackInfo = dynamicImport(() =>
  import("@/components/player/PlayerTrackInfo").then((mod) => ({
    default: mod.PlayerTrackInfo,
  })),
);
const PlayerControls = dynamicImport(() =>
  import("@/components/player/PlayerControls").then((mod) => ({
    default: mod.PlayerControls,
  })),
);
const PlayerProgress = dynamicImport(() =>
  import("@/components/player/PlayerProgress").then((mod) => ({
    default: mod.PlayerProgress,
  })),
);
const PlayerActions = dynamicImport(() =>
  import("@/components/player/PlayerActions").then((mod) => ({
    default: mod.PlayerActions,
  })),
);
const MusicQueue = dynamicImport(() =>
  import("@/components/MusicQueue").then((mod) => ({
    default: mod.MusicQueue,
  })),
);

export function MusicPlayer() {
  const {
    queue,
    currentTrackIndex,
    isPlaying,
    repeatMode,
    isShuffled,
    seekTo,
    volume,
    listenProgress,
    actions,
  } = useMusicPlayerStore();
  const currentTrack =
    currentTrackIndex !== null ? queue[currentTrackIndex] ?? null : null;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [lastVolume, setLastVolume] = useState(volume);
  const [refreshedUrls, setRefreshedUrls] = useState<Record<string, string>>({});

  const leagueData = useQuery(
    api.leagues.get,
    currentTrack ? { leagueId: currentTrack.leagueId } : "skip",
  );

  // Fetch listen progress for the current round
  const roundListenProgress = useQuery(
    api.listenProgress.getForRound,
    currentTrack ? { roundId: currentTrack.roundId } : "skip"
  );

  const currentTrackListenProgress = useMemo(() => {
    if (!currentTrack || !roundListenProgress) {
      return undefined;
    }
    return roundListenProgress.find(p => p && p.submissionId === currentTrack._id);
  }, [currentTrack, roundListenProgress]);

  // Track how far the user has actually listened contiguously (client-side)
  const listenedUntilRef = useRef(0);
  // Flag to avoid counting a seek as listened time in the next timeupdate tick
  const manualSeekRef = useRef(false);

  // Initialize/reset contiguous listened time when track changes or server progress is loaded
  useEffect(() => {
    if (!currentTrack) {
      listenedUntilRef.current = 0;
      manualSeekRef.current = false;
      return;
    }
    const base = currentTrackListenProgress?.progressSeconds ?? 0;
    listenedUntilRef.current = base;
    manualSeekRef.current = false;
  }, [currentTrack, currentTrackListenProgress]);

  const getPresignedSongUrl = useAction(api.submissions.getPresignedSongUrl);

  const isExternalLink =
    currentTrack?.submissionType === "youtube";
  const effectiveSongUrl =
    currentTrack && currentTrack.submissionType === "file"
      ? refreshedUrls[currentTrack._id] ?? currentTrack.songFileUrl ?? null
      : null;
  const { isBookmarked, handleBookmarkToggle } = usePlayerBookmark({
    currentTrack,
  });

  useListenProgressSync({
    audioRef,
    isPlaying,
    submissionId: currentTrack?._id ?? null,
    enabled: !isExternalLink,
  });

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (seekTo !== null && audioRef.current) {
      const audioElement = audioRef.current;

      const enforcementActive = !!(
        leagueData?.enforceListenPercentage &&
        currentTrack &&
        currentTrack.submissionType === "file"
      );

      const serverMet = currentTrackListenProgress?.isCompleted === true;
      const localMet = currentTrack ? !!listenProgress[currentTrack._id] : false;
      const alreadyMet = hasCompletedListenRequirement(serverMet, localMet);

      let target = seekTo;
      if (enforcementActive && !alreadyMet) {
        target = clampSeekTargetToAllowedProgress(
          seekTo,
          listenedUntilRef.current ?? 0,
          duration,
        );
      }

      manualSeekRef.current = true;
      audioElement.currentTime = Math.max(0, Math.min(target, audioElement.duration || target));

      if (!isPlaying) {
        actions.setIsPlaying(true);
      }
      actions.resetSeek();
    }
  }, [seekTo, isPlaying, actions, leagueData, currentTrack, currentTrackListenProgress, listenProgress, duration]);

  const commentsData = useQuery(
    api.submissions.getCommentsForSubmission,
    currentTrack
      ? { submissionId: currentTrack._id }
      : "skip",
  );

  const waveformComments = useMemo(
    () => extractTimestampedWaveformComments(commentsData),
    [commentsData],
  );

  const handleWaveformPresignedUrlRefresh = useCallback(
    ({ submissionId, url }: { submissionId: string; url: string }) => {
      setRefreshedUrls((prev) =>
        prev[submissionId] === url ? prev : { ...prev, [submissionId]: url },
      );
    },
    [],
  );

  const { waveformData, isWaveformLoading } = useSubmissionWaveform({
    currentTrack,
    effectiveSongUrl,
    getPresignedSongUrl,
    onPresignedUrlRefreshed: handleWaveformPresignedUrlRefresh,
  });

  useListeningPresence({
    isPlaying,
    submissionId: currentTrack?._id ?? null,
  });

  const { handleAudioError } = useAudioPlaybackSync({
    audioRef,
    currentTrack,
    effectiveSongUrl,
    isExternalLink,
    isPlaying,
    volume,
    setProgress,
    setIsPlaying: actions.setIsPlaying,
    getPresignedSongUrl,
    onRefreshedUrl: handleWaveformPresignedUrlRefresh,
  });

  const handleTimeUpdate = () => {
    const audioElement = audioRef.current;
    if (audioElement && !isNaN(audioElement.duration)) {
      setProgress(audioElement.currentTime);
      setDuration(audioElement.duration);
      try {
        actions.setPlaybackTime(audioElement.currentTime);
        actions.setPlaybackDuration(audioElement.duration);
      } catch {}

      // Logic to track listening progress and contiguous listened time
      if (leagueData?.enforceListenPercentage && currentTrack) {
        const serverMet = currentTrackListenProgress?.isCompleted === true;
        const localMet = listenProgress[currentTrack._id];
        const alreadyMet = hasCompletedListenRequirement(serverMet, !!localMet);

        // Update contiguous listened time only on natural playback (not immediately after a seek)
        if (!manualSeekRef.current && isPlaying && !isExternalLink) {
          if (audioElement.currentTime > listenedUntilRef.current) {
            listenedUntilRef.current = audioElement.currentTime;
          }
        }
        // Reset the manual seek flag after handling a tick
        if (manualSeekRef.current) manualSeekRef.current = false;

        if (!alreadyMet) {
          if (
            shouldMarkListenCompleted(
              listenedUntilRef.current,
              audioElement.duration,
              leagueData.listenPercentage,
              leagueData.listenTimeLimitMinutes,
            )
          ) {
            actions.setListenProgress(currentTrack._id, true);
          }
        }
      }
    }
  };

  // Build a YouTube playlist URL from all YouTube submissions currently in the queue
  const openYouTubePlaylistFromQueue = (roundId?: string | null) => {
    const ids = getQueueYouTubeVideoIds(queue, extractYouTubeVideoId, 50);
    const url = buildYouTubeWatchVideosUrl(ids);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    markRoundYouTubePlaylistOpened(roundId);
  };

  // Intercept playNext: if the next track is a YouTube submission, open the playlist instead
  const handlePlayNext = () => {
    const idx = currentTrackIndex;
    if (idx === null || queue.length === 0) {
      actions.playNext();
      return;
    }
    const isAtEnd = idx === queue.length - 1;
    const nextIndex = isAtEnd ? (repeatMode === "all" ? 0 : null) : idx + 1;
    if (nextIndex === null) {
      // Defer to store behavior (will stop playback)
      actions.playNext();
      return;
    }
    const nextTrack = queue[nextIndex];
    if (nextTrack?.submissionType === "youtube") {
      openYouTubePlaylistFromQueue();
      return; // do not advance to an individual YouTube track
    }
    actions.playNext();
  };

  const handleEnded = async () => {
    if (repeatMode === "one" && audioRef.current) {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
    } else {
      handlePlayNext();
    }
  };

  const handleSeek = (value: number | number[]) => {
    const requestedValue = Array.isArray(value) ? value[0] : value;
    if (requestedValue === undefined) return;
    const requested = requestedValue;
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const enforcementActive = !!(
      leagueData?.enforceListenPercentage &&
      currentTrack &&
      currentTrack.submissionType === "file"
    );

    const serverMet = currentTrackListenProgress?.isCompleted === true;
    const localMet = currentTrack ? !!listenProgress[currentTrack._id] : false;
    const alreadyMet = hasCompletedListenRequirement(serverMet, localMet);

    let target = requested;
    if (enforcementActive && !alreadyMet) {
      target = clampSeekTargetToAllowedProgress(
        requested,
        listenedUntilRef.current ?? 0,
        duration,
      );
    }

    // Mark that the next timeupdate should not count as natural listening
    manualSeekRef.current = true;

    // Apply seek
    audioElement.currentTime = Math.max(0, Math.min(target, audioElement.duration || target));
    setProgress(audioElement.currentTime);
  };

  const handleVolumeChange = (newVolume: number) => {
    actions.setVolume(newVolume);
  };

  const handleMuteToggle = () => {
    if (volume > 0) {
      setLastVolume(volume);
      actions.setVolume(0);
    } else {
      actions.setVolume(lastVolume > 0 ? lastVolume : 1);
    }
  };
  if (!currentTrack) {
    return null;
  }

  return (
    <>
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleAudioError}
        className="hidden"
      />
      <MusicQueue isOpen={isQueueOpen} onOpenChange={setIsQueueOpen} />
      <footer className="fixed bottom-16 left-0 right-0 z-50 h-auto border-t border-border bg-background text-foreground md:bottom-0 md:h-20">
        <div className="flex h-full flex-col items-center justify-between p-2 md:flex-row md:px-4">
          <PlayerTrackInfo
            currentTrack={currentTrack}
            isBookmarked={isBookmarked}
            onBookmarkToggle={handleBookmarkToggle}
          />

          <div className="flex w-full flex-1 flex-col items-center justify-center gap-1 md:px-4">
            <PlayerControls
              isPlaying={isPlaying}
              isExternalLink={isExternalLink}
              isShuffled={isShuffled}
              repeatMode={repeatMode}
              currentTrack={currentTrack}
              onTogglePlayPause={actions.togglePlayPause}
              onPlayNext={handlePlayNext}
              onPlayPrevious={actions.playPrevious}
              onToggleShuffle={actions.toggleShuffle}
              onToggleRepeat={actions.toggleRepeat}
            />

            <PlayerProgress
              isExternalLink={isExternalLink}
              isWaveformLoading={isWaveformLoading}
              waveformData={waveformData}
              currentTrack={currentTrack}
              progress={progress}
              duration={duration}
              comments={waveformComments}
              onSeek={handleSeek}
              leagueData={leagueData ?? undefined}
              listenProgress={currentTrackListenProgress}
            />
          </div>

          <PlayerActions
            isBookmarked={isBookmarked}
            onBookmarkToggle={handleBookmarkToggle}
            onQueueOpen={() => setIsQueueOpen(true)}
            volume={volume}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
          />
        </div>
      </footer>
    </>
  );
}
