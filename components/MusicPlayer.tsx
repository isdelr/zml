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
  import("@/components/MusicQueue").then((mod) => ({ default: mod.MusicQueue })),
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
  
  const getPresignedSongUrl = useAction(api.submissions.getPresignedSongUrl);

  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);
  const { isAuthenticated } = useConvexAuth();

  const isExternalLink =
    currentTrack?.submissionType === "spotify" ||
    currentTrack?.submissionType === "youtube";

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
    } else {
      fetch(currentTrack.songFileUrl)
        .then((response) => response.arrayBuffer())
        .then((buffer) => {
          const options = {
            audio_context: audioContextRef.current!,
            array_buffer: buffer,
            scale: 512,
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
    const newBookmarkState = !isBookmarked;
    setIsBookmarked(newBookmarkState);
    toast.promise(
      toggleBookmark({ submissionId: currentTrack._id as Id<"submissions"> }),
      {
        loading: "Updating bookmark...",
        duration: 700,
        position: "bottom-left",
        success: (data) =>
          data.bookmarked ? "Song bookmarked!" : "Bookmark removed.",
        error: (err) => {
          setIsBookmarked(!newBookmarkState);
          return err.data?.message || "Failed to update bookmark.";
        },
      },
    );
  };

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement || !currentTrack) return;
    audioElement.volume = volume;
    if (isExternalLink) {
      audioElement.pause();
      if (isPlaying && currentTrack._id !== lastOpenedTrackId.current) {
        window.open(currentTrack.songLink, "_blank", "noopener,noreferrer");
        lastOpenedTrackId.current = currentTrack._id as string;
      }
      return;
    }

    lastOpenedTrackId.current = null;

    const handlePlayback = async () => {
      if (
        currentTrack.songFileUrl &&
        audioElement.src !== currentTrack.songFileUrl
      ) {
        audioElement.src = currentTrack.songFileUrl;
        setProgress(0);
      }
      try {
        if (isPlaying) {
          await audioElement.play();
        } else {
          audioElement.pause();
        }
      } catch (error) {
        console.error("Error during playback:", error);
        actions.setIsPlaying(false);
      }
    };
    handlePlayback();
  }, [currentTrack, isPlaying, actions, isExternalLink, volume]);

  const handleTimeUpdate = () => {
    const audioElement = audioRef.current;
    if (audioElement && !isNaN(audioElement.duration)) {
      setProgress(audioElement.currentTime);
      setDuration(audioElement.duration);
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
    if (!audioElement || !currentTrack || currentTrack.submissionType !== 'file') {
      return;
    }

    // The error event itself is simple. networkState tells us if it's a network issue.
    // NETWORK_NO_SOURCE is a strong indicator of an expired link (403 Forbidden).
    if (audioElement.networkState === audioElement.NETWORK_NO_SOURCE && audioElement.error) {
      console.error("Audio playback error:", audioElement.error);
      toast.info("Link expired. Refreshing song...", {
        duration: 3000,
      });

      try {
        const newUrl = await getPresignedSongUrl({
          submissionId: currentTrack._id as Id<"submissions">
        });

        if (newUrl) {
          const currentTime = audioElement.currentTime;
          console.log(`Fetched new URL. Resuming from ${currentTime}s.`);
          
          // Set the new URL
          audioElement.src = newUrl;

          // You MUST call load() after changing the src to make the browser fetch it.
          audioElement.load();

          // To ensure seamless playback, we listen for the 'canplay' event,
          // which fires when the browser has enough data to start playing.
          const playWhenReady = () => {
            audioElement.currentTime = currentTime; // Seek to the old position
            if (isPlaying) {
              audioElement.play().catch(e => console.error("Error re-playing after refresh:", e));
            }
          };
          
          // Use { once: true } so this listener only fires once per refresh.
          audioElement.addEventListener('canplay', playWhenReady, { once: true });

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
        onError={handleAudioError} // <-- ADD THIS LINE
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
              onPlayNext={actions.playNext}
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