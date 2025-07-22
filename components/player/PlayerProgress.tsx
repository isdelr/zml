"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Waveform, WaveformComment } from "@/components/Waveform";
import WaveformData from "waveform-data";

interface PlayerProgressProps {
  isExternalLink: boolean;
  isWaveformLoading: boolean;
  waveformData: WaveformData | null;
  currentTrack: { submissionType?: "spotify" | "youtube" | "file" } | null;
  progress: number;
  duration: number;
  comments: WaveformComment[];
  onSeek: (time: number) => void;
}

export function PlayerProgress({
  isExternalLink,
  isWaveformLoading,
  waveformData,
  currentTrack,
  progress,
  duration,
  comments,
  onSeek,
}: PlayerProgressProps) {
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex w-full max-w-xl items-center gap-2">
      <span className="w-10 text-right text-xs text-muted-foreground select-none">
        {isExternalLink ? "--:--" : formatTime(progress)}
      </span>
      <div className="relative flex-1 h-8 flex items-center transition-transform duration-50">
        {isExternalLink ? (
          <div className="flex h-full w-full items-center justify-center rounded-md bg-muted px-2 text-center text-xs text-muted-foreground">
            Playing on{" "}
            {currentTrack?.submissionType === "spotify" ? "Spotify" : "YouTube"}
            . Use controls to continue.
          </div>
        ) : isWaveformLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : waveformData ? (
          <Waveform
            waveform={waveformData}
            progress={progress}
            duration={duration}
            onSeek={onSeek}
            className="h-8"
            comments={comments}
          />
        ) : (
          <Slider
            value={[progress]}
            max={duration || 1}
            step={1}
            onValueChange={(value) =>
              onSeek(Array.isArray(value) ? value[0] : value)
            }
          />
        )}
      </div>
      <span className="w-10 text-left text-xs text-muted-foreground select-none">
        {isExternalLink ? "--:--" : formatTime(duration)}
      </span>
    </div>
  );
}
