"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Bookmark,
  MoreHorizontal,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Slider } from "./ui/slider";

export function MusicPlayer() {
  const { queue, currentTrackIndex, isPlaying, actions } =
    useMusicPlayerStore();
  const currentTrack =
    currentTrackIndex !== null ? queue[currentTrackIndex] : null;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  // --- Start of Changed Section ---

  // Consolidated effect to manage all playback logic
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement || !currentTrack) return;

    const handlePlayback = async () => {
      // 1. Set the new song source if it's different
      if (audioElement.src !== currentTrack.songFileUrl) {
        audioElement.src = currentTrack.songFileUrl!;
        setProgress(0); // Reset progress for the new track
      }

      // 2. Handle play/pause state
      try {
        if (isPlaying) {
          // Awaiting the play() promise is the key to fixing the interruption error.
          // It tells the browser to wait until it's ready to play the new source.
          await audioElement.play();
        } else {
          audioElement.pause();
        }
      } catch (error) {
        // This is important for handling browser autoplay restrictions
        console.error("Error during playback:", error);
        actions.setIsPlaying(false); // Update state to show that playback failed
      }
    };

    handlePlayback();
  }, [currentTrack, isPlaying, actions]);

  // --- End of Changed Section ---

  const handleTimeUpdate = () => {
    const audioElement = audioRef.current;
    if (audioElement && !isNaN(audioElement.duration)) {
      setProgress(audioElement.currentTime);
      setDuration(audioElement.duration);
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
    return null; // Don't render the player if there's no track
  }

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={actions.playNext}
        className="hidden"
      />
      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background text-foreground">
        <div className="flex h-24 items-center justify-between px-4">
          {/* Left Section: Track Info */}
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
              className="ml-auto flex-shrink-0"
            >
              <Bookmark
                className={cn("size-5", isLiked && "fill-primary text-primary")}
                onClick={() => setIsLiked(!isLiked)}
              />
            </Button>
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <MoreHorizontal className="size-5" />
            </Button>
          </div>

          {/* Center Section: Player Controls & Progress */}
          <div className="flex w-1/2 flex-col items-center gap-2">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
              >
                <Shuffle className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={actions.playPrevious}
              >
                <SkipBack className="size-5" />
              </Button>
              <Button
                variant="default"
                size="icon"
                className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={actions.togglePlayPause}
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
              >
                <SkipForward className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
              >
                <Repeat className="size-5" />
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

          {/* Right Section: Other Controls (kept empty for now) */}
          <div className="flex w-1/4 items-center justify-end gap-2"></div>
        </div>
      </footer>
    </>
  );
}