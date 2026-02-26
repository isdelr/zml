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
  isReadyToVoteOverall: boolean;
  listeners: { name?: string | null; image?: string | null; _id: Id<"users"> }[];
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
                                 isReadyToVoteOverall,
                                 onToggleComments,
                                 listeners,
                                 currentUser,
                               }: SubmissionItemProps) {
  const { listenProgress: localListenProgress } = useMusicPlayerStore();
  const isLinkSubmission = song.submissionType === 'youtube';
  
  // Troll submission functionality
  const markAsTrollSubmission = useMutation(api.submissions.markAsTrollSubmission);
  
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

  const otherListeners = listeners.filter(listener => listener._id !== currentUser?._id);

  const isListenRequirementMetForThisSong = useMemo(() => {
    if (song.isTrollSubmission) return true;
    if (!league.enforceListenPercentage || ["file", "youtube"].includes(song.submissionType) === false || userIsSubmitter) return true;
    return listenProgress?.isCompleted || localListenProgress[song._id];
  }, [league, localListenProgress, listenProgress, song._id, song.submissionType, userIsSubmitter, song.isTrollSubmission]);

  const showListenRequirementIndicator = useMemo(() => {
    return roundStatus === 'voting' && league.enforceListenPercentage && ["file", "youtube"].includes(song.submissionType) && !userIsSubmitter && !isListenRequirementMetForThisSong;
  }, [roundStatus, league.enforceListenPercentage, song.submissionType, userIsSubmitter, isListenRequirementMetForThisSong]);


  const upvoteDisabledReason = useMemo(() => {
    if (roundStatus !== "voting") return "Voting is not currently open.";
    if (userIsSubmitter) return "You cannot vote on your own submission.";
    if (!canVote) return "You must submit a song to vote in this round.";
    if (hasVoted) return "Your vote for this round is final.";
    if (song.isTrollSubmission) return "You cannot vote on submissions marked as troll submissions.";
    if (league.limitVotesPerSubmission && currentVoteValue >= (league.maxPositiveVotesPerSubmission ?? 1)) return `Max ${league.maxPositiveVotesPerSubmission} upvote(s) per song.`;

    if (league.enforceListenPercentage) {
      if (["file", "youtube"].includes(song.submissionType) && !isListenRequirementMetForThisSong) {
        return `You must listen to ${league.listenPercentage}% of this song to vote.`;
      }
      if (!isReadyToVoteOverall) {
        return "You must meet the listening requirements for all songs before you can vote.";
      }
    }

    return null;
  }, [roundStatus, userIsSubmitter, canVote, hasVoted, league, currentVoteValue, isReadyToVoteOverall, song, isListenRequirementMetForThisSong]);

  const downvoteDisabledReason = useMemo(() => {
    if (roundStatus !== "voting") return "Voting is not currently open.";
    if (userIsSubmitter) return "You cannot vote on your own submission.";
    if (!canVote) return "You must submit a song to vote in this round.";
    if (hasVoted) return "Your vote for this round is final.";
    // Note: Troll submissions can still receive downvotes, so we don't block them here
    if (league.limitVotesPerSubmission && currentVoteValue <= -(league.maxNegativeVotesPerSubmission ?? 0)) return `Max ${league.maxNegativeVotesPerSubmission} downvote(s) per song.`;

    if (league.enforceListenPercentage) {
      if (["file", "youtube"].includes(song.submissionType) && !isListenRequirementMetForThisSong) {
        return `You must listen to ${league.listenPercentage}% of this song to vote.`;
      }
      if (!isReadyToVoteOverall) {
        return "You must meet the listening requirements for all songs before you can vote.";
      }
    }

    return null;
  }, [roundStatus, userIsSubmitter, canVote, hasVoted, league, currentVoteValue, isReadyToVoteOverall, song, isListenRequirementMetForThisSong]);

  const songPoints = song.points ?? 0;
  const pointsColor = songPoints > 0 ? "text-success" : songPoints < 0 ? "text-destructive" : "text-muted-foreground";

  const renderSubmitterInfo = () => (
    <div className="flex items-center gap-2 text-sm">
      <Avatar className="size-6">
        <AvatarImage src={roundStatus === "voting" ? undefined : song.submittedByImage ?? undefined} />
        <AvatarFallback
          dangerouslySetInnerHTML={{
            __html: toSvg(
              String(
                roundStatus === "voting"
                  ? song._id
                  : song.submittedBy ?? song.userId ?? song._id,
              ),
              24,
            ),
          }}
        />
      </Avatar>
      <span className="text-muted-foreground">{roundStatus === "voting" ? "Anonymous" : song.submittedBy}</span>
    </div>
  );

  const renderVoteButtonGroup = () => (
    <div className="flex items-center rounded-full border bg-background">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Upvote" onClick={(e) => { e.stopPropagation(); onVoteClick(1); }} disabled={!!upvoteDisabledReason}>
              <ArrowUp className={cn("size-5", currentVoteValue > 0 && "fill-success/20 text-success")} />
            </Button>
          </TooltipTrigger>
          {upvoteDisabledReason && <TooltipContent><p>{upvoteDisabledReason}</p></TooltipContent>}
        </Tooltip>
        <span className={cn("w-6 text-center text-sm font-bold", currentVoteValue > 0 ? "text-success" : currentVoteValue < 0 ? "text-destructive" : "text-muted-foreground")}>
            {currentVoteValue !== 0 && (currentVoteValue > 0 ? `+${currentVoteValue}` : currentVoteValue)}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Downvote" onClick={(e) => { e.stopPropagation(); onVoteClick(-1); }} disabled={!!downvoteDisabledReason}>
              <ArrowDown className={cn("size-5", currentVoteValue < 0 && "fill-destructive/20 text-destructive")} />
            </Button>
          </TooltipTrigger>
          {downvoteDisabledReason && <TooltipContent><p>{downvoteDisabledReason}</p></TooltipContent>}
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  return (
    <div className="border-b border-border last:border-b-0">
      <div className={cn("p-3 transition-colors", isThisSongCurrent ? "bg-accent" : "hover:bg-accent/50", isCommentsVisible && "bg-accent/50", showListenRequirementIndicator && "border-l-2 border-primary/70")}>
        {/* Mobile Layout */}
        <div className="md:hidden">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0 cursor-pointer" onClick={onPlaySong}>
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
                {isThisSongPlaying ? <Pause className="size-6" /> : <Play className="size-6" />}
              </div>
            </div>
            <div className="min-w-0 flex-1 cursor-pointer" onClick={onPlaySong}>
              <p className={cn("truncate font-semibold", isThisSongCurrent && "text-primary")}>
                {song.songTitle}
                {showListenRequirementIndicator && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Headphones className="ml-1.5 inline-block size-4 text-primary" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>You still need to listen to this song to vote.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </p>
              <p className="truncate text-sm text-muted-foreground">{song.artist}</p>
            </div>
            {isThisSongPlaying ? <EqualizerIcon /> : roundStatus === 'finished' ? <div className={cn("text-right text-sm font-bold", pointsColor)}>{songPoints} pts</div> : null}
          </div>
          <div className="mt-3 flex items-center justify-between">
            {renderSubmitterInfo()}
            <div className="flex items-center gap-1">
              {roundStatus === 'voting' && renderVoteButtonGroup()}
              {roundStatus !== 'submissions' && song.submissionType === 'file' && song.songFileUrl && (
                <a href={song.songFileUrl} download onClick={(e) => e.stopPropagation()} title="Download audio file">
                  <Button variant="ghost" size="icon" className="size-8">
                    <Download className="size-5" />
                  </Button>
                </a>
              )}
              {canMarkTrollSubmissions && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-8" 
                        onClick={(e) => { e.stopPropagation(); handleTrollSubmissionToggle(); }}
                      >
                        <AlertTriangle className={cn("size-5", song.isTrollSubmission && "text-destructive")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{song.isTrollSubmission ? "Unmark as troll submission" : "Mark as troll submission"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button variant="ghost" size="icon" className="size-8" onClick={(e) => { e.stopPropagation(); onBookmark(); }}><Bookmark className={cn("size-5", song.isBookmarked && "fill-primary text-primary")} /></Button>
              <Button variant="ghost" size="icon" className="size-8" onClick={(e) => { e.stopPropagation(); onToggleComments(); }}><MessageSquare className={cn("size-5", isCommentsVisible && "fill-accent")} /></Button>
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:grid md:grid-cols-[auto_4fr_3fr_2fr_auto] items-center gap-4">
          <div className="w-10 flex items-center justify-center">
            <div className="relative w-10 h-10 flex items-center justify-center group/play" onClick={onPlaySong}>
              <span className={cn("text-muted-foreground group-hover/play:hidden", isThisSongCurrent && "hidden")}>{index + 1}</span>
              <div className={cn("absolute inset-0 items-center justify-center hidden", isThisSongCurrent ? "flex" : "group-hover/play:flex")}>
                {isThisSongPlaying ? <EqualizerIcon /> : <Play className="size-5" />}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 min-w-0 cursor-pointer" onClick={onPlaySong}>
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
            <div className="truncate">
              <p className={cn("truncate font-semibold flex items-center", isThisSongCurrent && "text-primary")}>
                {song.songTitle}
                {showListenRequirementIndicator && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Headphones className="ml-1.5 inline-block size-4 text-primary" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>You still need to listen to this song to vote.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </p>
              <p className="truncate text-sm text-muted-foreground">{song.artist}</p>
            </div>
          </div>
          <div>
            {renderSubmitterInfo()}
          </div>
          <div className={cn("text-right font-bold flex items-center justify-end gap-1.5", pointsColor)}>
            {roundStatus === "finished" ? `${songPoints} pts` : "?"}
            {song.isPenalized && (
              <TooltipProvider>
                <Tooltip><TooltipTrigger asChild><Ban className="size-4 text-warning" /></TooltipTrigger>
                  <TooltipContent><p>Submitter did not vote; positive votes annulled.</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {song.isTrollSubmission && (
              <TooltipProvider>
                <Tooltip><TooltipTrigger asChild><AlertTriangle className="size-4 text-destructive" /></TooltipTrigger>
                  <TooltipContent><p>This submission has been marked as a troll submission. Positive votes are ignored.</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center justify-center w-44 gap-1">
            {roundStatus === 'voting' ? (
              renderVoteButtonGroup()
            ) : roundStatus !== 'submissions' ? (
              isLinkSubmission ? (
                <a href={song.songLink!} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="size-8"><YouTubeIcon className="size-5 text-red-500" /></Button>
                </a>
              ) : (song.submissionType === 'file' && song.songFileUrl ? (
                <a href={song.songFileUrl} download onClick={(e) => e.stopPropagation()} title="Download audio file">
                  <Button variant="ghost" size="icon" className="size-8">
                    <Download className="size-5" />
                  </Button>
                </a>
              ) : null)
            ) : null}
            {canMarkTrollSubmissions && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={(e) => { e.stopPropagation(); handleTrollSubmissionToggle(); }}
                    >
                      <AlertTriangle className={cn("size-5", song.isTrollSubmission && "text-destructive")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{song.isTrollSubmission ? "Unmark as troll submission" : "Mark as troll submission"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button variant="ghost" size="icon" className="size-8" onClick={(e) => { e.stopPropagation(); onBookmark(); }}><Bookmark className={cn("size-5", song.isBookmarked && "fill-primary text-primary")} /></Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={(e) => { e.stopPropagation(); onToggleComments(); }}><MessageSquare className={cn("size-5", isCommentsVisible && "fill-accent")} /></Button>
          </div>
        </div>

      </div>
    </div>
  );
}
