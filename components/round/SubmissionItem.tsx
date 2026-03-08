"use client";

import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  MessageSquare,
  MoreHorizontal,
  Play,
  Pause,
  Ban,
  Headphones,
  AlertTriangle,
  Download,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toSvg } from "jdenticon";
import { Doc, Id } from "@/convex/_generated/dataModel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { useMemo } from "react";
import { api } from "@/lib/convex/api";
import { Song } from "@/types";
import type { LeagueData } from "@/lib/convex/types";
import { AvatarStack } from "../AvatarStack";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { toErrorMessage } from "@/lib/errors";
import { YouTubeIcon } from "@/components/icons/BrandIcons";
import { OverflowText } from "@/components/ui/overflow-text";
import { buildTrackMetadataText } from "@/lib/music/submission-display";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatVoteScore,
  groupVoteSummaryDetailsByScore,
} from "@/lib/rounds/vote-summary-display";

// A new component for the animated equalizer
const EqualizerIcon = () => (
  <div className="flex w-5 items-end gap-0.5">
    <span className="h-2 w-1 animate-[pumping_1s_ease-in-out_infinite_reverse] rounded-full bg-primary [animation-delay:-0.3s]"></span>
    <span className="h-3 w-1 animate-[pumping_1s_ease-in-out_infinite_reverse] rounded-full bg-primary [animation-delay:-0.15s]"></span>
    <span className="h-4 w-1 animate-[pumping_1s_ease-in-out_infinite_reverse] rounded-full bg-primary"></span>
    <span className="h-3 w-1 animate-[pumping_1s_ease-in-out_infinite_reverse] rounded-full bg-primary [animation-delay:-0.15s]"></span>
  </div>
);

interface SubmissionItemProps {
  song: Song;
  index: number;
  isThisSongPlaying: boolean;
  isThisSongCurrent: boolean;
  isCommentsVisible: boolean;
  userIsSubmitter: boolean;
  currentVoteValue: number;
  roundStatus: "voting" | "finished" | "submissions";
  onToggleComments: () => void;
  league: LeagueData;
  hasVoted: boolean;
  canVote: boolean;
  onVoteClick: (delta: 1 | -1) => void;
  onBookmark: () => void;
  onPlaySong: () => void;
  listenProgress: Doc<"listenProgress"> | undefined;
  listeners: {
    name?: string | null;
    image?: string | null;
    _id: Id<"users">;
  }[];
  voteDetails?:
    | {
        voterId: Id<"users">;
        voterName: string;
        voterImage: string | null;
        score: number;
      }[]
    | undefined;
  currentUser: Doc<"users"> | null | undefined;
}

export function SubmissionItem({
  song,
  index,
  isThisSongPlaying,
  isThisSongCurrent,
  isCommentsVisible,
  userIsSubmitter,
  currentVoteValue,
  roundStatus,
  league,
  hasVoted,
  canVote,
  onVoteClick,
  onBookmark,
  onPlaySong,
  listenProgress,
  onToggleComments,
  listeners,
  voteDetails,
  currentUser,
}: SubmissionItemProps) {
  const { listenProgress: localListenProgress } = useMusicPlayerStore();
  const isLinkSubmission = song.submissionType === "youtube";

  // Troll submission functionality
  const markAsTrollSubmission = useMutation(
    api.submissions.markAsTrollSubmission,
  );

  // Check if current user can mark troll submissions (league owner, manager, or global admin)
  const canMarkTrollSubmissions = useMemo(() => {
    if (!currentUser) return false;
    const isOwner = league.creatorId === currentUser._id;
    const isManager = league.managers?.includes(currentUser._id) ?? false;
    const isGlobalAdmin = currentUser.isGlobalAdmin ?? false;
    return isOwner || isManager || isGlobalAdmin;
  }, [currentUser, league]);

  const handleTrollSubmissionToggle = async () => {
    try {
      const result = await markAsTrollSubmission({
        submissionId: song._id,
        isTrollSubmission: !song.isTrollSubmission,
      });
      toast.success(result.message);
    } catch (error) {
      toast.error(toErrorMessage(error, "Failed to update troll status."));
    }
  };

  const otherListeners = listeners.filter(
    (listener) => listener._id !== currentUser?._id,
  );

  const isListenRequirementMetForThisSong = useMemo(() => {
    if (song.isTrollSubmission) return true;
    if (
      !league.enforceListenPercentage ||
      ["file", "youtube"].includes(song.submissionType) === false ||
      userIsSubmitter
    )
      return true;
    return listenProgress?.isCompleted || localListenProgress[song._id];
  }, [
    league,
    localListenProgress,
    listenProgress,
    song._id,
    song.submissionType,
    userIsSubmitter,
    song.isTrollSubmission,
  ]);

  const showListenRequirementIndicator = useMemo(() => {
    return (
      roundStatus === "voting" &&
      league.enforceListenPercentage &&
      ["file", "youtube"].includes(song.submissionType) &&
      !userIsSubmitter &&
      !isListenRequirementMetForThisSong
    );
  }, [
    roundStatus,
    league.enforceListenPercentage,
    song.submissionType,
    userIsSubmitter,
    isListenRequirementMetForThisSong,
  ]);

  const upvoteDisabledReason = useMemo(() => {
    if (roundStatus !== "voting") return "Voting is not currently open.";
    if (userIsSubmitter) return "You cannot vote on your own submission.";
    if (!canVote) return "You must submit a song to vote in this round.";
    if (hasVoted) return "Your vote for this round is final.";
    if (song.isTrollSubmission)
      return "You cannot vote on submissions marked as troll submissions.";
    if (
      league.limitVotesPerSubmission &&
      currentVoteValue >= (league.maxPositiveVotesPerSubmission ?? 1)
    )
      return `Max ${league.maxPositiveVotesPerSubmission} upvote(s) per song.`;

    if (league.enforceListenPercentage) {
      if (
        ["file", "youtube"].includes(song.submissionType) &&
        !isListenRequirementMetForThisSong
      ) {
        return `You must listen to ${league.listenPercentage}% of this song to vote.`;
      }
    }

    return null;
  }, [
    roundStatus,
    userIsSubmitter,
    canVote,
    hasVoted,
    league,
    currentVoteValue,
    song,
    isListenRequirementMetForThisSong,
  ]);

  const downvoteDisabledReason = useMemo(() => {
    if (roundStatus !== "voting") return "Voting is not currently open.";
    if (userIsSubmitter) return "You cannot vote on your own submission.";
    if (!canVote) return "You must submit a song to vote in this round.";
    if (hasVoted) return "Your vote for this round is final.";
    // Note: Troll submissions can still receive downvotes, so we don't block them here
    if (
      league.limitVotesPerSubmission &&
      currentVoteValue <= -(league.maxNegativeVotesPerSubmission ?? 0)
    )
      return `Max ${league.maxNegativeVotesPerSubmission} downvote(s) per song.`;

    if (league.enforceListenPercentage) {
      if (
        ["file", "youtube"].includes(song.submissionType) &&
        !isListenRequirementMetForThisSong
      ) {
        return `You must listen to ${league.listenPercentage}% of this song to vote.`;
      }
    }

    return null;
  }, [
    roundStatus,
    userIsSubmitter,
    canVote,
    hasVoted,
    league,
    currentVoteValue,
    song,
    isListenRequirementMetForThisSong,
  ]);

  const songPoints = song.points ?? 0;
  const pointsColor =
    songPoints > 0
      ? "text-success"
      : songPoints < 0
        ? "text-destructive"
        : "text-muted-foreground";
  const votingComment = song.comment?.trim() ? song.comment.trim() : "-";
  const metadataText = buildTrackMetadataText(song.artist, song.albumName);
  const compactMobileActionButtonClass = "size-10 md:size-8";
  const compactMobileVoteButtonClass = "size-10 rounded-full md:size-8";
  const compactMobileIconClass = "size-4 md:size-5";
  const showMobileOverflowAccent = song.isBookmarked || isCommentsVisible;
  const voteGroups = useMemo(
    () =>
      groupVoteSummaryDetailsByScore(
        (voteDetails ?? []).map((vote) => ({
          voterId: vote.voterId.toString(),
          voterName: vote.voterName,
          voterImage: vote.voterImage,
          score: vote.score,
        })),
      ),
    [voteDetails],
  );

  const renderSubmitterInfo = () =>
    roundStatus === "voting" ? (
      <p className="line-clamp-3 text-xs leading-4 text-muted-foreground [overflow-wrap:anywhere]">
        {votingComment}
      </p>
    ) : (
      <div className="flex items-center gap-2 text-sm">
        <Avatar className="size-6">
          <AvatarImage src={song.submittedByImage ?? undefined} />
          <AvatarFallback
            dangerouslySetInnerHTML={{
              __html: toSvg(
                String(song.submittedBy ?? song.userId ?? song._id),
                24,
              ),
            }}
          />
        </Avatar>
        <span className="text-muted-foreground">{song.submittedBy}</span>
      </div>
    );

  const renderVoteGroups = (maxAvatars: number) => {
    if (roundStatus !== "finished" || voteGroups.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {voteGroups.map((group) => (
          <div key={group.score} className="flex items-center gap-2">
            <AvatarStack
              users={group.users}
              max={maxAvatars}
              avatarClassName="size-6 border"
              overflowClassName="size-5 text-[10px]"
            />
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                group.score > 0
                  ? "text-success"
                  : group.score < 0
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {formatVoteScore(group.score)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderVoteButtonGroup = () => (
    <div className="flex items-center rounded-full border bg-background">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(compactMobileVoteButtonClass)}
              aria-label="Upvote"
              onClick={(e) => {
                e.stopPropagation();
                onVoteClick(1);
              }}
              disabled={!!upvoteDisabledReason}
            >
              <ArrowUp
                className={cn(
                  compactMobileIconClass,
                  currentVoteValue > 0 && "fill-success/20 text-success",
                )}
              />
            </Button>
          </TooltipTrigger>
          {upvoteDisabledReason && (
            <TooltipContent>
              <p>{upvoteDisabledReason}</p>
            </TooltipContent>
          )}
        </Tooltip>
        <span
          className={cn(
            "w-5 text-center text-xs font-bold md:w-6 md:text-sm",
            currentVoteValue > 0
              ? "text-success"
              : currentVoteValue < 0
                ? "text-destructive"
                : "text-muted-foreground",
          )}
        >
          {currentVoteValue !== 0 &&
            (currentVoteValue > 0 ? `+${currentVoteValue}` : currentVoteValue)}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(compactMobileVoteButtonClass)}
              aria-label="Downvote"
              onClick={(e) => {
                e.stopPropagation();
                onVoteClick(-1);
              }}
              disabled={!!downvoteDisabledReason}
            >
              <ArrowDown
                className={cn(
                  compactMobileIconClass,
                  currentVoteValue < 0 &&
                    "fill-destructive/20 text-destructive",
                )}
              />
            </Button>
          </TooltipTrigger>
          {downvoteDisabledReason && (
            <TooltipContent>
              <p>{downvoteDisabledReason}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        className={cn(
          "p-3 transition-colors",
          isThisSongCurrent ? "bg-accent" : "hover:bg-accent/50",
          isCommentsVisible && "bg-accent/50",
          showListenRequirementIndicator && "border-l-2 border-primary/70",
        )}
      >
        {/* Mobile Layout */}
        <div className="md:hidden">
          <div className="flex items-center gap-3">
            <div
              className="relative flex-shrink-0 cursor-pointer"
              onClick={onPlaySong}
            >
              <Image
                src={song.albumArtUrl ?? "/icons/web-app-manifest-192x192.png"}
                alt={song.songTitle}
                width={48}
                height={48}
                className="rounded"
              />
              {otherListeners && otherListeners.length > 0 && (
                <div className="absolute bottom-0 right-0 origin-bottom-right scale-90">
                  <AvatarStack users={otherListeners} />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                {isThisSongPlaying ? (
                  <Pause className="size-6" />
                ) : (
                  <Play className="size-6" />
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1 cursor-pointer" onClick={onPlaySong}>
              <div className="flex min-w-0 items-center gap-1.5">
                <OverflowText
                  as="p"
                  marquee={isThisSongPlaying}
                  className={cn(
                    "font-semibold",
                    isThisSongCurrent && "text-primary",
                  )}
                >
                  {song.songTitle}
                </OverflowText>
                {showListenRequirementIndicator && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Headphones className="size-4 shrink-0 text-primary" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>You still need to listen to this song to vote.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {metadataText}
              </p>
            </div>
            {isThisSongPlaying ? (
              <EqualizerIcon />
            ) : roundStatus === "finished" ? (
              <div className={cn("text-right text-sm font-bold", pointsColor)}>
                {songPoints} pts
              </div>
            ) : null}
          </div>
          {roundStatus === "finished" && voteGroups.length > 0 ? (
            <div className="mt-2">{renderVoteGroups(4)}</div>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-2">
            {renderSubmitterInfo()}
            <div className="flex items-center gap-0.5">
              {roundStatus === "voting" && renderVoteButtonGroup()}
              {canMarkTrollSubmissions && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={compactMobileActionButtonClass}
                        aria-label={
                          song.isTrollSubmission
                            ? "Unmark as troll submission"
                            : "Mark as troll submission"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTrollSubmissionToggle();
                        }}
                      >
                        <AlertTriangle
                          className={cn(
                            compactMobileIconClass,
                            song.isTrollSubmission && "text-destructive",
                          )}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {song.isTrollSubmission
                          ? "Unmark as troll submission"
                          : "Mark as troll submission"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={compactMobileActionButtonClass}
                    aria-label="More actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal
                      className={cn(
                        compactMobileIconClass,
                        showMobileOverflowAccent && "text-primary",
                      )}
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-44"
                  onClick={(e) => e.stopPropagation()}
                >
                  {roundStatus !== "submissions" &&
                    song.submissionType === "file" &&
                    song.songFileUrl && (
                      <DropdownMenuItem asChild>
                        <a
                          href={song.songFileUrl}
                          download
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="size-4" />
                          Download audio
                        </a>
                      </DropdownMenuItem>
                    )}
                  <DropdownMenuItem onSelect={() => onBookmark()}>
                    <Bookmark
                      className={cn(
                        "size-4",
                        song.isBookmarked && "fill-primary text-primary",
                      )}
                    />
                    {song.isBookmarked ? "Remove bookmark" : "Bookmark song"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onToggleComments()}>
                    <MessageSquare
                      className={cn(
                        "size-4",
                        isCommentsVisible && "fill-accent",
                      )}
                    />
                    {isCommentsVisible ? "Hide comments" : "Show comments"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div
          className={cn(
            "hidden md:grid md:items-center md:gap-4",
            roundStatus === "finished"
              ? "md:grid-cols-[auto_4fr_3fr_3fr_2fr_auto]"
              : "md:grid-cols-[auto_4fr_3fr_2fr_auto]",
          )}
        >
          <div className="w-10 flex items-center justify-center">
            <div
              className="relative w-10 h-10 flex items-center justify-center group/play"
              onClick={onPlaySong}
            >
              <span
                className={cn(
                  "text-muted-foreground group-hover/play:hidden",
                  isThisSongCurrent && "hidden",
                )}
              >
                {index + 1}
              </span>
              <div
                className={cn(
                  "absolute inset-0 items-center justify-center hidden",
                  isThisSongCurrent ? "flex" : "group-hover/play:flex",
                )}
              >
                {isThisSongPlaying ? (
                  <EqualizerIcon />
                ) : (
                  <Play className="size-5" />
                )}
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-4 min-w-0 cursor-pointer"
            onClick={onPlaySong}
          >
            <div className="relative flex-shrink-0">
              <Image
                src={song.albumArtUrl ?? "/icons/web-app-manifest-192x192.png"}
                alt={song.songTitle}
                width={40}
                height={40}
                className="rounded"
              />
              {otherListeners && otherListeners.length > 0 && (
                <div className="absolute bottom-[-4px] right-[-4px] origin-bottom-right scale-65">
                  <AvatarStack users={otherListeners} />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <OverflowText
                  as="p"
                  marquee={isThisSongPlaying}
                  className={cn(
                    "font-semibold",
                    isThisSongCurrent && "text-primary",
                  )}
                >
                  {song.songTitle}
                </OverflowText>
                {showListenRequirementIndicator && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Headphones className="size-4 shrink-0 text-primary" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>You still need to listen to this song to vote.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {metadataText}
              </p>
            </div>
          </div>
          <div>{renderSubmitterInfo()}</div>
          {roundStatus === "finished" ? (
            <div className="min-w-0">{renderVoteGroups(6)}</div>
          ) : null}
          <div
            className={cn(
              "text-right font-bold flex items-center justify-end gap-1.5",
              pointsColor,
            )}
          >
            {roundStatus === "finished" ? `${songPoints} pts` : "?"}
            {song.isPenalized && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Ban className="size-4 text-warning" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Submitter did not vote; positive votes annulled.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {song.isTrollSubmission && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="size-4 text-destructive" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      This submission has been marked as a troll submission.
                      Positive votes are ignored.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center justify-center w-44 gap-1">
            {roundStatus === "voting" ? (
              renderVoteButtonGroup()
            ) : roundStatus !== "submissions" ? (
              isLinkSubmission ? (
                <a
                  href={song.songLink!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button variant="ghost" size="icon" className="size-8">
                    <YouTubeIcon className="size-5 text-red-500" />
                  </Button>
                </a>
              ) : song.submissionType === "file" && song.songFileUrl ? (
                <a
                  href={song.songFileUrl}
                  download
                  onClick={(e) => e.stopPropagation()}
                  title="Download audio file"
                >
                  <Button variant="ghost" size="icon" className="size-8">
                    <Download className="size-5" />
                  </Button>
                </a>
              ) : null
            ) : null}
            {canMarkTrollSubmissions && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTrollSubmissionToggle();
                      }}
                    >
                      <AlertTriangle
                        className={cn(
                          "size-5",
                          song.isTrollSubmission && "text-destructive",
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {song.isTrollSubmission
                        ? "Unmark as troll submission"
                        : "Mark as troll submission"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={(e) => {
                e.stopPropagation();
                onBookmark();
              }}
            >
              <Bookmark
                className={cn(
                  "size-5",
                  song.isBookmarked && "fill-primary text-primary",
                )}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={(e) => {
                e.stopPropagation();
                onToggleComments();
              }}
            >
              <MessageSquare
                className={cn("size-5", isCommentsVisible && "fill-accent")}
              />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
