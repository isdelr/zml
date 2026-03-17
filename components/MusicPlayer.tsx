"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Id } from "@/convex/_generated/dataModel";
import { dynamicImport } from "@/components/ui/dynamic-import";
import { extractTimestampedWaveformComments } from "@/lib/music/comments";
import {
  clampSeekTargetToAllowedProgress,
  hasCompletedListenRequirement,
  shouldMarkListenCompleted,
} from "@/lib/music/listen-enforcement";
import {
  getRoundQueueYouTubePlaylist,
  getYouTubePlaylistEntries,
} from "@/lib/music/youtube-queue";
import { buildYouTubeWatchVideosUrl, extractYouTubeVideoId } from "@/lib/youtube";
import { useListeningPresence } from "@/hooks/useListeningPresence";
import { useSubmissionWaveform } from "@/hooks/useSubmissionWaveform";
import { useAudioPlaybackSync } from "@/hooks/useAudioPlaybackSync";
import { useListenProgressSync } from "@/hooks/useListenProgressSync";
import { usePlayerBookmark } from "@/hooks/usePlayerBookmark";
import { useWindowSize } from "@/hooks/useWindowSize";
import {
  openUrlInNewTabWithFallback,
} from "@/lib/music/youtube-playlist-session";
import { parsePresignedUrlExpiry } from "@/lib/music/presigned-url";
import { getTotalPlaylistRequiredListenSeconds } from "@/lib/music/listen-progress";

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
    presenceSource,
    repeatMode,
    isShuffled,
    seekTo,
    volume,
    listenProgress,
    actions,
    isContextViewOpen,
  } = useMusicPlayerStore();
  const currentTrack =
    currentTrackIndex !== null ? queue[currentTrackIndex] ?? null : null;
  const { width } = useWindowSize();

  const audioRef = useRef<HTMLAudioElement>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedTrackIdRef = useRef<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [lastVolume, setLastVolume] = useState(volume);
  const [playbackUrls, setPlaybackUrls] = useState<Record<string, string>>({});
  const [waveformUrls, setWaveformUrls] = useState<Record<string, string>>({});

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
  const updatePresence = useMutation(api.presence.update);
  const updateListenProgress = useMutation(api.listenProgress.updateProgress);
  const startYouTubePlaylistSession = useMutation(
    api.listenProgress.startYouTubePlaylistSession,
  );

  const isExternalLink =
    currentTrack?.submissionType === "youtube";
  const effectiveSongUrl =
    currentTrack && currentTrack.submissionType === "file"
      ? playbackUrls[currentTrack._id] ?? currentTrack.songFileUrl ?? null
      : null;
  const waveformSongUrl =
    currentTrack && currentTrack.submissionType === "file"
      ? waveformUrls[currentTrack._id] ?? effectiveSongUrl
      : null;
  const { isBookmarked, handleBookmarkToggle } = usePlayerBookmark({
    currentTrack,
  });
  const completionSyncTrackRef = useRef<string | null>(null);
  const trackAdvanceInFlightRef = useRef(false);

  const getAdjacentQueueIndex = useCallback(
    (direction: 1 | -1) => {
      if (currentTrackIndex === null || queue.length === 0) {
        return null;
      }

      if (direction === 1) {
        const isAtEnd = currentTrackIndex === queue.length - 1;
        if (isAtEnd) {
          return repeatMode === "all" ? 0 : null;
        }
        return currentTrackIndex + 1;
      }

      if (currentTrackIndex > 0) {
        return currentTrackIndex - 1;
      }

      return null;
    },
    [currentTrackIndex, queue, repeatMode],
  );

  const nextTrack = useMemo(() => {
    const nextIndex = getAdjacentQueueIndex(1);
    return nextIndex === null ? null : queue[nextIndex] ?? null;
  }, [getAdjacentQueueIndex, queue]);

  const nextTrackCachedUrl =
    nextTrack && nextTrack.submissionType === "file"
      ? playbackUrls[nextTrack._id] ?? nextTrack.songFileUrl ?? null
      : null;

  useListenProgressSync({
    audioRef,
    isPlaying,
    submissionId: currentTrack?._id ?? null,
    enabled: !isExternalLink,
    serverProgressSeconds: currentTrackListenProgress?.progressSeconds ?? 0,
  });

  useEffect(() => {
    completionSyncTrackRef.current = null;
  }, [currentTrack?._id]);

  useEffect(() => {
    const currentTrackId = currentTrack?._id ?? null;
    if (!currentTrackId || width <= 0) {
      return;
    }

    const isDifferentTrack = lastPlayedTrackIdRef.current !== currentTrackId;
    lastPlayedTrackIdRef.current = currentTrackId;

    if (isDifferentTrack && width > 1440) {
      actions.openContextView();
    }
  }, [actions, currentTrack?._id, width]);

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

  const handlePlaybackPresignedUrlRefresh = useCallback(
    ({ submissionId, url }: { submissionId: string; url: string }) => {
      setPlaybackUrls((prev) =>
        prev[submissionId] === url ? prev : { ...prev, [submissionId]: url },
      );
    },
    [],
  );

  const handleWaveformPresignedUrlRefresh = useCallback(
    ({ submissionId, url }: { submissionId: string; url: string }) => {
      setWaveformUrls((prev) =>
        prev[submissionId] === url ? prev : { ...prev, [submissionId]: url },
      );
    },
    [],
  );

  const { waveformData, isWaveformLoading } = useSubmissionWaveform({
    currentTrack,
    effectiveSongUrl: waveformSongUrl,
    getPresignedSongUrl,
    onPresignedUrlRefreshed: handleWaveformPresignedUrlRefresh,
  });

  useListeningPresence({
    enabled: presenceSource === "player",
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
    onRefreshedUrl: handlePlaybackPresignedUrlRefresh,
  });

  useEffect(() => {
    const trackToPreload = nextTrack;
    if (!trackToPreload || trackToPreload.submissionType !== "file") {
      const preloadAudio = preloadAudioRef.current;
      if (preloadAudio) {
        preloadAudio.pause();
        preloadAudio.removeAttribute("src");
        preloadAudio.load();
      }
      return;
    }

    let isCancelled = false;

    const preloadNextTrack = async () => {
      let nextUrl = nextTrackCachedUrl;
      const expiresAt = parsePresignedUrlExpiry(nextUrl);
      const needsFreshUrl =
        !nextUrl ||
        (expiresAt !== null && expiresAt - Date.now() < 5 * 60 * 1000);

      if (needsFreshUrl) {
        try {
          const refreshedUrl = await getPresignedSongUrl({
            submissionId: trackToPreload._id,
          });
          if (refreshedUrl) {
            nextUrl = refreshedUrl;
          }
        } catch (error) {
          console.warn("Failed to prefetch next track URL", error);
        }
      }

      if (!nextUrl || isCancelled) {
        return;
      }

      setPlaybackUrls((prev) =>
        prev[trackToPreload._id] === nextUrl
          ? prev
          : { ...prev, [trackToPreload._id]: nextUrl },
      );

      if (typeof Audio === "undefined") {
        return;
      }

      const preloadAudio = preloadAudioRef.current ?? new Audio();
      preloadAudio.preload = "auto";
      if (preloadAudio.src !== nextUrl) {
        preloadAudio.src = nextUrl;
        preloadAudio.load();
      }
      preloadAudioRef.current = preloadAudio;
    };

    void preloadNextTrack();

    return () => {
      isCancelled = true;
    };
  }, [getPresignedSongUrl, nextTrack, nextTrackCachedUrl]);

  const syncCurrentTrackListenProgress = useCallback(async () => {
    if (
      !currentTrack ||
      currentTrack.submissionType !== "file" ||
      !leagueData?.enforceListenPercentage
    ) {
      return null;
    }

    const currentTime = audioRef.current?.currentTime ?? 0;
    const progressSeconds = Math.max(
      currentTrackListenProgress?.progressSeconds ?? 0,
      listenedUntilRef.current,
      currentTime,
    );
    if (!Number.isFinite(progressSeconds) || progressSeconds <= 0) {
      return null;
    }

    const result = await updateListenProgress({
      submissionId: currentTrack._id,
      progressSeconds,
    });

    if (result) {
      listenedUntilRef.current = Math.max(
        listenedUntilRef.current,
        result.progressSeconds,
      );
      if (result.isCompleted) {
        actions.setListenProgress(currentTrack._id, true);
      }
    }

    return result;
  }, [
    actions,
    audioRef,
    currentTrack,
    currentTrackListenProgress?.progressSeconds,
    leagueData?.enforceListenPercentage,
    updateListenProgress,
  ]);

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
            const trackId = currentTrack._id;
            if (completionSyncTrackRef.current !== trackId) {
              completionSyncTrackRef.current = trackId;
              void syncCurrentTrackListenProgress()
                .then((result) => {
                  if (!result?.isCompleted) {
                    completionSyncTrackRef.current = null;
                  }
                })
                .catch((error: unknown) => {
                  console.error("Failed to finalize listen progress", error);
                  completionSyncTrackRef.current = null;
                });
            }
          }
        }
      }
    }
  };

  const updatePlaylistPresence = useCallback(
    (roundId?: Id<"rounds"> | null) => {
      if (!roundId) return;
      void updatePresence({ listeningTo: null, roundId }).catch(
        (error: unknown) => {
          console.warn("[presence:youtube-playlist] non-fatal failure", error);
        },
      );
    },
    [updatePresence],
  );

  const openYouTubePlaylistFromQueue = useCallback(
    (
      roundId?: Id<"rounds"> | null,
      startSubmissionId?: Id<"submissions"> | null,
    ) => {
      if (!roundId) return false;
      const { videoIds } = getRoundQueueYouTubePlaylist(
        queue,
        roundId,
        extractYouTubeVideoId,
        50,
        startSubmissionId,
      );
      const youtubeEntries = getYouTubePlaylistEntries(
        queue,
        extractYouTubeVideoId,
        {
          maxIds: 50,
          roundId,
          startSubmissionId,
        },
      );
      const totalDurationSec = getTotalPlaylistRequiredListenSeconds(
        youtubeEntries.map((entry) => ({
          submissionIds: entry.submissionIds,
          durationSeconds: entry.durationSec,
        })),
        leagueData?.listenPercentage,
        leagueData?.listenTimeLimitMinutes,
      );
      const url = buildYouTubeWatchVideosUrl(videoIds);
      if (!url) return false;

      if (totalDurationSec > 0) {
        actions.setPresenceSource("youtubePlaylist");
        void startYouTubePlaylistSession({
          roundId,
          durationSec: totalDurationSec,
        }).catch((error) => {
          console.error("Failed to start YouTube playlist session", error);
        });
      }
      if (totalDurationSec > 0) {
        updatePlaylistPresence(roundId);
      }
      return openUrlInNewTabWithFallback(url, {
        fallbackToCurrentTab: true,
      });
    },
    [
      actions,
      queue,
      leagueData?.listenPercentage,
      leagueData?.listenTimeLimitMinutes,
      startYouTubePlaylistSession,
      updatePlaylistPresence,
    ],
  );

  const syncCurrentTrackListenProgressInBackground = useCallback(() => {
    void syncCurrentTrackListenProgress().catch((error: unknown) => {
      console.error("Failed to sync listen progress during track change", error);
    });
  }, [syncCurrentTrackListenProgress]);

  const handleTrackStep = useCallback(
    async (direction: 1 | -1) => {
      if (trackAdvanceInFlightRef.current) {
        return;
      }

      trackAdvanceInFlightRef.current = true;

      try {
        syncCurrentTrackListenProgressInBackground();

        const adjacentIndex = getAdjacentQueueIndex(direction);
        if (adjacentIndex === null) {
          if (direction === 1) {
            actions.playNext();
          } else {
            actions.playPrevious();
          }
          return;
        }

        const adjacentTrack = queue[adjacentIndex];
        if (adjacentTrack?.submissionType === "youtube") {
          const opened = openYouTubePlaylistFromQueue(
            adjacentTrack.roundId,
            adjacentTrack._id,
          );
          if (opened) {
            actions.setIsPlaying(false);
          }
          return;
        }

        if (direction === 1) {
          actions.playNext();
        } else {
          actions.playPrevious();
        }
      } finally {
        trackAdvanceInFlightRef.current = false;
      }
    },
    [
      actions,
      getAdjacentQueueIndex,
      openYouTubePlaylistFromQueue,
      queue,
      syncCurrentTrackListenProgressInBackground,
    ],
  );

  const handlePlayNext = useCallback(async () => {
    await handleTrackStep(1);
  }, [handleTrackStep]);

  const handlePlayPrevious = useCallback(async () => {
    await handleTrackStep(-1);
  }, [handleTrackStep]);

  const handleEnded = async () => {
    if (repeatMode === "one" && audioRef.current) {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
    } else {
      await handlePlayNext();
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
      <footer className="fixed bottom-0 left-0 right-0 z-50 h-auto border-t border-border bg-background pb-[env(safe-area-inset-bottom)] text-foreground md:h-20 md:pb-0">
        <div className="flex h-full flex-col items-center justify-between p-2 md:flex-row md:px-4">
          <PlayerTrackInfo
            currentTrack={currentTrack}
            isBookmarked={isBookmarked}
            onBookmarkToggle={handleBookmarkToggle}
            onQueueOpen={() => setIsQueueOpen(true)}
            onToggleContextView={actions.toggleContextView}
            isContextViewOpen={isContextViewOpen}
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
              onPlayPrevious={handlePlayPrevious}
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
