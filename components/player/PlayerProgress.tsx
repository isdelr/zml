"use client";

import { useMemo } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Waveform, WaveformComment } from "@/components/Waveform";
import WaveformData from "waveform-data";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

interface PlayerProgressProps {
  isExternalLink: boolean;
  isWaveformLoading: boolean;
  waveformData: WaveformData | null;
  currentTrack: { submissionType?: "spotify" | "youtube" | "file"; leagueId?: string; } | null;
  leagueData: Awaited<ReturnType<typeof api.leagues.get>>;
  listenProgress: Doc<"listenProgress"> | undefined;
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
  leagueData,
  listenProgress,
}: PlayerProgressProps) {
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const showListenRequirement = leagueData?.enforceListenPercentage && currentTrack?.submissionType === 'file' && duration > 0;

  const savedProgressPercent = useMemo(() => {
    if (!listenProgress || !duration) return 0;
    return Math.min((listenProgress.progressSeconds / duration) * 100, 100);
  }, [listenProgress, duration]);

  return (
    <div className="flex w-full max-w-xl items-center gap-2">
      <span className="w-10 text-right text-xs text-muted-foreground select-none">
        {isExternalLink ? "--:--" : formatTime(progress)}
      </span>
      <div className="relative flex-1 h-8 flex items-center group transition-transform duration-50">
        {isExternalLink ? (
          <div className="flex h-full w-full items-center justify-center rounded-md bg-muted px-2 text-center text-xs text-muted-foreground">
            Playing on{" "}
            {currentTrack?.submissionType === "spotify" ? "Spotify" : "YouTube"}
            . Use controls to continue.
          </div>
        ) : isWaveformLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : waveformData ? (
          <>
            <Waveform
              waveform={waveformData}
              progress={progress}
              duration={duration}
              onSeek={onSeek}
              className="h-8"
              comments={comments}
            />
            {showListenRequirement && (
              <div
                className="absolute top-0 h-full w-0.5 bg-foreground/50 opacity-50 transition-opacity group-hover:opacity-100"
                style={{ left: `${leagueData.listenPercentage}%` }}
                title={`Listen requirement: ${leagueData.listenPercentage}%`}
              />
            )}
          </>
        ) : (
          <div className="relative flex w-full items-center">
            {showListenRequirement && (
              <div className="pointer-events-none absolute h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary/30"
                  style={{ width: `${savedProgressPercent}%` }}
                />
              </div>
            )}
            <Slider
              value={[progress]}
              max={duration || 1}
              step={1}
              onValueChange={(value) =>
                onSeek(Array.isArray(value) ? value[0] : value)
              }
              className={cn(
                showListenRequirement && "[&>[data-slot=slider-track]]:bg-transparent"
              )}
            />
            {showListenRequirement && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="pointer-events-none absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 bg-foreground/50 opacity-50 transition-opacity group-hover:opacity-100"
                      style={{ left: `${leagueData.listenPercentage}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent><p>Listen Requirement: {leagueData.listenPercentage}%</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </div>
      <span className="w-10 text-left text-xs text-muted-foreground select-none">
        {isExternalLink ? "--:--" : formatTime(duration)}
      </span>
    </div>
  );
}