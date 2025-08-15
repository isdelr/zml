// File: components/league/RoundListItem.tsx

"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDeadline } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Clock, Crown, Music, Send, Vote } from "lucide-react";
import Link from "next/link";
import { AvatarStack } from "../AvatarStack";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

// Define a more specific type for the round prop
type RoundListItemProps = {
  round: {
    _id: string;
    title: string;
    status: "submissions" | "voting" | "finished";
    submissionDeadline: number;
    votingDeadline: number;
    submissionCount: number;
    voterCount: number;
    leagueMemberCount: number;
    winner?: { name: string; image: string | null; songTitle: string; points: number } | null;
    submitters?: { name: string | null; image: string | null }[];
    voters?: { name: string | null; image: string | null }[];
  };
  leagueId: string;
  isSelected: boolean;
};

export function RoundListItem({ round, leagueId, isSelected }: RoundListItemProps) {
  const getStatusInfo = () => {
    switch (round.status) {
      case "submissions":
        return {
          icon: <Send className="size-4 text-green-500" />,
          label: "Submissions",
          textColor: "text-green-500"
        };
      case "voting":
        return {
          icon: <Vote className="size-4 text-blue-500" />,
          label: "Voting",
          textColor: "text-blue-500"
        };
      case "finished":
        return {
          icon: <div className="size-4 flex items-center justify-center"><div className="size-2 rounded-full bg-muted-foreground"/></div>,
          label: "Finished",
          textColor: "text-muted-foreground"
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Link
      href={`/leagues/${leagueId}/round/${round._id}`}
      className={cn(
        "group grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_2fr_1.5fr_1.5fr_auto] items-center gap-4 rounded-lg border p-3 transition-colors",
        isSelected ? "bg-accent border-primary/50" : "hover:bg-accent"
      )}
    >
      {/* Status Column */}
      <div className="flex items-center gap-3">
        <div className="hidden md:block">{statusInfo.icon}</div>
        <div className="flex flex-col">
          <span className={cn("font-semibold", statusInfo.textColor)}>{statusInfo.label}</span>
          <span className="md:hidden text-xs text-muted-foreground truncate max-w-24">{round.title}</span>
        </div>
      </div>

      {/* Title Column (Desktop) */}
      <div className="hidden md:block">
        <p className="font-semibold truncate">{round.title}</p>
      </div>

      {/* Dynamic Info Column */}
      <div className="hidden md:flex items-center text-sm text-muted-foreground">
        {round.status === "submissions" && (
          <>
            <Clock className="mr-2 size-4" />
            <span>Ends {formatDeadline(round.submissionDeadline)}</span>
          </>
        )}
        {round.status === "voting" && (
          <>
            <Clock className="mr-2 size-4" />
            <span>Ends {formatDeadline(round.votingDeadline)}</span>
          </>
        )}
        {round.status === "finished" && round.winner && (
          <div className="flex items-center gap-2 truncate">
            <Crown className="size-4 text-amber-500 flex-shrink-0" />
            <Avatar className="size-5 flex-shrink-0">
              <AvatarImage src={round.winner.image ?? undefined} />
              <AvatarFallback>{round.winner.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <p className="font-semibold text-foreground truncate">{round.winner.name}</p>
            <span className="truncate hidden lg:inline">- &#34;{round.winner.songTitle}&#34;</span>
          </div>
        )}
      </div>

      {/* Participation Column */}
      <div className="flex items-center justify-end md:justify-start">
        {round.status === "submissions" && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-2">
                  <AvatarStack users={round.submitters ?? []} />
                  <span className="text-sm font-medium">{round.submissionCount}/{round.leagueMemberCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{round.submissionCount} of {round.leagueMemberCount} members have submitted.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {round.status === 'voting' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-2">
                  <AvatarStack users={round.voters ?? []} />
                  <span className="text-sm font-medium">{round.voterCount}/{round.leagueMemberCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{round.voterCount} of {round.leagueMemberCount} members have voted.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {round.status === 'finished' && round.winner && (
          <div className="flex items-center gap-1.5 text-sm font-bold">
            <Music className="size-4 text-muted-foreground"/>
            <span>{round.winner.points} pts</span>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="flex justify-end">
        <Button size="sm" variant={isSelected ? "default" : "secondary"} className="group-hover:bg-primary group-hover:text-primary-foreground">
          {round.status === 'submissions' && 'Submit'}
          {round.status === 'voting' && 'Vote'}
          {round.status === 'finished' && 'Results'}
        </Button>
      </div>
    </Link>
  );
}