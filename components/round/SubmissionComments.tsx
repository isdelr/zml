"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/lib/convex/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toSvg } from "jdenticon";
import React from "react";
import { toErrorMessage } from "@/lib/errors";
import { useWindowSize } from "@/hooks/useWindowSize";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

interface SubmissionCommentsProps {
  submissionId: Id<"submissions">;
  submissionTitle: string;
  className?: string;
}

export function SubmissionComments({
  submissionId,
  submissionTitle,
  className,
}: SubmissionCommentsProps) {
  const [commentText, setCommentText] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const { isAuthenticated } = useConvexAuth();
  const playerActions = useMusicPlayerStore((state) => state.actions);
  const { width } = useWindowSize();
  const isMobile = width > 0 ? width < 768 : false;

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
      authorImage: currentUser.image ?? null,
    } as Doc<"comments"> & { authorName: string; authorImage: string | null };

    const newComments = [...existingComments, optimisticComment];
    localStore.setQuery(
      api.submissions.getCommentsForSubmission,
      { submissionId },
      newComments,
    );
  });

  const handleAddComment = async () => {
    const textToSubmit = commentText.trim();
    if (!textToSubmit) return;
    setCommentText("");
    try {
      await addComment({ submissionId, text: textToSubmit });
      setIsComposerOpen(false);
    } catch (error: unknown) {
      toast.error(toErrorMessage(error, "Failed to post comment."));
      setCommentText(textToSubmit);
    }
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

  const renderCommentText = (text: string, compact = false) => {
    if (compact) {
      return (
        <p className="truncate text-sm text-foreground/80">
          {text}
        </p>
      );
    }

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

  const orderedComments = useMemo(() => {
    if (!comments) return [];
    return [...comments].reverse();
  }, [comments]);
  const hiddenCommentCount = Math.max(0, orderedComments.length - 3);
  const visibleComments = useMemo(() => {
    if (showAllComments) return orderedComments;
    return orderedComments.slice(0, 3);
  }, [orderedComments, showAllComments]);

  const composerBody = (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Avatar className="mt-0.5 size-8 flex-shrink-0">
          <AvatarImage src={currentUser?.image ?? undefined} />
          <AvatarFallback>
            <div
              dangerouslySetInnerHTML={{
                __html: toSvg(currentUser?._id ?? "anon", 32),
              }}
            />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-3">
          <Textarea
            placeholder="Add your thoughts... use @M:SS to link a time."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={4}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleAddComment();
              }
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Press Ctrl/Cmd + Enter to post quickly.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsComposerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleAddComment()}
                disabled={!commentText.trim()}
              >
                Post comment
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const composerTrigger = isAuthenticated ? (
    isMobile ? (
      <Sheet open={isComposerOpen} onOpenChange={setIsComposerOpen}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-3 text-xs sm:text-sm"
          onClick={() => setIsComposerOpen(true)}
        >
          Add comment
        </Button>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] rounded-t-3xl px-0 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-0"
        >
          <SheetHeader className="border-b px-4 py-4 text-left">
            <SheetTitle className="text-base">Comment on {submissionTitle}</SheetTitle>
            <SheetDescription>
              Keep it short. The latest comments stay visible right under the track.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4 py-4">{composerBody}</div>
        </SheetContent>
      </Sheet>
    ) : (
      <Popover open={isComposerOpen} onOpenChange={setIsComposerOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-xs sm:text-sm"
          >
            Add comment
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[min(28rem,calc(100vw-2rem))] rounded-2xl border-border/70 p-4"
        >
          <div className="mb-3">
            <p className="text-sm font-semibold text-foreground">
              Comment on {submissionTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              Share a quick reaction without leaving the song list.
            </p>
          </div>
          {composerBody}
        </PopoverContent>
      </Popover>
    )
  ) : null;

  return (
    <div
      className={cn(
        "border-t border-border/60 bg-muted/25 px-3 py-3 md:px-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Comments
        </span>
        {composerTrigger}
      </div>

      <div className="mt-3 space-y-2">
        {comments === undefined ? (
          <>
            <div className="h-10 animate-pulse rounded-xl bg-background/70" />
            <div className="h-10 animate-pulse rounded-xl bg-background/50" />
          </>
        ) : visibleComments.length > 0 ? (
          visibleComments.map((comment) => (
            <div
              key={comment._id}
              className="flex items-start gap-2 py-1.5"
            >
              <Avatar className="size-7 flex-shrink-0">
                <AvatarImage src={comment.authorImage ?? undefined} />
                <AvatarFallback>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: toSvg(comment.userId, 28),
                    }}
                  />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "min-w-0 gap-2 text-left text-sm",
                    showAllComments
                      ? "flex flex-col items-start"
                      : "flex items-start",
                  )}
                >
                  <span className="shrink-0 font-medium text-foreground">
                    {comment.authorName}
                  </span>
                  <div className="min-w-0 flex-1">
                    {renderCommentText(comment.text, !showAllComments)}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-1 text-sm text-muted-foreground">
            No comments yet.
          </div>
        )}
      </div>

      {hiddenCommentCount > 0 || showAllComments ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-7 rounded-full px-2 text-xs text-muted-foreground"
          onClick={() => setShowAllComments((current) => !current)}
        >
          {showAllComments ? (
            <>
              <ChevronUp className="size-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="size-4" />
              View {hiddenCommentCount} older comment
              {hiddenCommentCount === 1 ? "" : "s"}
            </>
          )}
        </Button>
      ) : null}

      {!isAuthenticated ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Sign in to join the conversation.
        </p>
      ) : null}
    </div>
  );
}
