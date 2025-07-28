"use client";

import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  MessageSquare,
  Play,
  Pause,
  Ban,
} from "lucide-react";
import { FaSpotify, FaYoutube } from "react-icons/fa";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toSvg } from "jdenticon";
import { SubmissionComments } from "./SubmissionComments";
import { Id } from "@/convex/_generated/dataModel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface SubmissionItemProps {
  song: unknown;
  index: number;
  isThisSongPlaying: boolean;
  isThisSongCurrent: boolean;
  isLinkSubmission: boolean;
  isCommentsVisible: boolean;
  userIsSubmitter: boolean;
  currentVoteState: "up" | "down" | "none";
  roundStatus: "voting" | "finished" | "submissions";
  onToggleComments: () => void;
  hasVoted: boolean;
  canVote: boolean;
  onVoteClick: (voteType: "up" | "down" | "none") => void;
  onBookmark: () => void;
  onPlaySong: () => void;
}

export function SubmissionItem({
  song,
  isThisSongPlaying,
  isThisSongCurrent,
  isLinkSubmission,
  isCommentsVisible,
  userIsSubmitter,
  currentVoteState,
  roundStatus,
  hasVoted,
  canVote,
  onToggleComments,
  onVoteClick,
  onBookmark,
  onPlaySong,
}: SubmissionItemProps) {
  const { points, isBookmarked, comment, isPenalized } = song;

  const pointColor =
    points > 0
      ? "text-green-400"
      : points < 0
      ? "text-red-400"
      : "text-muted-foreground";

  const handleUpvoteClick = () => {
    const newVoteState = currentVoteState === "up" ? "none" : "up";
    onVoteClick(newVoteState);
  };
  const handleDownvoteClick = () => {
    const newVoteState = currentVoteState === "down" ? "none" : "down";
    onVoteClick(newVoteState);
  };

  const PlayButton = () => (
    <Button variant="ghost" size="icon" className="size-8" onClick={onPlaySong}>
      {isLinkSubmission ? (
        song.submissionType === "spotify" ? (
          <FaSpotify className="size-5 text-green-500" />
        ) : (
          <FaYoutube className="size-5 text-red-500" />
        )
      ) : isThisSongPlaying ? (
        <Pause className="size-4 text-foreground" />
      ) : (
        <Play className="size-4 text-foreground" />
      )}
    </Button>
  );

  const SubmitterInfo = () => (
    <div className="flex items-center gap-2 text-sm text-muted-foreground md:text-base">
      <Avatar className="size-6">
        <AvatarImage
          src={
            roundStatus === "voting"
              ? undefined
              : song.submittedByImage ?? undefined
          }
          alt={roundStatus === "voting" ? "Anonymous" : song.submittedBy}
        />
        <AvatarFallback
          dangerouslySetInnerHTML={{
            __html: toSvg(
              roundStatus === "voting"
                ? song._id
                : song.submittedBy ?? song.userId,
              24,
            ),
          }}
        />
      </Avatar>
      <span>{roundStatus === "voting" ? "Anonymous" : song.submittedBy}</span>
    </div>
  );

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        className={cn(
          "grid items-center gap-x-4 gap-y-1 p-3 transition-colors",
          "grid-cols-[1fr_auto]",  
          "md:grid-cols-[auto_4fr_3fr_2fr_auto] md:gap-4 md:px-4 md:py-2",  
          isThisSongCurrent ? "bg-accent" : "hover:bg-accent/50",
          isCommentsVisible && "bg-accent/50",
        )}
      >
        <div className="hidden w-10 items-center justify-center md:flex">
          <PlayButton />
        </div>

        <div className="flex items-center gap-4">
          <div className="md:hidden">
            <PlayButton />
          </div>
          <Image
            src={song.albumArtUrl}
            alt={song.songTitle}
            width={40}
            height={40}
            className="rounded"
          />
          <div>
            <p className={cn("font-semibold", isThisSongCurrent && "text-primary")}>
              {song.songTitle}
            </p>
            <p className="text-sm text-muted-foreground">{song.artist}</p>
          </div>
        </div>

        <div className="hidden md:block">
          <SubmitterInfo />
          {comment && (
            <blockquote className="mt-1 border-l-2 pl-2 text-xs italic text-muted-foreground break-words">
              {comment}
            </blockquote>
          )}
        </div>

        <div className={cn("hidden text-right font-bold md:block", pointColor)}>
          {roundStatus === "finished" ? `${points} pts` : "?"}
          {isPenalized && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex align-middle">
                    <Ban className="ml-1 size-4 text-yellow-500" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Positive votes for this submission were annulled because the
                    submitter did not vote in this round.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="flex items-center justify-center md:gap-1">
          <Button
            variant="ghost" size="icon" aria-label="Upvote"
            onClick={handleUpvoteClick}
            disabled={roundStatus !== "voting" || userIsSubmitter || hasVoted || !canVote}
          >
            <ArrowUp className={cn("size-5", currentVoteState === 'up' && "fill-green-400/20 text-green-400")} />
          </Button>
          <Button
            variant="ghost" size="icon" aria-label="Downvote"
            onClick={handleDownvoteClick}
            disabled={roundStatus !== "voting" || userIsSubmitter || hasVoted || !canVote}
          >
            <ArrowDown className={cn("size-5", currentVoteState === 'down' && "fill-red-400/20 text-red-400")} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Bookmark" onClick={onBookmark}>
            <Bookmark className={cn("size-5", isBookmarked && "fill-primary text-primary")} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Comments" onClick={onToggleComments}>
            <MessageSquare className={cn("size-5", isCommentsVisible && "fill-accent")} />
          </Button>
        </div>

        <div className="col-span-full space-y-2 pl-[56px] md:hidden">
          <div className="flex items-center justify-between">
            <SubmitterInfo />
            <div className={cn("text-sm font-bold", pointColor)}>
              {roundStatus === "finished" ? `${points} pts` : "?"}
              {isPenalized && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild><span className="inline-flex align-middle"><Ban className="ml-1 size-3 text-yellow-500" /></span></TooltipTrigger>
                    <TooltipContent><p>Positive votes for this submission were annulled because the submitter did not vote in this round.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          {comment && <blockquote className="border-l-2 pl-3 text-sm italic text-muted-foreground break-words">{comment}</blockquote>}
        </div>
      </div>

      {isCommentsVisible && (
        <div className="p-3 pt-0 md:px-4 md:pb-4">
          <SubmissionComments submissionId={song._id as Id<"submissions">} roundStatus={roundStatus} />
        </div>
      )}
    </div>
  );
}