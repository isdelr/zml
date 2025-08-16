"use client";

import { useRef, useEffect, useState, useMemo } from "react";
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

  const getPresignedSongUrl = useAction(api.submissions.getPresignedSongUrl);
  const updateDbProgress = useMutation(api.listenProgress.updateProgress);

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
    currentTrack?.submissionType === "spotify" ||
    currentTrack?.submissionType === "youtube";

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
      audioRef.current.currentTime = seekTo;
      if (!isPlaying) {
        actions.setIsPlaying(true);
      }
      actions.resetSeek();
    }
  }, [seekTo, isPlaying, actions]);

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

    const handlePlayback = async () => {
      if (effectiveSongUrl && audioElement.src !== effectiveSongUrl) {
        audioElement.src = effectiveSongUrl;
        setProgress(0);
      }
      try {
        if (isPlaying) {
          await audioElement.play();
        } else {
          audioElement.pause();
        }
      } catch (error: unknown) {
        if (error.name !== "AbortError") {
          console.error("Error during playback:", error);
          actions.setIsPlaying(false);
        }
      }
    };
    handlePlayback();
  }, [currentTrack, isPlaying, actions, isExternalLink, volume, refreshedUrls]);

  const handleTimeUpdate = () => {
    const audioElement = audioRef.current;
    if (audioElement && !isNaN(audioElement.duration)) {
      setProgress(audioElement.currentTime);
      setDuration(audioElement.duration);

      // Logic to track listening progress
      if (leagueData?.enforceListenPercentage && currentTrack) {
        const alreadyMet = listenProgress[currentTrack._id];
        if (!alreadyMet) {
          const requiredPercentage = (leagueData.listenPercentage ?? 100) / 100;
          const timeLimitSeconds =
            (leagueData.listenTimeLimitMinutes ?? 999) * 60;

          const requiredListenTime = Math.min(
            audioElement.duration * requiredPercentage,
            timeLimitSeconds,
          );

          if (audioElement.currentTime >= requiredListenTime) {
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
    const seekTime = Array.isArray(value) ? value[0] : value;
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setProgress(seekTime);
    }
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

  const handleAudioError = async () => {
    const audioElement = audioRef.current;
    if (
      !audioElement ||
      !currentTrack ||
      currentTrack.submissionType !== "file"
    ) {
      return;
    }

    if (
      audioElement.networkState === audioElement.NETWORK_NO_SOURCE &&
      audioElement.error
    ) {
      console.error("Audio playback error:", audioElement.error);
      toast.info("Link expired. Refreshing song...", { duration: 3000 });

      try {
        const newUrl = await getPresignedSongUrl({
          submissionId: currentTrack._id as Id<"submissions">,
        });

        if (newUrl) {
          const currentTime = audioElement.currentTime;

          setRefreshedUrls(prev => ({...prev, [currentTrack._id]: newUrl}));

          audioElement.src = newUrl;
          audioElement.load();

          const playWhenReady = () => {
            audioElement.currentTime = currentTime;
            if (isPlaying) {
              audioElement
                .play()
                .catch((e) =>
                  console.error("Error re-playing after refresh:", e),
                );
            }
          };

          audioElement.addEventListener("canplay", playWhenReady, {
            once: true,
          });
        } else {
          toast.error("Could not refresh the song's link.");
          actions.setIsPlaying(false);
        }
      } catch (error) {
        console.error("Failed to execute getPresignedSongUrl:", error);
        toast.error("An error occurred while trying to refresh the song.");
        actions.setIsPlaying(false);
      }
    }
  };

  if (!currentTrack) {
    return null;
  }

  return (
    <>
      <audio
        ref={audioRef}
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