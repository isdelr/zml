"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Waveform, WaveformComment } from "@/components/Waveform";
import WaveformData from "waveform-data";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { useMutation } from "convex/react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";

interface PlayerProgressProps {
  isExternalLink: boolean;
  isWaveformLoading: boolean;
  waveformData: WaveformData | null;
  currentTrack: { 
    submissionType?: "youtube" | "file";
    leagueId?: string; 
    _id?: string; 
    duration?: number;
  } | null;
  leagueData: Awaited<ReturnType<typeof api.leagues.get>>;
  listenProgress: Doc<"listenProgress"> | undefined;
  progress: number;
  duration: number;
  comments: WaveformComment[];
  onSeek: (time: number) => void;
  isTimerRunning?: boolean;
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
  isTimerRunning = false,
}: PlayerProgressProps) {
  // Timer state for external link submissions
  const [timerProgress, setTimerProgress] = useState(listenProgress?.progressSeconds || 0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef(0);
  const updateProgress = useMutation(api.listenProgress.updateProgress);
  const { actions } = useMusicPlayerStore();

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Timer logic for external link submissions
  const isLinkSubmission = isExternalLink && ( currentTrack?.submissionType === "youtube");
  const linkDuration = currentTrack?.duration || duration || 180; // fallback to 3 minutes
  // Align client-side requirement with server logic (convex/listenProgress.ts)
  const percentageRaw = leagueData?.listenPercentage;
  const percentage = percentageRaw !== undefined ? Math.max(0, Math.min(100, percentageRaw)) : 100;
  const timeLimitSeconds = leagueData?.listenTimeLimitMinutes !== undefined
    ? Math.max(0, leagueData.listenTimeLimitMinutes * 60)
    : Infinity;
  const requiredTimerProgress = Math.min(linkDuration * (percentage / 100), timeLimitSeconds);
  const isTimerCompleted = timerProgress >= requiredTimerProgress || listenProgress?.isCompleted;

  // Timer countdown effect
  useEffect(() => {
    if (isLinkSubmission && isTimerRunning && !isTimerCompleted) {
      intervalRef.current = setInterval(() => {
        setTimerProgress((prev) => {
          const newProgress = Math.min(prev + 1, linkDuration);
          
          // Update database every 5 seconds to avoid spam
          if (currentTrack?._id && (newProgress - lastUpdateRef.current >= 5 || newProgress >= requiredTimerProgress)) {
            updateProgress({
              submissionId: currentTrack._id as Id<"submissions">,
              progressSeconds: newProgress
            }).catch(console.error);
            lastUpdateRef.current = newProgress;
          }
          
          // Show completion toast and mark as completed locally
          if (newProgress >= requiredTimerProgress && currentTrack?._id) {
            toast.success("Timer completed! You can now vote on this submission.");
            actions.setListenProgress(currentTrack._id, true);
          }
          
          return newProgress;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isLinkSubmission, isTimerRunning, isTimerCompleted, currentTrack?._id, requiredTimerProgress, linkDuration, updateProgress, actions]);

  // Update timer progress when listenProgress prop changes
  useEffect(() => {
    if (listenProgress?.progressSeconds !== undefined) {
      setTimerProgress(listenProgress.progressSeconds);
    }
  }, [listenProgress?.progressSeconds]);

  const showListenRequirement = leagueData?.enforceListenPercentage && currentTrack?.submissionType === 'file' && duration > 0;

  const savedProgressPercent = useMemo(() => {
    if (!listenProgress || !duration) return 0;
    return Math.min((listenProgress.progressSeconds / duration) * 100, 100);
  }, [listenProgress, duration]);

  const { requirementLinePercent, requiredListenTimeFormatted } = useMemo(() => {
    if (!showListenRequirement || !duration) {
      return { requirementLinePercent: 0, requiredListenTimeFormatted: "0:00" };
    }

    const requiredTimeFromPercentage = duration * (leagueData.listenPercentage! / 100);
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
        {isLinkSubmission ? formatTime(timerProgress) : isExternalLink ? "--:--" : formatTime(progress)}
      </span>
      <div className="relative flex-1 h-8 flex items-center group transition-transform duration-50">
        {isLinkSubmission ? (
          <div className="flex flex-col w-full gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Youtube Timer
                {isTimerCompleted && " ✓"}
              </span>
              <span className="text-muted-foreground">
                {isTimerCompleted ? "Complete!" : `${formatTime(Math.max(0, requiredTimerProgress - timerProgress))} remaining`}
              </span>
            </div>
            <div className="relative">
              <Progress 
                value={(timerProgress / linkDuration) * 100} 
                className="h-2"
              />
              {leagueData?.enforceListenPercentage && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute top-0 h-full w-[1.5px] bg-primary opacity-70 transition-opacity group-hover:opacity-100"
                        style={{ left: `${(requiredTimerProgress / linkDuration) * 100}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
4                      <p>Listen Requirement: {formatTime(requiredTimerProgress)} ({percentage}%)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        ) : isExternalLink ? (
          <div className="flex h-full w-full items-center justify-center rounded-md bg-muted px-2 text-center text-xs text-muted-foreground">
            Playing on{" "}
            Youtube
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
                    <p>Listen Requirement: {requiredListenTimeFormatted} ({leagueData.listenPercentage}%)</p>
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
                      className="pointer-events-none absolute top-1/2 h-2.5 w-[1.5px] -translate-y-1/2 bg-primary opacity-70 transition-opacity group-hover:opacity-100"
                      style={{ left: `${requirementLinePercent}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Listen Requirement: {requiredListenTimeFormatted} ({leagueData.listenPercentage}%)</p>
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