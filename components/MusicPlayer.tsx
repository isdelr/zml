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
  Repeat1, // Import the 'Repeat1' icon for "repeat one" mode
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Slider } from "./ui/slider";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useConvexAuth } from "convex/react";
import { MusicQueue } from "./MusicQueue";

export function MusicPlayer() {
  const {
    queue,
    currentTrackIndex,
    isPlaying,
    repeatMode,
    isShuffled,
    actions,
  } = useMusicPlayerStore();
  const currentTrack =
    currentTrackIndex !== null ? queue[currentTrackIndex] : null;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const [isBookmarked, setIsBookmarked] = useState(false);
  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);
  const { isAuthenticated } = useConvexAuth();

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
    if (!audioElement || !currentTrack) return;

    const handlePlayback = async () => {
      if (audioElement.src !== currentTrack.songFileUrl) {
        audioElement.src = currentTrack.songFileUrl!;
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

  // New handler for when a track ends
  const handleEnded = () => {
    if (repeatMode === "one" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      actions.playNext();
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setProgress(value[0]);
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
        onEnded={handleEnded} // Use the new ended handler
        className="hidden"
      />
      <MusicQueue isOpen={isQueueOpen} onOpenChange={setIsQueueOpen} />
      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background text-foreground">
        <div className="flex h-24 items-center justify-between px-4">
          <div className="flex w-1/4 min-w-0 items-center gap-3">
            <Image
              src={currentTrack.albumArtUrl}
              alt={currentTrack.songTitle}
              width={56}
              height={56}
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
            <Button
              variant="ghost"
              size="icon"
              className="ml-4 flex-shrink-0"
              onClick={handleBookmarkToggle}
              title={
                !isAuthenticated
                  ? "Sign in to bookmark songs"
                  : "Bookmark song"
              }
            >
              <Bookmark
                className={cn(
                  "size-5",
                  isBookmarked && "fill-primary text-primary",
                )}
              />
            </Button>
          </div>

          <div className="flex w-1/2 flex-col items-center gap-2">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  isShuffled && "text-primary",
                )}
                onClick={actions.toggleShuffle}
                title="Shuffle"
              >
                <Shuffle className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={actions.playPrevious}
                title="Previous"
              >
                <SkipBack className="size-5" />
              </Button>
              <Button
                variant="default"
                size="icon"
                className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
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
                className="text-muted-foreground hover:text-foreground"
                onClick={actions.playNext}
                title="Next"
              >
                <SkipForward className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  repeatMode !== "none" && "text-primary",
                )}
                onClick={actions.toggleRepeat}
                title={`Repeat: ${repeatMode}`}
              >
                {repeatMode === "one" ? (
                  <Repeat1 className="size-5" />
                ) : (
                  <Repeat className="size-5" />
                )}
              </Button>
            </div>
            <div className="flex w-full max-w-xl items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatTime(progress)}
              </span>
              <Slider
                value={[progress]}
                max={duration}
                step={1}
                onValueChange={handleSeek}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          <div className="flex w-1/4 items-center justify-end gap-2">
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