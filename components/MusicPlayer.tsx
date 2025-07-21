"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Bookmark,
  List,
  MoreHorizontal,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import Image from "next/image";
import { useState, useRef, useEffect, useMemo } from "react";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Slider } from "./ui/slider";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useConvexAuth } from "convex/react";
import { MusicQueue } from "./MusicQueue";
import WaveformData from "waveform-data";
import { Waveform, WaveformComment } from "./Waveform";
import { Skeleton } from "./ui/skeleton";

export function MusicPlayer() {
  const {
    queue,
    currentTrackIndex,
    isPlaying,
    repeatMode,
    isShuffled,
    seekTo,
    actions,
  } = useMusicPlayerStore();
  const currentTrack =
    currentTrackIndex !== null ? queue[currentTrackIndex] : null;

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [isWaveformLoading, setIsWaveformLoading] = useState(false);

  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);
  const { isAuthenticated } = useConvexAuth();

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
  }, []);

  // Effect to handle seek requests from the global store
  useEffect(() => {
    if (seekTo !== null && audioRef.current) {
      audioRef.current.currentTime = seekTo;
      if (!isPlaying) {
        actions.setIsPlaying(true);
      }
      actions.resetSeek(); // Reset after seeking to prevent re-triggering
    }
  }, [seekTo, isPlaying, actions]);

  // Fetch comments for the current track
  const commentsData = useQuery(
    api.submissions.getCommentsForSubmission,
    currentTrack
      ? { submissionId: currentTrack._id as Id<"submissions"> }
      : "skip",
  );

  // Parse comments to find timestamps for the waveform
  const waveformComments = useMemo((): WaveformComment[] => {
    if (!commentsData || !currentTrack) return [];
    
    // Check round status for anonymity
    const isAnonymous = currentTrack.roundStatus === "voting";

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
            // Anonymize author info if the round is in voting
            authorName: isAnonymous ? "Anonymous" : comment.authorName,
            authorImage: isAnonymous ? null : comment.authorImage,
            // Use comment ID for a unique anonymous avatar, otherwise use user ID
            authorId: isAnonymous ? comment._id : comment.userId,
          });
        }
      }
    });

    return timestampedComments;
  }, [commentsData, currentTrack]);

  useEffect(() => {
    if (currentTrack?.songFileUrl && audioContextRef.current) {
      setWaveformData(null);
      setIsWaveformLoading(true);

      fetch(currentTrack.songFileUrl)
        .then((response) => response.arrayBuffer())
        .then((buffer) => {
          const options = {
            audio_context: audioContextRef.current!,
            array_buffer: buffer,
            scale: 512,
          };
          WaveformData.createFromAudio(options, (err, waveform) => {
            setIsWaveformLoading(false);
            if (err) {
              console.error("Error creating waveform:", err);
            } else {
              setWaveformData(waveform);
            }
          });
        })
        .catch((error) => {
          console.error("Error fetching audio for waveform:", error);
          setIsWaveformLoading(false);
        });
    } else {
      setWaveformData(null);
    }
  }, [currentTrack?.songFileUrl]);

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
    if (!audioElement || !currentTrack?.songFileUrl) return;
    const handlePlayback = async () => {
      if (audioElement.src !== currentTrack.songFileUrl) {
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
  }, [currentTrack, isPlaying, actions]);

  const handleTimeUpdate = () => {
    const audioElement = audioRef.current;
    if (audioElement && !isNaN(audioElement.duration)) {
      setProgress(audioElement.currentTime);
      setDuration(audioElement.duration);
    }
  };

  const handleEnded = () => {
    if (repeatMode === "one" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
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

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
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
        className="hidden"
      />
      <MusicQueue isOpen={isQueueOpen} onOpenChange={setIsQueueOpen} />
      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background text-foreground">
        <div className="flex h-20 items-center justify-between px-4">
          {/* Left Section: Track Info */}
          <div className="flex w-1/4 min-w-0 items-center gap-3">
            <Image
              src={currentTrack.albumArtUrl}
              alt={currentTrack.songTitle}
              width={48}
              height={48}
              className="flex-shrink-0 rounded-md"
            />
            <div className="truncate">
              <p className="truncate text-sm font-semibold">
                {currentTrack.songTitle}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {currentTrack.artist}
              </p>
            </div>
          </div>

          {/* Center Section: Player Controls and Waveform */}
          <div className="flex flex-1 items-center  gap-1 px-4">
            {/* Top Row: Playback Buttons */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8 text-muted-foreground hover:text-foreground",
                  isShuffled && "text-primary",
                )}
                onClick={actions.toggleShuffle}
                title="Shuffle"
              >
                <Shuffle className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={actions.playPrevious}
                title="Previous"
              >
                <SkipBack className="size-4" />
              </Button>
              <Button
                variant="default"
                size="icon"
                className="size-10 rounded-full"
                onClick={actions.togglePlayPause}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="size-5 fill-primary-foreground" />
                ) : (
                  <Play className="size-5 fill-primary-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={actions.playNext}
                title="Next"
              >
                <SkipForward className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8 text-muted-foreground hover:text-foreground",
                  repeatMode !== "none" && "text-primary",
                )}
                onClick={actions.toggleRepeat}
                title={`Repeat: ${repeatMode}`}
              >
                {repeatMode === "one" ? (
                  <Repeat1 className="size-4" />
                ) : (
                  <Repeat className="size-4" />
                )}
              </Button>
            </div>

            {/* Bottom Row: Waveform and Time */}
            <div
              className="flex w-full max-w-xl items-center gap-2"
            >
              <span className="w-10 text-right text-xs text-muted-foreground">
                {formatTime(progress)}
              </span>
              <div className="relative flex-1 transition-transform duration-50">
                {isWaveformLoading ? (
                  <Skeleton className="h-8 w-full" />
                ) : waveformData ? (
                  <Waveform
                    waveform={waveformData}
                    progress={progress}
                    duration={duration}
                    onSeek={handleSeek}
                    className="h-8"
                    comments={waveformComments}
                  />
                ) : (
                  <Slider
                    value={[progress]}
                    max={duration || 1}
                    step={1}
                    onValueChange={handleSeek}
                  />
                )}
              </div>
              <span className="w-10 text-left text-xs text-muted-foreground">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Right Section: Extra Controls */}
          <div className="flex w-1/4 items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0"
              onClick={handleBookmarkToggle}
              title="Bookmark song"
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
              className="flex-shrink-0"
              onClick={() => setIsQueueOpen(true)}
            >
              <List className="size-5" />
            </Button>
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <MoreHorizontal className="size-5" />
            </Button>
          </div>
        </div>
      </footer>
    </>
  );
}
