"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useConvexAuth } from "convex/react";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toSvg } from "jdenticon";
import React from "react";
import { formatDistanceToNow } from "date-fns";
import { toErrorMessage } from "@/lib/errors";

interface SubmissionCommentsProps {
  submissionId: Id<"submissions">;
  roundStatus: "voting" | "finished" | "submissions";
}

export function SubmissionComments({ submissionId }: SubmissionCommentsProps) {
  const [commentText, setCommentText] = useState("");
  const { isAuthenticated } = useConvexAuth();
  const playerActions = useMusicPlayerStore((state) => state.actions);

  const comments = useQuery(api.submissions.getCommentsForSubmission, {
    submissionId,
  });
  const currentUser = useQuery(api.users.getCurrentUser);

  const addComment = useMutation(
    api.submissions.addComment,
  ).withOptimisticUpdate((localStore, { submissionId, text }) => {
    if (!currentUser) return;
    const existingComments = localStore.getQuery(
      api.submissions.getCommentsForSubmission,
      {
        submissionId,
      },
    );
    if (existingComments === undefined) return;
    const optimisticCommentId =
      `optimistic_${submissionId}_${existingComments.length}` as unknown as Id<"comments">;
    const optimisticCreationTime = existingComments.length;

    const optimisticComment = {
      _id: optimisticCommentId,
      _creationTime: optimisticCreationTime,
      submissionId,
      userId: currentUser._id,
      text,
      authorName: currentUser.name ?? "You",
      authorImage: currentUser.image ?? currentUser.providerImageUrl ?? null,
    } as Doc<"comments"> & { authorName: string; authorImage: string | null };

    const newComments = [...existingComments, optimisticComment];
    localStore.setQuery(
      api.submissions.getCommentsForSubmission,
      { submissionId },
      newComments,
    );
  });

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    const textToSubmit = commentText;
    setCommentText("");
    addComment({ submissionId, text: textToSubmit }).catch((error: unknown) => {
      toast.error(toErrorMessage(error, "Failed to post comment."));
      setCommentText(textToSubmit);
    });
  };

  const parseTimeToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(":").map(Number);
    const minutes = parts[0];
    const seconds = parts[1];
    if (
      parts.length === 2 &&
      minutes !== undefined &&
      seconds !== undefined &&
      !isNaN(minutes) &&
      !isNaN(seconds)
    ) {
      return minutes * 60 + seconds;
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
    <div className="space-y-6">
      {isAuthenticated && (
        <div className="flex items-start gap-3">
          <Avatar className="mt-1 size-8 flex-shrink-0">
            <AvatarImage
              src={
                currentUser?.image ?? currentUser?.providerImageUrl ?? undefined
              }
            />
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
