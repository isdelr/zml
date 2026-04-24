"use client";

import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  MoreHorizontal,
  Play,
  Pause,
  Ban,
  Headphones,
  AlertTriangle,
  Download,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MediaImage } from "@/components/ui/media-image";
import { toSvg } from "jdenticon";
import { Doc, Id } from "@/convex/_generated/dataModel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/convex/api";
import { buildSubmissionAudioDownloadPath } from "@/lib/media/delivery";
import { Song } from "@/types";
import type { LeagueData } from "@/lib/convex/types";
import { AvatarStack } from "../AvatarStack";
import { AvatarRoster } from "../AvatarRoster";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { toErrorMessage } from "@/lib/errors";
import { YouTubeIcon } from "@/components/icons/BrandIcons";
import { OverflowText } from "@/components/ui/overflow-text";
import { ExpandableText } from "@/components/ui/expandable-text";
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
import {
  getNormalizedDurationSeconds,
  getRequiredListenTimeSeconds,
  hasCompletedSavedListenProgress,
} from "@/lib/music/listen-progress";
import {
  SubmissionCommentComposerButton,
  SubmissionComments,
} from "./SubmissionComments";
import {
  getVotingRestrictionCopy,
  type VotingEligibilityReason,
} from "@/lib/rounds/voting-participation";

interface SubmissionActionsMenuProps {
  buttonClassName: string;
  iconClassName: string;
  highlightTrigger: boolean;
  canBookmark: boolean;
  isBookmarked: boolean;
  canOpenOriginalLink: boolean;
  songLink?: string | null;
  canDownloadAudio: boolean;
  downloadUrl?: string;
  canVoidListenRequirement: boolean;
  isListenRequirementVoided: boolean;
  canToggleTrollSubmission: boolean;
  isTrollSubmission: boolean;
  canAdjustAdminPoints: boolean;
  onBookmark: () => void;
  onToggleListenRequirementVoid: () => void;
  onToggleTrollSubmission: () => void;
  onAdjustAdminPoint: (delta: 1 | -1) => void;
}

function SubmissionActionsMenu({
  buttonClassName,
  iconClassName,
  highlightTrigger,
  canBookmark,
  isBookmarked,
  canOpenOriginalLink,
  songLink,
  canDownloadAudio,
  downloadUrl,
  canVoidListenRequirement,
  isListenRequirementVoided,
  canToggleTrollSubmission,
  isTrollSubmission,
  canAdjustAdminPoints,
  onBookmark,
  onToggleListenRequirementVoid,
  onToggleTrollSubmission,
  onAdjustAdminPoint,
}: SubmissionActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasActions =
    canBookmark ||
    canOpenOriginalLink ||
    canDownloadAudio ||
    canVoidListenRequirement ||
    canToggleTrollSubmission ||
    canAdjustAdminPoints;

  useEffect(() => {
    if (!isOpen) return;

    const closeMenu = () => setIsOpen(false);
    const passiveCapture = { capture: true, passive: true } as const;

    window.addEventListener("wheel", closeMenu, passiveCapture);
    window.addEventListener("touchmove", closeMenu, passiveCapture);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      window.removeEventListener("wheel", closeMenu, passiveCapture);
      window.removeEventListener("touchmove", closeMenu, passiveCapture);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [isOpen]);

  if (!hasActions) return null;

  return (
    <DropdownMenu modal={false} open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={buttonClassName}
          aria-label="More actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal
            className={cn(iconClassName, highlightTrigger && "text-primary")}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52"
        onClick={(e) => e.stopPropagation()}
      >
        {canBookmark ? (
          <DropdownMenuItem onSelect={onBookmark}>
            <Bookmark
              className={cn(
                "size-4",
                isBookmarked && "fill-primary text-primary",
              )}
            />
            {isBookmarked ? "Remove bookmark" : "Bookmark song"}
          </DropdownMenuItem>
        ) : null}
        {canOpenOriginalLink && songLink ? (
          <DropdownMenuItem asChild>
            <a
              href={songLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <YouTubeIcon className="size-4 text-red-500" />
              Open on YouTube
            </a>
          </DropdownMenuItem>
        ) : null}
        {canDownloadAudio && downloadUrl ? (
          <DropdownMenuItem asChild>
            <a href={downloadUrl} download onClick={(e) => e.stopPropagation()}>
              <Download className="size-4" />
              Download audio
            </a>
          </DropdownMenuItem>
        ) : null}
        {canVoidListenRequirement ? (
          <DropdownMenuItem onSelect={onToggleListenRequirementVoid}>
            <VolumeX
              className={cn(
                "size-4",
                isListenRequirementVoided && "text-primary",
              )}
            />
            {isListenRequirementVoided
              ? "Restore listening requirement"
              : "Void listening requirement"}
          </DropdownMenuItem>
        ) : null}
        {canToggleTrollSubmission ? (
          <DropdownMenuItem onSelect={onToggleTrollSubmission}>
            <AlertTriangle
              className={cn("size-4", isTrollSubmission && "text-destructive")}
            />
            {isTrollSubmission
              ? "Unmark troll submission"
              : "Mark as troll submission"}
          </DropdownMenuItem>
        ) : null}
        {canAdjustAdminPoints ? (
          <DropdownMenuItem onSelect={() => onAdjustAdminPoint(1)}>
            <ArrowUp className="size-4 text-success" />
            Add admin point
          </DropdownMenuItem>
        ) : null}
        {canAdjustAdminPoints ? (
          <DropdownMenuItem onSelect={() => onAdjustAdminPoint(-1)}>
            <ArrowDown className="size-4 text-destructive" />
            Subtract admin point
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// A new component for the animated equalizer
const EqualizerIcon = () => (
  <div className="flex w-5 items-end gap-0.5">
    <span className="h-2 w-1 animate-[pumping_1s_ease-in-out_infinite_reverse] rounded-full bg-primary [animation-delay:-0.3s]"></span>
    <span className="h-3 w-1 animate-[pumping_1s_ease-in-out_infinite_reverse] rounded-full bg-primary [animation-delay:-0.15s]"></span>
    <span className="h-4 w-1 animate-[pumping_1s_ease-in-out_infinite_reverse] rounded-full bg-primary"></span>
    <span className="h-3 w-1 animate-[pumping_1s_ease-in-out_infinite_reverse] rounded-full bg-primary [animation-delay:-0.15s]"></span>
  </div>
);

function buildDownloadUrl(url: string, submissionId: string): string {
  try {
    const parsed = new URL(url, "http://localhost");
    parsed.pathname = buildSubmissionAudioDownloadPath(submissionId);

    if (/^https?:\/\//u.test(url)) {
      return parsed.toString();
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

interface SubmissionItemProps {
  song: Song;
  index: number;
  isThisSongPlaying: boolean;
  isThisSongCurrent: boolean;
  userIsSubmitter: boolean;
  currentVoteValue: number;
  roundStatus: "scheduled" | "voting" | "finished" | "submissions";
  league: LeagueData;
  canManageLeague: boolean;
  hasVoted: boolean;
  canVote: boolean;
  votingEligibilityReason?: VotingEligibilityReason;
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
        isAdminAdjustment?: boolean;
      }[]
    | undefined;
  currentUser: Doc<"users"> | null | undefined;
}

export function SubmissionItem({
  song,
  index,
  isThisSongPlaying,
  isThisSongCurrent,
  userIsSubmitter,
  currentVoteValue,
  roundStatus,
  league,
  canManageLeague,
  hasVoted,
  canVote,
  votingEligibilityReason,
  onVoteClick,
  onBookmark,
  onPlaySong,
  listenProgress,
  listeners,
  voteDetails,
  currentUser,
}: SubmissionItemProps) {
  const isListenRequirementMetLocally = useMusicPlayerStore(
    (state) => state.listenProgress[song._id] === true,
  );
  const playPointerStateRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const isLinkSubmission = song.submissionType === "youtube";

  // Troll submission functionality
  const markAsTrollSubmission = useMutation(
    api.submissions.markAsTrollSubmission,
  );
  const setListenRequirementVoided = useMutation(
    api.submissions.setListenRequirementVoided,
  );
  const adjustFinishedRoundVote = useMutation(api.votes.adjustFinishedRoundVote);

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

  const handleListenRequirementVoidToggle = async () => {
    try {
      const result = await setListenRequirementVoided({
        submissionId: song._id,
        isVoided: !song.listenRequirementVoided,
      });
      toast.success(result.message);
    } catch (error) {
      toast.error(
        toErrorMessage(error, "Failed to update listening requirement."),
      );
    }
  };

  const handleAdminVoteAdjustment = async (delta: 1 | -1) => {
    try {
      await adjustFinishedRoundVote({
        submissionId: song._id,
        delta,
      });
    } catch (error) {
      toast.error(
        toErrorMessage(error, "Failed to update the admin point adjustment."),
      );
    }
  };

  const otherListeners = listeners.filter(
    (listener) => listener._id !== currentUser?._id,
  );
  const votingRestrictionCopy = getVotingRestrictionCopy(votingEligibilityReason);
  const listenRequirementCopy = useMemo(() => {
    const durationSeconds = getNormalizedDurationSeconds(song.duration ?? 0);
    if (durationSeconds <= 0) {
      return "You must fully listen to this song before voting.";
    }

    const requiredListenSeconds = getRequiredListenTimeSeconds(
      durationSeconds,
      league.listenPercentage,
      league.listenTimeLimitMinutes,
    );
    if (requiredListenSeconds < durationSeconds) {
      const wholeMinutes = Math.floor(requiredListenSeconds / 60);
      const remainderSeconds = requiredListenSeconds % 60;
      const durationLabel =
        remainderSeconds === 0
          ? `${wholeMinutes} minute${wholeMinutes === 1 ? "" : "s"}`
          : `${wholeMinutes}:${remainderSeconds.toString().padStart(2, "0")}`;
      return `You must listen to the first ${durationLabel} of this song before voting.`;
    }

    return "You must fully listen to this song before voting.";
  }, [
    league.listenPercentage,
    league.listenTimeLimitMinutes,
    song.duration,
  ]);

  const isListenRequirementMetForThisSong = useMemo(() => {
    if (song.isTrollSubmission) return true;
    if (song.listenRequirementVoided) return true;
    if (league.currentUserListenRequirementVoided) return true;
    if (
      !league.enforceListenPercentage ||
      ["file", "youtube"].includes(song.submissionType) === false ||
      userIsSubmitter
    )
      return true;
    return (
      isListenRequirementMetLocally ||
      hasCompletedSavedListenProgress({
        isCompleted: listenProgress?.isCompleted,
        progressSeconds: listenProgress?.progressSeconds ?? 0,
        durationSeconds: song.duration ?? 0,
        listenPercentage: league.listenPercentage,
        listenTimeLimitMinutes: league.listenTimeLimitMinutes,
      })
    );
  }, [
    league,
    isListenRequirementMetLocally,
    listenProgress,
    song.duration,
    song.submissionType,
    userIsSubmitter,
    song.isTrollSubmission,
    song.listenRequirementVoided,
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
    if (!canVote)
      return (
        votingRestrictionCopy?.voteLockedReason ??
        "You must submit a song to vote in this round."
      );
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
        return listenRequirementCopy;
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
    listenRequirementCopy,
    votingRestrictionCopy,
  ]);

  const downvoteDisabledReason = useMemo(() => {
    if (roundStatus !== "voting") return "Voting is not currently open.";
    if (userIsSubmitter) return "You cannot vote on your own submission.";
    if (!canVote)
      return (
        votingRestrictionCopy?.voteLockedReason ??
        "You must submit a song to vote in this round."
      );
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
        return listenRequirementCopy;
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
    listenRequirementCopy,
    votingRestrictionCopy,
  ]);

  const songPoints = song.points ?? 0;
  const pointsColor =
    songPoints > 0
      ? "text-success"
      : songPoints < 0
        ? "text-destructive"
        : "text-muted-foreground";
  const votingComment = song.comment?.trim() ? song.comment.trim() : "-";
  const metadataText = buildTrackMetadataText(
    song.artist,
    song.albumName,
    song.year,
  );
  const compactMobileActionButtonClass = "size-10 md:size-8";
  const compactMobileVoteButtonClass = "size-10 rounded-full md:size-8";
  const compactMobileIconClass = "size-4 md:size-5";
  const showMobileOverflowAccent = Boolean(song.isBookmarked);
  const voteGroups = useMemo(
    () =>
      groupVoteSummaryDetailsByScore(
        (voteDetails ?? []).map((vote) => ({
          voterId: vote.voterId.toString(),
          voterName: vote.voterName,
          voterImage: vote.voterImage,
          score: vote.score,
          isAdminAdjustment: vote.isAdminAdjustment ?? false,
        })),
      ),
    [voteDetails],
  );
  const canDownloadAudio =
    roundStatus !== "submissions" &&
    song.submissionType === "file" &&
    Boolean(song.songFileUrl);
  const canOpenOriginalLink =
    roundStatus !== "submissions" &&
    isLinkSubmission &&
    Boolean(song.songLink);
  const canVoidListenRequirement =
    roundStatus === "voting" &&
    canManageLeague &&
    Boolean(league.enforceListenPercentage) &&
    ["file", "youtube"].includes(song.submissionType);
  const canAdjustAdminPoints = roundStatus === "finished" && canManageLeague;
  const canToggleBookmark = Boolean(currentUser);
  const downloadUrl =
    canDownloadAudio && song.songFileUrl
      ? buildDownloadUrl(song.songFileUrl, song._id)
      : undefined;
  const handlePlayPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;
    playPointerStateRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
  };
  const handlePlayPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const pointerState = playPointerStateRef.current;
    if (!pointerState || pointerState.pointerId !== event.pointerId) return;
    const deltaX = Math.abs(event.clientX - pointerState.x);
    const deltaY = Math.abs(event.clientY - pointerState.y);
    if (deltaX > 8 || deltaY > 8) {
      pointerState.moved = true;
    }
  };
  const handlePlayPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const pointerState = playPointerStateRef.current;
    if (!pointerState || pointerState.pointerId !== event.pointerId) return;
    window.setTimeout(() => {
      if (playPointerStateRef.current === pointerState) {
        playPointerStateRef.current = null;
      }
    }, 0);
  };
  const handlePlayPointerCancel = (event: React.PointerEvent<HTMLElement>) => {
    if (playPointerStateRef.current?.pointerId === event.pointerId) {
      playPointerStateRef.current = null;
    }
  };
  const handlePlayClick = (event: React.MouseEvent<HTMLElement>) => {
    if (playPointerStateRef.current?.moved) {
      event.preventDefault();
      event.stopPropagation();
      playPointerStateRef.current = null;
      return;
    }
    playPointerStateRef.current = null;
    onPlaySong();
  };
  const playGestureHandlers = {
    onPointerDown: handlePlayPointerDown,
    onPointerMove: handlePlayPointerMove,
    onPointerUp: handlePlayPointerUp,
    onPointerCancel: handlePlayPointerCancel,
    onClick: handlePlayClick,
  };

  const renderVotingComment = () => (
    <ExpandableText
      textClassName="text-xs leading-4 text-muted-foreground"
      buttonClassName="px-2"
    >
      {votingComment}
    </ExpandableText>
  );

  const renderSubmitterInfo = () =>
    roundStatus === "voting" ? (
      renderVotingComment()
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

  const renderVoteGroups = () => {
    if (roundStatus !== "finished" || voteGroups.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {voteGroups.map((group) => (
          <div
            key={group.score}
            className="flex max-w-full items-center gap-2 rounded-full border bg-muted/40 px-2 py-1"
          >
            <span
              className={cn(
                "shrink-0 text-sm font-semibold tabular-nums",
                group.score > 0
                  ? "text-success"
                  : group.score < 0
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {formatVoteScore(group.score)}
            </span>
            <AvatarRoster
              users={group.users}
              avatarClassName="size-6"
            />
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
          showListenRequirementIndicator && "border-l-2 border-primary/70",
        )}
      >
        {/* Mobile Layout */}
        <div className="md:hidden">
          <div className="flex items-center gap-3">
            <div
              className="relative flex-shrink-0 cursor-pointer"
              {...playGestureHandlers}
            >
              <MediaImage
                src={song.albumArtUrl ?? "/icons/web-app-manifest-192x192.png"}
                alt={song.songTitle}
                width={48}
                height={48}
                className="size-12 rounded object-cover"
                fallbackSrc="/icons/web-app-manifest-192x192.png"
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
            <div
              className="min-w-0 flex-1 cursor-pointer"
              {...playGestureHandlers}
            >
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
            <div className="mt-2">{renderVoteGroups()}</div>
          ) : null}
          <div
            className="notranslate mt-3 flex items-start justify-between gap-3"
            translate="no"
          >
            {roundStatus !== "voting" ? (
              <div className="min-w-0 flex-1">{renderSubmitterInfo()}</div>
            ) : null}
            <div className="flex items-center gap-0.5">
              {roundStatus === "voting" && renderVoteButtonGroup()}
              <SubmissionCommentComposerButton
                submissionId={song._id}
                roundId={song.roundId}
                roundStatus={roundStatus}
                submissionTitle={song.songTitle}
                size="icon"
                className={cn(compactMobileActionButtonClass)}
              />
              <SubmissionActionsMenu
                buttonClassName={compactMobileActionButtonClass}
                iconClassName={compactMobileIconClass}
                highlightTrigger={showMobileOverflowAccent}
                canBookmark={canToggleBookmark}
                isBookmarked={Boolean(song.isBookmarked)}
                canOpenOriginalLink={canOpenOriginalLink}
                songLink={song.songLink}
                canDownloadAudio={canDownloadAudio}
                downloadUrl={downloadUrl}
                canVoidListenRequirement={canVoidListenRequirement}
                isListenRequirementVoided={Boolean(
                  song.listenRequirementVoided,
                )}
                canToggleTrollSubmission={canMarkTrollSubmissions}
                isTrollSubmission={Boolean(song.isTrollSubmission)}
                canAdjustAdminPoints={Boolean(canAdjustAdminPoints)}
                onBookmark={onBookmark}
                onToggleListenRequirementVoid={
                  handleListenRequirementVoidToggle
                }
                onToggleTrollSubmission={handleTrollSubmissionToggle}
                onAdjustAdminPoint={handleAdminVoteAdjustment}
              />
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
              {...playGestureHandlers}
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
            {...playGestureHandlers}
          >
            <div className="relative flex-shrink-0">
              <MediaImage
                src={song.albumArtUrl ?? "/icons/web-app-manifest-192x192.png"}
                alt={song.songTitle}
                width={40}
                height={40}
                className="size-10 rounded object-cover"
                fallbackSrc="/icons/web-app-manifest-192x192.png"
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
          <div className="min-w-0">
            {roundStatus === "voting" ? renderVotingComment() : renderSubmitterInfo()}
          </div>
          {roundStatus === "finished" ? (
            <div className="min-w-0">{renderVoteGroups()}</div>
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
          <div
            className="notranslate flex items-center justify-center w-44 gap-1"
            translate="no"
          >
            {roundStatus === "voting" ? renderVoteButtonGroup() : null}
            <SubmissionCommentComposerButton
              submissionId={song._id}
              roundId={song.roundId}
              roundStatus={roundStatus}
              submissionTitle={song.songTitle}
              size="icon"
              className="size-8"
            />
            <SubmissionActionsMenu
              buttonClassName="size-8"
              iconClassName="size-5"
              highlightTrigger={showMobileOverflowAccent}
              canBookmark={canToggleBookmark}
              isBookmarked={Boolean(song.isBookmarked)}
              canOpenOriginalLink={canOpenOriginalLink}
              songLink={song.songLink}
              canDownloadAudio={canDownloadAudio}
              downloadUrl={downloadUrl}
              canVoidListenRequirement={canVoidListenRequirement}
              isListenRequirementVoided={Boolean(song.listenRequirementVoided)}
              canToggleTrollSubmission={canMarkTrollSubmissions}
              isTrollSubmission={Boolean(song.isTrollSubmission)}
              canAdjustAdminPoints={Boolean(canAdjustAdminPoints)}
              onBookmark={onBookmark}
              onToggleListenRequirementVoid={handleListenRequirementVoidToggle}
              onToggleTrollSubmission={handleTrollSubmissionToggle}
              onAdjustAdminPoint={handleAdminVoteAdjustment}
            />
          </div>
        </div>
      </div>
      <SubmissionComments
        submissionId={song._id}
        expandAllByDefault={roundStatus === "finished"}
        className="md:pl-[4.5rem]"
      />
    </div>
  );
}
