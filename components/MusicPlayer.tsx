"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronUp,
  Heart,
  ListMusic,
  MoreHorizontal,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

// Placeholder for the current track data
const currentTrack = {
  title: "Let Me Down Slowly",
  artist: "Alec Benjamin",
  duration: 169, // 2:49 in seconds
};

export function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(85); // 1:25 in seconds
  const [isLiked, setIsLiked] = useState(true);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background text-foreground">
      <div className="flex h-24 items-center justify-between px-4">
        {/* Left Section: Track Info */}
        <div className="flex w-1/4 items-center gap-3">
          <Image
            src="https://i.scdn.co/image/ab67616d0000b273b5a70749a49335f36e4f4546" // Placeholder album art
            alt="Album Art"
            width={56}
            height={56}
            className="rounded-md"
          />
          <div>
            <p className="text-sm font-semibold">{currentTrack.title}</p>
            <p className="text-xs text-muted-foreground">
              {currentTrack.artist}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="ml-4">
            <Heart
              className={cn("size-5", isLiked && "fill-primary text-primary")}
              onClick={() => setIsLiked(!isLiked)}
            />
          </Button>
          <Button variant="ghost" size="icon">
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
            >
              <SkipBack className="size-5" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setIsPlaying(!isPlaying)}
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
            <div className="h-1 w-full cursor-pointer rounded-full bg-muted">
              <div
                className="h-1 rounded-full bg-primary"
                style={{
                  width: `${(progress / currentTrack.duration) * 100}%`,
                }}
              ></div>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatTime(currentTrack.duration)}
            </span>
          </div>
        </div>

        {/* Right Section: Other Controls */}
        <div className="flex w-1/4 items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 rounded-sm border border-primary px-2 text-xs font-bold text-primary"
          >
            HIFI
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <Volume2 className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <ListMusic className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-md bg-muted">
            <ChevronUp className="size-5" />
          </Button>
        </div>
      </div>
    </footer>
  );
}
