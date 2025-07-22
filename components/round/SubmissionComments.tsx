"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useConvexAuth } from "convex/react";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toSvg } from "jdenticon";
import React from "react";

interface SubmissionCommentsProps {
  submissionId: Id<"submissions">;
  roundStatus: "voting" | "finished" | "submissions";
}

export function SubmissionComments({
  submissionId,
  roundStatus,
}: SubmissionCommentsProps) {
  const [commentText, setCommentText] = useState("");
  const { isAuthenticated } = useConvexAuth();
  const { actions: playerActions } = useMusicPlayerStore();

  const comments = useQuery(api.submissions.getCommentsForSubmission, {
    submissionId,
  });
  const addComment = useMutation(api.submissions.addComment);
  const currentUser = useQuery(api.users.getCurrentUser);

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    toast.promise(addComment({ submissionId, text: commentText }), {
      loading: "Posting comment...",
      success: () => {
        setCommentText("");
        return "Comment posted!";
      },
      error: (err) => err.data?.message || "Failed to post comment.",
    });
  };

  const parseTimeToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(":").map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    return -1;
  };

  const handleTimestampClick = (time: number) => {
    playerActions.seek(time);
  };

  const renderCommentText = (text: string) => {
    const timestampRegex = /@(\d{1,2}:\d{2})/g;
    const parts = text.split(timestampRegex);

    return (
      <p className="whitespace-pre-wrap text-sm text-foreground">
        {parts.map((part, index) => {
          if (index % 2 === 1) {
            const timeInSeconds = parseTimeToSeconds(part);
            if (timeInSeconds !== -1) {
              return (
                <button
                  key={index}
                  className="mx-1 rounded bg-primary/20 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary transition-colors hover:bg-primary/30"
                  onClick={() => handleTimestampClick(timeInSeconds)}
                >
                  @{part}
                </button>
              );
            }
          }
          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </p>
    );
  };

  const isAnonymous = roundStatus === "voting";

  return (
    <div className="-mx-4 mt-2 space-y-4 rounded-md bg-muted/50 p-4 pt-4">
      {isAuthenticated && (
        <div className="flex items-start gap-3">
          <Avatar className="mt-1 size-8 flex-shrink-0">
            <AvatarImage src={currentUser?.image ?? undefined} />
            <AvatarFallback>
              <div
                dangerouslySetInnerHTML={{
                  __html: toSvg(currentUser?._id ?? "anon", 32),
                }}
              />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="Add your thoughts... use @M:SS to link a time!"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                size="sm"
              >
                Post
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-4">
        {comments === undefined && <Skeleton className="h-16 w-full" />}
        {comments && comments.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Be the first to comment.
          </p>
        )}
        {comments?.map((comment) => (
          <div key={comment._id} className="flex items-start gap-3">
            <Avatar className="size-8 flex-shrink-0">
              <AvatarImage
                src={
                  isAnonymous ? undefined : (comment.authorImage ?? undefined)
                }
              />
              <AvatarFallback>
                <div
                  dangerouslySetInnerHTML={{
                    __html: toSvg(
                      isAnonymous ? comment._id : comment.userId,
                      32,
                    ),
                  }}
                />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">
                  {isAnonymous ? "Anonymous" : comment.authorName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(comment._creationTime, {
                    addSuffix: true,
                  })}
                </span>
              </div>
              {renderCommentText(comment.text)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper function for formatting time
function formatDistanceToNow(timestamp: number, options: { addSuffix: boolean }) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return options.addSuffix ? 'just now' : 'less than a minute';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return options.addSuffix ? `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago` : `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''}`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return options.addSuffix ? `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago` : `${diffInHours} hour${diffInHours !== 1 ? 's' : ''}`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return options.addSuffix ? `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago` : `${diffInDays} day${diffInDays !== 1 ? 's' : ''}`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  return options.addSuffix ? `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago` : `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''}`;
}