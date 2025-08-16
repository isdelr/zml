// File: components/round/SubmissionItem.tsx

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
import { Doc, Id } from "@/convex/_generated/dataModel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import { Song } from "@/types";
import { AvatarStack } from "../AvatarStack";

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
  league: NonNullable<Awaited<ReturnType<typeof api.leagues.get>>>;
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
  const isLinkSubmission = song.submissionType === 'spotify' || song.submissionType === 'youtube';

  const otherListeners = listeners.filter(listener => listener._id !== currentUser?._id);

  const isListenRequirementMetForThisSong = useMemo(() => {
    if (!league.enforceListenPercentage || song.submissionType !== "file" || userIsSubmitter) return true;
    return listenProgress?.isCompleted || localListenProgress[song._id as Id<"submissions">];
  }, [league, localListenProgress, listenProgress, song._id, song.submissionType, userIsSubmitter]);

  const upvoteDisabledReason = useMemo(() => {
    if (roundStatus !== "voting") return "Voting is not currently open.";
    if (userIsSubmitter) return "You cannot vote on your own submission.";
    if (!canVote) return "You must submit a song to vote in this round.";
    if (hasVoted) return "Your vote for this round is final.";
    if (league.limitVotesPerSubmission && currentVoteValue >= (league.maxPositiveVotesPerSubmission ?? 1)) return `Max ${league.maxPositiveVotesPerSubmission} upvote(s) per song.`;

    if (league.enforceListenPercentage) {
      if (song.submissionType === "file" && !isListenRequirementMetForThisSong) {
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
    if (league.limitVotesPerSubmission && currentVoteValue <= -(league.maxNegativeVotesPerSubmission ?? 0)) return `Max ${league.maxNegativeVotesPerSubmission} downvote(s) per song.`;

    if (league.enforceListenPercentage) {
      if (song.submissionType === "file" && !isListenRequirementMetForThisSong) {
        return `You must listen to ${league.listenPercentage}% of this song to vote.`;
      }
      if (!isReadyToVoteOverall) {
        return "You must meet the listening requirements for all songs before you can vote.";
      }
    }

    return null;
  }, [roundStatus, userIsSubmitter, canVote, hasVoted, league, currentVoteValue, isReadyToVoteOverall, song, isListenRequirementMetForThisSong]);

  const pointsColor = song.points > 0 ? "text-green-400" : song.points < 0 ? "text-red-400" : "text-muted-foreground";

  const SubmitterInfo = () => (
    <div className="flex items-center gap-2 text-sm">
      <Avatar className="size-6">
        <AvatarImage src={roundStatus === "voting" ? undefined : song.submittedByImage ?? undefined} />
        <AvatarFallback dangerouslySetInnerHTML={{ __html: toSvg(roundStatus === "voting" ? song._id : song.submittedBy ?? song.userId, 24) }} />
      </Avatar>
      <span className="text-muted-foreground">{roundStatus === "voting" ? "Anonymous" : song.submittedBy}</span>
    </div>
  );

  const VoteButtonGroup = () => (
    <div className="flex items-center rounded-full border bg-background">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Upvote" onClick={(e) => { e.stopPropagation(); onVoteClick(1); }} disabled={!!upvoteDisabledReason}>
              <ArrowUp className={cn("size-5", currentVoteValue > 0 && "fill-green-400/20 text-green-400")} />
            </Button>
          </TooltipTrigger>
          {upvoteDisabledReason && <TooltipContent><p>{upvoteDisabledReason}</p></TooltipContent>}
        </Tooltip>
        <span className={cn("w-6 text-center text-sm font-bold", currentVoteValue > 0 ? "text-green-400" : currentVoteValue < 0 ? "text-red-400" : "text-muted-foreground")}>
            {currentVoteValue !== 0 && (currentVoteValue > 0 ? `+${currentVoteValue}` : currentVoteValue)}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Downvote" onClick={(e) => { e.stopPropagation(); onVoteClick(-1); }} disabled={!!downvoteDisabledReason}>
              <ArrowDown className={cn("size-5", currentVoteValue < 0 && "fill-red-400/20 text-red-400")} />
            </Button>
          </TooltipTrigger>
          {downvoteDisabledReason && <TooltipContent><p>{downvoteDisabledReason}</p></TooltipContent>}
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  return (
    <div className="border-b border-border last:border-b-0">
      <div className={cn("p-3 transition-colors", isThisSongCurrent ? "bg-accent" : "hover:bg-accent/50", isCommentsVisible && "bg-accent/50")}>
        {/* Mobile Layout */}
        <div className="md:hidden">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0 cursor-pointer" onClick={onPlaySong}>
              <Image src={song.albumArtUrl} alt={song.songTitle} width={48} height={48} className="rounded" />
              {otherListeners && otherListeners.length > 0 && (
                <div className="absolute bottom-0 right-0 origin-bottom-right scale-75">
                  <AvatarStack users={otherListeners} />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                {isThisSongPlaying ? <Pause className="size-6" /> : <Play className="size-6" />}
              </div>
            </div>
            <div className="min-w-0 flex-1 cursor-pointer" onClick={onPlaySong}>
              <p className={cn("truncate font-semibold", isThisSongCurrent && "text-primary")}>{song.songTitle}</p>
              <p className="truncate text-sm text-muted-foreground">{song.artist}</p>
            </div>
            {isThisSongPlaying ? <EqualizerIcon /> : roundStatus === 'finished' ? <div className={cn("text-right text-sm font-bold", pointsColor)}>{song.points} pts</div> : null}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <SubmitterInfo />
            <div className="flex items-center gap-1">
              {roundStatus === 'voting' && <VoteButtonGroup />}
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
              <Image src={song.albumArtUrl} alt={song.songTitle} width={40} height={40} className="rounded" />
              {otherListeners && otherListeners.length > 0 && (
                <div className="absolute bottom-[-4px] right-[-4px] origin-bottom-right scale-50">
                  <AvatarStack users={otherListeners} />
                </div>
              )}
            </div>
            <div className="truncate">
              <p className={cn("truncate font-semibold", isThisSongCurrent && "text-primary")}>{song.songTitle}</p>
              <p className="truncate text-sm text-muted-foreground">{song.artist}</p>
            </div>
          </div>
          <div>
            <SubmitterInfo />
          </div>
          <div className={cn("text-right font-bold flex items-center justify-end gap-1.5", pointsColor)}>
            {roundStatus === "finished" ? `${song.points} pts` : "?"}
            {song.isPenalized && (
              <TooltipProvider>
                <Tooltip><TooltipTrigger asChild><Ban className="size-4 text-yellow-500" /></TooltipTrigger>
                  <TooltipContent><p>Submitter did not vote; positive votes annulled.</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center justify-center w-44 gap-1">
            {roundStatus === 'voting' ? (
              <VoteButtonGroup />
            ) : isLinkSubmission ? (
              <a href={song.songLink!} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="size-8">{song.submissionType === 'spotify' ? <FaSpotify className="size-5 text-green-500"/> : <FaYoutube className="size-5 text-red-500"/>}</Button>
              </a>
            ) : null}
            <Button variant="ghost" size="icon" className="size-8" onClick={(e) => { e.stopPropagation(); onBookmark(); }}><Bookmark className={cn("size-5", song.isBookmarked && "fill-primary text-primary")} /></Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={(e) => { e.stopPropagation(); onToggleComments(); }}><MessageSquare className={cn("size-5", isCommentsVisible && "fill-accent")} /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}