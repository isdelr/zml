"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useConvexAuth } from "convex/react";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import WaveformData from "waveform-data";
import { WaveformComment } from "@/components/Waveform";
import { dynamicImport } from "@/components/ui/dynamic-import";
import { Song } from "@/types";

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
    currentTrackIndex !== null ? queue[currentTrackIndex] : null;

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastOpenedTrackId = useRef<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [isWaveformLoading, setIsWaveformLoading] = useState(false);
  const [lastVolume, setLastVolume] = useState(volume);
  const [refreshedUrls, setRefreshedUrls] = useState<Record<string, string>>({});
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const audioRefreshTimeoutRef = useRef<number | null>(null);
  const prevTrackIdRef = useRef<string | null>(null);

  const leagueData = useQuery(
    api.leagues.get,
    currentTrack ? { id: currentTrack.leagueId } : "skip",
  );

  // Fetch listen progress for the current round
  const roundListenProgress = useQuery(
    api.listenProgress.getForRound,
    currentTrack ? { roundId: currentTrack.roundId as Id<"rounds"> } : "skip"
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
  const updateDbProgress = useMutation(api.listenProgress.updateProgress);

  // Helpers to parse R2 signed URL expiry and schedule refresh
  const parseExpiryFromUrl = useCallback((url?: string | null): number | null => {
    if (!url) return null;
    try {
      const u = new URL(url);
      const expires = u.searchParams.get("X-Amz-Expires");
      const date = u.searchParams.get("X-Amz-Date");
      if (expires && date) {
        // X-Amz-Date format: YYYYMMDDTHHMMSSZ
        const year = Number(date.slice(0, 4));
        const month = Number(date.slice(4, 6)) - 1; // 0-based
        const day = Number(date.slice(6, 8));
        const hour = Number(date.slice(9, 11));
        const min = Number(date.slice(11, 13));
        const sec = Number(date.slice(13, 15));
        const startMs = Date.UTC(year, month, day, hour, min, sec);
        const expSec = Number(expires);
        if (!isNaN(startMs) && !isNaN(expSec)) {
          return startMs + expSec * 1000;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  const pendingSeekTimeRef = useRef<number | null>(null);
  const pendingShouldPlayRef = useRef<boolean>(false);


  const refreshAudioUrl = useCallback(async (silent = true) => {
    const audioElement = audioRef.current;
    if (!audioElement || !currentTrack || currentTrack.submissionType !== "file") return;
    try {
      // Preserve playback state
      pendingSeekTimeRef.current = isFinite(audioElement.currentTime) ? audioElement.currentTime : 0;
      pendingShouldPlayRef.current = !audioElement.paused;
      const newUrl = await getPresignedSongUrl({
        submissionId: currentTrack._id as Id<"submissions">,
      });
      if (newUrl) {
        setRefreshedUrls((prev) => ({ ...prev, [currentTrack._id]: newUrl }));
      } else {
        // If cannot refresh, pause to avoid looping errors
        actions.setIsPlaying(false);
      }
    } catch (e) {
      if (!silent) {
        console.error("Failed to refresh audio URL", e);
      }
      // Don't surface a toast to keep it invisible
    }
  }, [currentTrack, getPresignedSongUrl, actions]);

  const toggleBookmark = useMutation(
    api.bookmarks.toggleBookmark,
  ).withOptimisticUpdate((localStore, { submissionId }) => {
    // 1. Update the isBookmarked flag in any cached `getForRound` queries
    const roundQueries = localStore.getQuery(api.submissions.getForRound);
    if (roundQueries) {
      for (const [queryArgs, submissions] of roundQueries.entries()) {
        if (submissions?.some((s) => s._id === submissionId)) {
          const newSubmissions = submissions.map((s) =>
            s._id === submissionId
              ? { ...s, isBookmarked: !s.isBookmarked }
              : s,
          );
          localStore.setQuery(
            api.submissions.getForRound,
            queryArgs,
            newSubmissions,
          );
        }
      }
    }

    // 2. Update the dedicated list of bookmarked songs
    const currentBookmarked = localStore.getQuery(
      api.bookmarks.getBookmarkedSongs,
      {},
    );
    if (currentBookmarked) {
      const isAlreadyBookmarked = currentBookmarked.some(
        (s) => s._id === submissionId,
      );
      if (isAlreadyBookmarked) {
        const newBookmarked = currentBookmarked.filter(
          (s) => s._id !== submissionId,
        );
        localStore.setQuery(
          api.bookmarks.getBookmarkedSongs,
          {},
          newBookmarked,
        );
      } else {
        // Optimistically adding requires the full song object, which we don't have here.
        // It's safe to just let the server state catch up in this case.
      }
    }
  });

  const { isAuthenticated } = useConvexAuth();

  const updatePresence = useMutation(api.presence.update);

  const isExternalLink =
    currentTrack?.submissionType === "youtube";

  // Auto-start/stop the external (YouTube) timer based on play state and track changes
  useEffect(() => {
    if (isExternalLink) {
      setIsTimerRunning(isPlaying);
    } else {
      if (isTimerRunning) setIsTimerRunning(false);
    }
    // Reset when track changes as well
  }, [isExternalLink, isPlaying, currentTrack?._id]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (isPlaying && currentTrack && audioRef.current && !isExternalLink) {
        const progressSeconds = audioRef.current.currentTime;
        if (progressSeconds > 0) {
          updateDbProgress({
            submissionId: currentTrack._id as Id<"submissions">,
            progressSeconds,
          }).catch(console.error);
        }
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isPlaying, currentTrack, isExternalLink, updateDbProgress]);

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
  }, []);

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
      const alreadyMet = serverMet || localMet;

      let target = seekTo;
      if (enforcementActive && !alreadyMet) {
        const TOLERANCE = 1.5;
        const lastAllowed = (listenedUntilRef.current ?? 0) + TOLERANCE;
        if (seekTo > lastAllowed) {
          target = Math.min(lastAllowed, duration || lastAllowed);
        }
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
      ? { submissionId: currentTrack._id as Id<"submissions"> }
      : "skip",
  );

  const waveformComments = useMemo((): WaveformComment[] => {
    if (!commentsData || !currentTrack) return [];

    const parseTimeToSeconds = (timeStr: string): number => {
      const parts = timeStr.split(":").map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return parts[0] * 60 + parts[1];
      }
      return -1;
    };

    const timestampedComments: WaveformComment[] = [];
    const timestampRegex = /@(\d{1,2}:\d{2})/;

    commentsData.forEach((comment) => {
      const match = comment.text.match(timestampRegex);
      if (match) {
        const time = parseTimeToSeconds(match[1]);
        if (time !== -1) {
          timestampedComments.push({
            id: comment._id,
            time,
            text: comment.text.replace(timestampRegex, "").trim(),
            authorName: comment.authorName,
            authorImage: comment.authorImage,
            authorId: comment.userId,
          });
        }
      }
    });

    return timestampedComments;
  }, [commentsData, currentTrack]);

  const storeWaveform = useMutation(api.submissions.storeWaveform);
  const cachedWaveform = useQuery(
    api.submissions.getWaveform,
    currentTrack && currentTrack.submissionType === "file"
      ? { submissionId: currentTrack._id as Id<"submissions"> }
      : "skip",
  );

  useEffect(() => {
    if (
      currentTrack?.submissionType !== "file" ||
      !currentTrack?.songFileUrl ||
      !audioContextRef.current
    ) {
      setWaveformData(null);
      setIsWaveformLoading(false);
      return;
    }

    if (cachedWaveform === undefined) {
      setIsWaveformLoading(true);
      setWaveformData(null);
      return;
    }

    setIsWaveformLoading(true);
    setWaveformData(null);

    if (cachedWaveform?.waveform) {
      try {
        const data = JSON.parse(cachedWaveform.waveform);
        const waveform = WaveformData.create(data);
        setWaveformData(waveform);
        setIsWaveformLoading(false);
      } catch (err) {
        console.error("Failed to parse cached waveform:", err);
        setIsWaveformLoading(false);
      }
    } else if (currentTrack.songFileUrl) {
      fetch(currentTrack.songFileUrl)
        .then((response) => response.arrayBuffer())
        .then((buffer) => {
          try {
            const options = {
              audio_context: audioContextRef.current!,
              array_buffer: buffer,
              // --- CHANGE: Increased scale for compression ---
              // A larger scale reduces the number of data points, making the JSON smaller.
              // 1024 is a good balance between size and visual quality.
              scale: 1024,
            };
            WaveformData.createFromAudio(options, (err, waveform) => {
              if (err) {
                console.error("Error creating waveform:", err);
                setIsWaveformLoading(false);
              } else {
                setWaveformData(waveform);
                setIsWaveformLoading(false);
                storeWaveform({
                  submissionId: currentTrack._id as Id<"submissions">,
                  waveformJson: JSON.stringify(waveform.toJSON()),
                });
              }
            });
          } catch (error) {
            console.error(
              "A critical error occurred during waveform generation:",
              error,
            );
            toast.error(
              "Could not generate waveform for this audio file. It may be corrupted.",
            );
            setIsWaveformLoading(false);
            setWaveformData(null);
          }
        })
        .catch((error) => {
          setIsWaveformLoading(false);
          console.error("Error fetching/processing waveform:", error);
        });
    }
  }, [
    currentTrack?._id,
    currentTrack?.songFileUrl,
    currentTrack?.submissionType,
    cachedWaveform,
    storeWaveform,
  ]);

  useEffect(() => {
    if (isPlaying && currentTrack) {
      // User is actively listening to a track
      updatePresence({ listeningTo: currentTrack._id as Id<"submissions"> });
    } else {
      // User is not listening (player is paused or no track)
      updatePresence({ listeningTo: null });
    }

    // This is the cleanup function. When the component unmounts, clear presence.
    return () => {
      updatePresence({ listeningTo: null });
    };
  }, [isPlaying, currentTrack, updatePresence]);

  useEffect(() => {
    if (currentTrack) {
      setIsBookmarked(currentTrack.isBookmarked ?? false);
    }
  }, [currentTrack]);

  const handleBookmarkToggle = () => {
    if (!isAuthenticated) {
      toast.error("You must be logged in to bookmark a song.");
      return;
    }
    if (!currentTrack?._id) return;

    // Local state update for immediate feedback on the player icon itself
    const newBookmarkState = !isBookmarked;
    setIsBookmarked(newBookmarkState);

    toggleBookmark({
      submissionId: currentTrack._id as Id<"submissions">,
    }).catch(() => {
      // Revert local state on error
      setIsBookmarked(!newBookmarkState);
      toast.error("Failed to update bookmark.");
    });
  };

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement || !currentTrack) return;
    audioElement.volume = volume;
    if (isExternalLink) {
      audioElement.pause();
      if (isPlaying && currentTrack._id !== lastOpenedTrackId.current) {
        window.open(currentTrack.songLink!, "_blank", "noopener,noreferrer");
        lastOpenedTrackId.current = currentTrack._id as string;
      }
      return;
    }

    lastOpenedTrackId.current = null;

    const effectiveSongUrl =
      refreshedUrls[currentTrack._id] || currentTrack.songFileUrl;

    const prevTrackId = prevTrackIdRef.current;
    const sameTrack = prevTrackId === (currentTrack._id as string);
    prevTrackIdRef.current = currentTrack._id as string;

    // Define and schedule preemptive refresh before expiry
    const scheduleAudioRefresh = (effectiveUrl?: string | null) => {
      // Clear previous
      if (audioRefreshTimeoutRef.current) {
        window.clearTimeout(audioRefreshTimeoutRef.current);
        audioRefreshTimeoutRef.current = null;
      }
      const expiry = parseExpiryFromUrl(effectiveUrl ?? undefined);
      // Safety margin seconds before expiry
      const SAFETY_MS = 60_000; // 60s
      let delay = 0;
      if (expiry) {
        const now = Date.now();
        delay = Math.max(0, expiry - SAFETY_MS - now);
      } else {
        // Fallback periodic refresh every 15 minutes
        delay = 15 * 60 * 1000;
      }
      audioRefreshTimeoutRef.current = window.setTimeout(async () => {
        await refreshAudioUrl(true);
      }, delay);
    };
    scheduleAudioRefresh(effectiveSongUrl || undefined);

    const applyPendingRestore = async () => {
      const targetTime = pendingSeekTimeRef.current ?? 0;
      const shouldPlay = pendingShouldPlayRef.current;
      pendingSeekTimeRef.current = null;
      pendingShouldPlayRef.current = false;
      try {
        // Set time as soon as metadata is available
        if (!isNaN(audioElement.duration)) {
          audioElement.currentTime = Math.min(targetTime, audioElement.duration || targetTime);
        } else {
          audioElement.currentTime = targetTime;
        }
        if (shouldPlay) {
          await audioElement.play();
        }
      } catch {
        // keep silent for invisibility
      }
    };

    const handlePlayback = async () => {
      if (effectiveSongUrl && audioElement.src !== effectiveSongUrl) {
        const isRefresh = sameTrack;
        try {
          audioElement.src = effectiveSongUrl;
          if (isRefresh && pendingSeekTimeRef.current !== null) {
            const onLoaded = async () => {
              audioElement.removeEventListener("loadedmetadata", onLoaded);
              await applyPendingRestore();
            };
            audioElement.addEventListener("loadedmetadata", onLoaded);
          } else {
            setProgress(0);
            if (isPlaying) {
              await audioElement.play();
            } else {
              audioElement.pause();
            }
          }
        } catch (error) {
          if (error?.name !== "AbortError") {
            console.error("Error during playback:", error);
            actions.setIsPlaying(false);
          }
        }
      } else {
        // No src change, just sync play/pause
        try {
          if (isPlaying) {
            await audioElement.play();
          } else {
            audioElement.pause();
          }
        } catch (error) {
          if (error?.name !== "AbortError") {
            console.error("Error during playback:", error);
            actions.setIsPlaying(false);
          }
        }
      }
    };
    handlePlayback();

    return () => {
      if (audioRefreshTimeoutRef.current) {
        window.clearTimeout(audioRefreshTimeoutRef.current);
        audioRefreshTimeoutRef.current = null;
      }
    };
  }, [currentTrack, isPlaying, actions, isExternalLink, volume, refreshedUrls, parseExpiryFromUrl, refreshAudioUrl]);

  const handleTimeUpdate = () => {
    const audioElement = audioRef.current;
    if (audioElement && !isNaN(audioElement.duration)) {
      setProgress(audioElement.currentTime);
      setDuration(audioElement.duration);

      // Logic to track listening progress and contiguous listened time
      if (leagueData?.enforceListenPercentage && currentTrack) {
        const serverMet = currentTrackListenProgress?.isCompleted === true;
        const localMet = listenProgress[currentTrack._id];
        const alreadyMet = serverMet || localMet;

        // Update contiguous listened time only on natural playback (not immediately after a seek)
        if (!manualSeekRef.current && isPlaying && !isExternalLink) {
          if (audioElement.currentTime > listenedUntilRef.current) {
            listenedUntilRef.current = audioElement.currentTime;
          }
        }
        // Reset the manual seek flag after handling a tick
        if (manualSeekRef.current) manualSeekRef.current = false;

        if (!alreadyMet) {
          const requiredPercentage = (leagueData.listenPercentage ?? 100) / 100;
          const timeLimitSeconds = (leagueData.listenTimeLimitMinutes ?? 999) * 60;
          const requiredListenTime = Math.min(
            audioElement.duration * requiredPercentage,
            timeLimitSeconds,
          );

          if (listenedUntilRef.current >= requiredListenTime) {
            actions.setListenProgress(currentTrack._id, true);
          }
        }
      }
    }
  };

  const handleEnded = async () => {
    if (repeatMode === "one" && audioRef.current) {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
    } else {
      actions.playNext();
    }
  };

  const handleSeek = (value: number | number[]) => {
    const requested = Array.isArray(value) ? value[0] : value;
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const enforcementActive = !!(
      leagueData?.enforceListenPercentage &&
      currentTrack &&
      currentTrack.submissionType === "file"
    );

    const serverMet = currentTrackListenProgress?.isCompleted === true;
    const localMet = currentTrack ? !!listenProgress[currentTrack._id] : false;
    const alreadyMet = serverMet || localMet;

    let target = requested;
    if (enforcementActive && !alreadyMet) {
      const TOLERANCE = 1.5; // seconds of grace to account for UI jitter
      const lastAllowed = (listenedUntilRef.current ?? 0) + TOLERANCE;
      // Allow backward seeks freely; clamp forward seeks to lastAllowed
      if (requested > lastAllowed) {
        target = Math.min(lastAllowed, duration || lastAllowed);
      }
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

  const handleStartTimer = () => {
    setIsTimerRunning(true);
  };

  const handleAudioError = async () => {
    const audioElement = audioRef.current;
    if (!audioElement || !currentTrack || currentTrack.submissionType !== "file") {
      return;
    }
    // Any media error while using an expiring URL should trigger a silent refresh
    try {
      await refreshAudioUrl(true);
    } catch {
      // Silent
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
              currentTrack={currentTrack as Song}
              onTogglePlayPause={actions.togglePlayPause}
              onPlayNext={actions.playNext}
              onPlayPrevious={actions.playPrevious}
              onToggleShuffle={actions.toggleShuffle}
              onToggleRepeat={actions.toggleRepeat}
              onStartTimer={handleStartTimer}
            />

            <PlayerProgress
              isExternalLink={isExternalLink}
              isWaveformLoading={isWaveformLoading}
              waveformData={waveformData}
              currentTrack={currentTrack as Song}
              progress={progress}
              duration={duration}
              comments={waveformComments}
              onSeek={handleSeek}
              leagueData={leagueData}
              listenProgress={currentTrackListenProgress}
              isTimerRunning={isTimerRunning}
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