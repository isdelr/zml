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
          textColor: "text-green-500",
        };
      case "voting":
        return {
          icon: <Vote className="size-4 text-blue-500" />,
          label: "Voting",
          textColor: "text-blue-500",
        };
      case "finished":
        return {
          icon: (
            <div className="flex size-4 items-center justify-center">
              <div className="size-2 rounded-full bg-muted-foreground" />
            </div>
          ),
          label: "Finished",
          textColor: "text-muted-foreground",
        };
    }
  };

  const statusInfo = getStatusInfo();

  const renderMobileSecondaryInfo = () => (
    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
      {round.status === 'submissions' && (
        <>
          <div className="flex items-center gap-1.5"><Clock className="size-3" /> Ends {formatDeadline(round.submissionDeadline)}</div>
          <div className="flex items-center gap-1.5">{round.submissionCount}/{round.leagueMemberCount} submitted</div>
        </>
      )}
      {round.status === 'voting' && (
        <>
          <div className="flex items-center gap-1.5"><Clock className="size-3" /> Ends {formatDeadline(round.votingDeadline)}</div>
          <div className="flex items-center gap-1.5">{round.voterCount}/{round.leagueMemberCount} voted</div>
        </>
      )}
      {round.status === 'finished' && round.winner && (
        <div className="flex items-center gap-2 truncate">
          <Crown className="size-3 text-amber-500 flex-shrink-0" />
          <Avatar className="size-4 flex-shrink-0">
            <AvatarImage src={round.winner.image ?? undefined} />
            <AvatarFallback>{round.winner.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <p className="font-semibold text-foreground/80 truncate">{round.winner.name}</p>
          <span className="truncate">- &#34;{round.winner.songTitle}&#34;</span>
        </div>
      )}
    </div>
  );

  return (
    <Link
      href={`/leagues/${leagueId}/round/${round._id}`}
      className={cn(
        "group block rounded-lg border p-3 transition-colors",
        isSelected ? "bg-accent border-primary/50" : "hover:bg-accent"
      )}
    >
      {/* Mobile Layout: Two Rows */}
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {statusInfo.icon}
            <p className="truncate font-semibold">{round.title}</p>
          </div>
          <AvatarStack max={5} users={(round.status === 'submissions' ? round.submitters : round.voters) ?? []} />
        </div>
        {renderMobileSecondaryInfo()}
      </div>

      {/* Desktop Layout: Single Row Grid */}
      <div className="hidden md:grid md:grid-cols-[auto_2fr_1.5fr_1.5fr_auto] items-center gap-4">
        {/* Status Column */}
        <div className="flex items-center gap-3">
          {statusInfo.icon}
          <span className={cn("font-semibold", statusInfo.textColor)}>{statusInfo.label}</span>
        </div>

        {/* Title Column */}
        <div>
          <p className="font-semibold truncate">{round.title}</p>
        </div>

        {/* Dynamic Info Column */}
        <div className="flex items-center text-sm text-muted-foreground">
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
        <div className="flex items-center justify-start">
          {(round.status === "submissions" || round.status === 'voting') && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-2">
                    <AvatarStack users={(round.status === 'submissions' ? round.submitters : round.voters) ?? []} />
                    <span className="text-sm font-medium">
                      {round.status === 'submissions' ? round.submissionCount : round.voterCount}/{round.leagueMemberCount}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {round.status === 'submissions'
                      ? `${round.submissionCount} of ${round.leagueMemberCount} members have submitted.`
                      : `${round.voterCount} of ${round.leagueMemberCount} members have voted.`
                    }
                  </p>
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
      </div>
    </Link>
  );
}