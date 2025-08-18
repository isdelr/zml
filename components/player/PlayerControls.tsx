"use client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { FaSpotify, FaYoutube } from "react-icons/fa";
import { Song } from "@/types";

interface PlayerControlsProps {
  isPlaying: boolean;
  isExternalLink: boolean;
  isShuffled: boolean;
  repeatMode: "none" | "all" | "one";
  currentTrack: Song;
  onTogglePlayPause: () => void;
  onPlayNext: () => void;
  onPlayPrevious: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
}

export function PlayerControls({
                                 isPlaying,
                                 isExternalLink,
                                 isShuffled,
                                 repeatMode,
                                 currentTrack,
                                 onTogglePlayPause,
                                 onPlayNext,
                                 onPlayPrevious,
                                 onToggleShuffle,
                                 onToggleRepeat,
                               }: PlayerControlsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "size-8 text-muted-foreground hover:text-foreground",
          isShuffled && "text-primary",
        )}
        onClick={onToggleShuffle}
        title="Shuffle"
      >
        <Shuffle className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-foreground"
        onClick={onPlayPrevious}
        title="Previous"
      >
        <SkipBack className="size-4" />
      </Button>
      <Button
        variant="default"
        size="icon"
        className="size-10 rounded-full"
        onClick={() => {
          if (isExternalLink) {
            window.open(currentTrack.songLink, "_blank", "noopener,noreferrer");
          } else {
            onTogglePlayPause();
          }
        }}
        title={isExternalLink ? "Open Link" : isPlaying ? "Pause" : "Play"}
      >
        {isExternalLink ? (
          currentTrack.submissionType === "spotify" ? (
            <FaSpotify className="size-5 text-white" />
          ) : (
            <FaYoutube className="size-5 text-white" />
          )
        ) : isPlaying ? (
          <Pause className="size-5 fill-primary-foreground" />
        ) : (
          <Play className="size-5 fill-primary-foreground" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-foreground"
        onClick={onPlayNext}
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
        onClick={onToggleRepeat}
        title={`Repeat: ${repeatMode}`}
      >
        {repeatMode === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
      </Button>
    </div>
  );
}