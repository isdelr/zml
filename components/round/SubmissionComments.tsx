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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toSvg } from "jdenticon";
import React from "react";
import { toErrorMessage } from "@/lib/errors";
import { useWindowSize } from "@/hooks/useWindowSize";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, MessageSquarePlus } from "lucide-react";
import { getAnonymousCommentIdentity } from "@/lib/comments/anonymous";
import { shouldRevealCommentContent } from "@/lib/comments/visibility";

interface SubmissionCommentsProps {
  submissionId: Id<"submissions">;
  expandAllByDefault?: boolean;
  className?: string;
}

interface SubmissionCommentComposerButtonProps {
  submissionId: Id<"submissions">;
  roundId: Id<"rounds">;
  roundStatus: Doc<"rounds">["status"];
  submissionTitle: string;
  className?: string;
  size?: "icon" | "sm";
}

type SubmissionComment = {
  _id: Id<"comments">;
  _creationTime: number;
  submissionId: Id<"submissions">;
  text: string;
  authorName: string;
  authorImage: string | null;
  authorVote: number | undefined;
  avatarSeed: string;
};

export function SubmissionCommentComposerButton({
  submissionId,
  roundId,
  roundStatus,
  submissionTitle,
  className,
  size = "icon",
}: SubmissionCommentComposerButtonProps) {
  const [commentText, setCommentText] = useState("");
  const [revealContentOnRoundFinished, setRevealContentOnRoundFinished] =
    useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const { isAuthenticated } = useConvexAuth();
  const { width } = useWindowSize();
  const isMobile = width > 0 ? width < 768 : false;

  const currentUser = useQuery(api.users.getCurrentUser);
  const anonymousIdentity = useMemo(
    () =>
      getAnonymousCommentIdentity(
        roundId,
        currentUser?._id ?? "pending-anonymous-user",
      ),
    [currentUser?._id, roundId],
  );
  const showCommentImmediately = shouldRevealCommentContent({
    revealContentOnRoundFinished,
    roundStatus,
  });
  const revealIdentityInComposer =
    roundStatus === "finished" || revealContentOnRoundFinished;
  const composerVisibilityDescription =
    roundStatus === "finished"
      ? "The round is finished, so your name and comment show immediately."
      : revealContentOnRoundFinished
        ? "Your comment stays hidden until voting ends, then appears under your profile."
        : "Your comment appears immediately, but your name stays anonymous until the round finishes.";
  const composerIdentity = revealIdentityInComposer
    ? {
        avatarSeed: currentUser?._id ?? "pending-user",
        displayName: currentUser?.name ?? "Anonymous",
        image: currentUser?.image ?? null,
      }
    : {
        avatarSeed: anonymousIdentity.avatarSeed,
        displayName: anonymousIdentity.displayName,
        image: null,
      };

  const addComment = useMutation(
    api.submissions.addComment,
  ).withOptimisticUpdate(
    (localStore, { submissionId, text, revealContentOnRoundFinished }) => {
      if (
        !shouldRevealCommentContent({
          revealContentOnRoundFinished,
          roundStatus,
        })
      ) {
        return;
      }

      const existingComments = localStore.getQuery(
        api.submissions.getCommentsForSubmission,
        {
          submissionId,
        },
      );
      if (existingComments === undefined) return;

      const optimisticCommentId =
        `optimistic_${submissionId}_${existingComments.length}` as unknown as Id<"comments">;
      const optimisticCreationTime =
        existingComments.reduce(
          (latestCreationTime, comment) =>
            Math.max(latestCreationTime, comment._creationTime),
          0,
        ) + 1;

      const optimisticComment = {
        _id: optimisticCommentId,
        _creationTime: optimisticCreationTime,
        submissionId,
        text,
        authorName: revealIdentityInComposer
          ? (currentUser?.name ?? "Anonymous")
          : anonymousIdentity.displayName,
        authorImage: revealIdentityInComposer
          ? (currentUser?.image ?? null)
          : null,
        authorVote: undefined,
        avatarSeed: revealIdentityInComposer
          ? (currentUser?._id ?? "pending-user")
          : anonymousIdentity.avatarSeed,
      } as SubmissionComment;

      const newComments = [...existingComments, optimisticComment];
      localStore.setQuery(
        api.submissions.getCommentsForSubmission,
        { submissionId },
        newComments,
      );
    },
  );

  const handleAddComment = async () => {
    const textToSubmit = commentText.trim();
    if (!textToSubmit) return;
    setCommentText("");
    try {
      await addComment({
        submissionId,
        text: textToSubmit,
        revealContentOnRoundFinished:
          revealContentOnRoundFinished || undefined,
      });
      setRevealContentOnRoundFinished(false);
      setIsComposerOpen(false);
    } catch (error: unknown) {
      toast.error(toErrorMessage(error, "Failed to post comment."));
      setCommentText(textToSubmit);
    }
  };

  const composerBody = (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Avatar className="mt-0.5 size-8 flex-shrink-0">
          <AvatarImage src={composerIdentity.image ?? undefined} />
          <AvatarFallback>
            <div
              dangerouslySetInnerHTML={{
                __html: toSvg(composerIdentity.avatarSeed, 32),
              }}
            />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Posting as {composerIdentity.displayName}
            </p>
            <p className="text-xs text-muted-foreground">
              {composerVisibilityDescription}
            </p>
          </div>
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
          {roundStatus !== "finished" ? (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-muted/35 p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Show only after voting ends
                </p>
                <p className="text-xs text-muted-foreground">
                  Useful for bigger or self-identifying thoughts. The
                  submission owner gets notified when it unlocks.
                </p>
              </div>
              <Switch
                checked={revealContentOnRoundFinished}
                onCheckedChange={setRevealContentOnRoundFinished}
                aria-label="Show comment only after voting ends"
              />
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {showCommentImmediately
                ? "Press Ctrl/Cmd + Enter to post quickly."
                : "Press Ctrl/Cmd + Enter to queue it for the end of voting."}
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
                {showCommentImmediately ? "Post comment" : "Post for later"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!isAuthenticated) {
    return null;
  }

  const triggerButton = (
    <Button
      type="button"
      variant="ghost"
      size={size}
      className={className}
      aria-label="Add comment"
      title="Add comment"
    >
      <MessageSquarePlus className="size-5" />
    </Button>
  );

  return isMobile ? (
    <Sheet open={isComposerOpen} onOpenChange={setIsComposerOpen}>
      <Button
        type="button"
        variant="ghost"
        size={size}
        className={className}
        aria-label="Add comment"
        title="Add comment"
        onClick={() => setIsComposerOpen(true)}
      >
        <MessageSquarePlus className="size-5" />
      </Button>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] rounded-t-3xl px-0 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-0"
      >
        <SheetHeader className="border-b px-4 py-4 text-left">
          <SheetTitle className="text-base">
            Comment on {submissionTitle}
          </SheetTitle>
          <SheetDescription>
            {composerVisibilityDescription}
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-4 py-4">{composerBody}</div>
      </SheetContent>
    </Sheet>
  ) : (
    <Popover open={isComposerOpen} onOpenChange={setIsComposerOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(28rem,calc(100vw-2rem))] rounded-2xl border-border/70 p-4"
      >
        <div className="mb-3">
          <p className="text-sm font-semibold text-foreground">
            Comment on {submissionTitle}
          </p>
        </div>
        {composerBody}
      </PopoverContent>
    </Popover>
  );
}

export function SubmissionComments({
  submissionId,
  expandAllByDefault = false,
  className,
}: SubmissionCommentsProps) {
  const [showAllComments, setShowAllComments] = useState(expandAllByDefault);
  const playerActions = useMusicPlayerStore((state) => state.actions);
  const comments = useQuery(api.submissions.getCommentsForSubmission, {
    submissionId,
  });

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
      return <p className="truncate text-sm text-foreground/80">{text}</p>;
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
    return [...comments].sort(
      (first, second) => second._creationTime - first._creationTime,
    );
  }, [comments]);
  const hiddenCommentCount = Math.max(0, orderedComments.length - 3);
  const visibleComments = useMemo(() => {
    if (showAllComments) return orderedComments;
    return orderedComments.slice(0, 3);
  }, [orderedComments, showAllComments]);

  const formatAuthorVote = (vote: number) =>
    vote > 0 ? `+${vote}` : `${vote}`;

  if (orderedComments.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "border-t border-border/60 bg-muted/25 px-3 py-3 md:px-4",
        className,
      )}
    >
      <div className="space-y-2">
        {comments === undefined ? (
          <>
            <div className="h-10 animate-pulse rounded-xl bg-background/70" />
            <div className="h-10 animate-pulse rounded-xl bg-background/50" />
          </>
        ) : visibleComments.length > 0 ? (
          visibleComments.map((comment) => (
            <div key={comment._id} className="flex items-start gap-2 py-1.5">
              <Avatar className="size-7 flex-shrink-0">
                <AvatarImage src={comment.authorImage ?? undefined} />
                <AvatarFallback>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: toSvg(comment.avatarSeed, 28),
                    }}
                  />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-start gap-2 text-left text-sm">
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="font-medium text-foreground">
                      {comment.authorName}
                    </span>
                    {typeof comment.authorVote === "number" ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          comment.authorVote > 0
                            ? "bg-success/10 text-success"
                            : comment.authorVote < 0
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {formatAuthorVote(comment.authorVote)}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    {renderCommentText(comment.text, !showAllComments)}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : null}
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
    </div>
  );
}
