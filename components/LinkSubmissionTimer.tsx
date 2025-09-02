"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Play, Pause, ExternalLink } from "lucide-react";
import { FaSpotify, FaYoutube } from "react-icons/fa";
import { toast } from "sonner";

interface LinkSubmissionTimerProps {
  submissionId: Id<"submissions">;
  submissionType: "spotify" | "youtube";
  songLink: string;
  duration: number; // in seconds
  initialProgress?: number; // in seconds
  isCompleted?: boolean;
  listenPercentage?: number; // percentage required (0-100)
}

export function LinkSubmissionTimer({
  submissionId,
  submissionType,
  songLink,
  duration,
  initialProgress = 0,
  isCompleted = false,
  listenPercentage = 80
}: LinkSubmissionTimerProps) {
  const [currentProgress, setCurrentProgress] = useState(initialProgress);
  const [isRunning, setIsRunning] = useState(false);
  const [hasWarned, setHasWarned] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef(0);
  
  const updateProgress = useMutation(api.listenProgress.updateProgress);
  const { actions: playerActions } = useMusicPlayerStore();

  // Calculate required listen time based on league settings
  const requiredProgress = Math.min(duration * (listenPercentage / 100), duration);
  const progressPercentage = (currentProgress / duration) * 100;
  const isTimerCompleted = currentProgress >= requiredProgress || isCompleted;

  useEffect(() => {
    if (isRunning && !isTimerCompleted) {
      intervalRef.current = setInterval(() => {
        setCurrentProgress((prev) => {
          const newProgress = Math.min(prev + 1, duration);
          
          // Update database every 5 seconds to avoid spam
          if (newProgress - lastUpdateRef.current >= 5 || newProgress >= requiredProgress) {
            updateProgress({
              submissionId,
              progressSeconds: newProgress
            }).catch(console.error);
            lastUpdateRef.current = newProgress;
          }
          
          // Update local store when completed
          if (newProgress >= requiredProgress) {
            playerActions.setListenProgress(submissionId, true);
            toast.success("Timer completed! You can now vote on this submission.");
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
  }, [isRunning, isTimerCompleted, submissionId, requiredProgress, duration, updateProgress, playerActions]);

  // Show warning about keeping app open
  useEffect(() => {
    if (isRunning && !hasWarned && !isTimerCompleted) {
      toast.info("Keep this tab open to complete the listening timer!", {
        duration: 5000,
      });
      setHasWarned(true);
    }
  }, [isRunning, hasWarned, isTimerCompleted]);

  const handleStartTimer = () => {
    if (!isTimerCompleted) {
      setIsRunning(true);
      // Open the link in a new tab
      window.open(songLink, '_blank');
    }
  };

  const handlePauseTimer = () => {
    setIsRunning(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const remainingTime = Math.max(0, requiredProgress - currentProgress);

  if (isTimerCompleted) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <div className="flex items-center gap-1">
          {submissionType === 'spotify' ? <FaSpotify className="w-4 h-4" /> : <FaYoutube className="w-4 h-4" />}
          <span>✓ Listening complete</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(songLink, '_blank')}
          className="h-6 px-2"
        >
          <ExternalLink className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-1">
          {submissionType === 'spotify' ? <FaSpotify className="w-4 h-4" /> : <FaYoutube className="w-4 h-4" />}
          <span>Listen Timer</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={isRunning ? handlePauseTimer : handleStartTimer}
          className="h-6 px-2"
        >
          {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(songLink, '_blank')}
          className="h-6 px-2"
        >
          <ExternalLink className="w-3 h-3" />
        </Button>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentProgress)} / {formatTime(requiredProgress)}</span>
          <span>{remainingTime > 0 ? `${formatTime(remainingTime)} remaining` : 'Complete!'}</span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>
      
      {isRunning && (
        <p className="text-xs text-amber-600">
          Keep this tab open to complete the timer!
        </p>
      )}
    </div>
  );
}