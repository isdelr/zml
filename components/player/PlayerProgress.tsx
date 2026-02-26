"use client";

import { useMemo } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Waveform, WaveformComment } from "@/components/Waveform";
import WaveformData from "waveform-data";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import type { LeagueData } from "@/lib/convex/types";
import type { Song } from "@/types";

interface PlayerProgressProps {
  isExternalLink: boolean;
  isWaveformLoading: boolean;
  waveformData: WaveformData | null;
  currentTrack: Song | null;
  leagueData: LeagueData | undefined;
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
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // No per-link timer for YouTube; handled by round-level playlist timer.
  const showListenRequirement = leagueData?.enforceListenPercentage && currentTrack?.submissionType === 'file' && duration > 0;

  const savedProgressPercent = useMemo(() => {
    if (!listenProgress || !duration) return 0;
    return Math.min((listenProgress.progressSeconds / duration) * 100, 100);
  }, [listenProgress, duration]);

  const { requirementLinePercent, requiredListenTimeFormatted } = useMemo(() => {
    if (!showListenRequirement || !duration) {
      return { requirementLinePercent: 0, requiredListenTimeFormatted: "0:00" };
    }

    const listenPercentage = leagueData.listenPercentage ?? 100;
    const requiredTimeFromPercentage = duration * (listenPercentage / 100);
    const timeLimitInSeconds = (leagueData.listenTimeLimitMinutes ?? Infinity) * 60;

    const actualRequiredListenTime = Math.min(requiredTimeFromPercentage, timeLimitInSeconds);
    const percent = (actualRequiredListenTime / duration) * 100;
    
    return {
      requirementLinePercent: percent,
      requiredListenTimeFormatted: formatTime(actualRequiredListenTime)
    };
  }, [showListenRequirement, duration, leagueData]);


  return (
    <div className="flex w-full max-w-xl items-center gap-2">
      <span className="w-10 text-right text-xs text-muted-foreground select-none">
        {isExternalLink ? "--:--" : formatTime(progress)}
      </span>
      <div className="relative flex-1 h-8 flex items-center group transition-transform duration-50">
        {isExternalLink ? (
          <div className="flex h-full w-full items-center justify-center rounded-md bg-muted px-2 text-center text-xs text-muted-foreground">
            Playing on YouTube. Open the link with the Play button to track listening, then use controls here to continue.
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
              savedProgress={listenProgress?.progressSeconds}
              comments={comments}
            />
            {showListenRequirement && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="absolute top-0 h-full w-[1.5px] bg-primary opacity-70 transition-opacity group-hover:opacity-100"
                      style={{ left: `${requirementLinePercent}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Listen Requirement: {requiredListenTimeFormatted} ({leagueData.listenPercentage ?? 100}%)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
              onValueChange={(value) => {
                const nextValue = Array.isArray(value) ? value[0] : value;
                if (nextValue === undefined) return;
                onSeek(nextValue);
              }}
              className={cn(
                showListenRequirement && "[&>[data-slot=slider-track]]:bg-transparent"
              )}
            />
            {showListenRequirement && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="pointer-events-none absolute top-1/2 h-2.5 w-[1.5px] -translate-y-1/2 bg-primary opacity-70 transition-opacity group-hover:opacity-100"
                      style={{ left: `${requirementLinePercent}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Listen Requirement: {requiredListenTimeFormatted} ({leagueData.listenPercentage ?? 100}%)</p>
                  </TooltipContent>
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
