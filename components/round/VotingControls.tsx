"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Clock, Check } from "lucide-react";

interface VotingControlsProps {
  submissionId: Id<"submissions">;
  onVote: (vote: number) => void;
  userVote?: number;
  disabled?: boolean;
}

export function VotingControls({ 
  submissionId, 
  onVote, 
  userVote, 
  disabled 
}: VotingControlsProps) {
  const listeningProgress = useQuery(api.listeningProgress.getListeningProgress, {
    submissionId,
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const canVote = !listeningProgress || listeningProgress.meetsRequirement;

  return (
    <div className="space-y-3">
      {listeningProgress && listeningProgress.requiredTime > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {listeningProgress.meetsRequirement ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">
                Listening Progress
              </span>
            </div>
            <span className="text-xs">
              {formatTime(listeningProgress.totalListenedTime)} / {formatTime(listeningProgress.requiredTime)}
            </span>
          </div>
          <Progress 
            value={listeningProgress.progressPercentage} 
            className="h-2"
          />
          {!listeningProgress.meetsRequirement && (
            <p className="text-xs text-muted-foreground">
              You need to listen to more of this song before voting
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant={userVote === 1 ? "default" : "outline"}
          size="sm"
          onClick={() => onVote(1)}
          disabled={disabled || !canVote}
          title={!canVote ? "Complete listening requirement first" : "Upvote"}
        >
          👍 {userVote === 1 ? "Voted" : "Upvote"}
        </Button>
        <Button
          variant={userVote === -1 ? "destructive" : "outline"}
          size="sm"
          onClick={() => onVote(-1)}
          disabled={disabled || !canVote}
          title={!canVote ? "Complete listening requirement first" : "Downvote"}
        >
          👎 {userVote === -1 ? "Voted" : "Downvote"}
        </Button>
      </div>
    </div>
  );
}
