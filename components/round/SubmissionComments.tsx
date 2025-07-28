"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useConvexAuth } from "convex/react";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toSvg } from "jdenticon";
import React from "react";
import { formatDistanceToNow } from "date-fns";

interface SubmissionCommentsProps {
  submissionId: Id<"submissions">;
  roundStatus: "voting" | "finished" | "submissions";
}

export function SubmissionComments({
  submissionId,
}: SubmissionCommentsProps) {
  const [commentText, setCommentText] = useState("");
  const { isAuthenticated } = useConvexAuth();
  const playerActions = useMusicPlayerStore((state) => state.actions);

  const comments = useQuery(api.submissions.getCommentsForSubmission, {
    submissionId,
  });
  const currentUser = useQuery(api.users.getCurrentUser);

  const addComment = useMutation(api.submissions.addComment).withOptimisticUpdate(
    (localStore, { submissionId, text }) => {
      // We need currentUser data to create an optimistic comment.
      // This is a great example of where `useQuery` inside a component shines.
      if (!currentUser) return;

      const existingComments = localStore.getQuery(api.submissions.getCommentsForSubmission, { submissionId });
      if (existingComments === undefined) return;

      const optimisticComment: Doc<"comments"> & { authorName: string, authorImage: string | null } = {
        _id: `optimistic_${Date.now()}` as Id<"comments">,
        _creationTime: Date.now(),
        submissionId,
        userId: currentUser._id,
        text,
        authorName: currentUser.name ?? "You",
        authorImage: currentUser.image ?? null,
      };

      const newComments = [...existingComments, optimisticComment];

      localStore.setQuery(api.submissions.getCommentsForSubmission, { submissionId }, newComments);
    }
  );

  const handleAddComment = () => {
    if (!commentText.trim()) return;

    const textToSubmit = commentText;
    setCommentText(""); // Optimistically clear the input

    addComment({ submissionId, text: textToSubmit })
      .catch((err) => {
        toast.error(err.data?.message || "Failed to post comment.");
        setCommentText(textToSubmit); // Revert input on error
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
      <p className="whitespace-pre-wrap text-sm text-foreground break-words">
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
          <div className="flex-1 min-w-0 space-y-2">
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
              <AvatarImage src={comment.authorImage ?? undefined} />
              <AvatarFallback>
                <div
                  dangerouslySetInnerHTML={{
                    __html: toSvg(comment.userId, 32),
                  }}
                />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">{comment.authorName}</span>
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