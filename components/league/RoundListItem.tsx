"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatShortDateTime } from "@/lib/utils";
import { Clock, Crown, Send, Vote } from "lucide-react";
import Link from "next/link";
import { AvatarStack } from "../AvatarStack";
import type { RoundForLeague } from "@/lib/convex/types";

type RoundListItemProps = {
  round: RoundForLeague;
  leagueId: string;
  isSelected: boolean;
};

export function RoundListItem({ round, leagueId, isSelected }: RoundListItemProps) {
  const statusInfo =
    round.status === "scheduled"
      ? {
        icon: <Clock className="size-4 text-muted-foreground" />,
        label: "Scheduled",
        textColor: "text-muted-foreground",
      }
      : round.status === "submissions"
      ? {
        icon: <Send className="size-4 text-success" />,
        label: "Submissions",
        textColor: "text-success",
      }
      : round.status === "voting"
        ? {
          icon: <Vote className="size-4 text-info" />,
          label: "Voting",
          textColor: "text-info",
        }
        : {
          icon: (
            <div className="flex size-4 items-center justify-center">
              <div className="size-2 rounded-full bg-muted-foreground" />
            </div>
          ),
          label: "Finished",
          textColor: "text-muted-foreground",
        };

  const renderWinnerPoints = (points: number) => (
    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-500">
      {points} pts
    </span>
  );

  const renderFinishedSummary = (isMobile: boolean) =>
    round.winners && round.winners.length > 1 ? (
      <div className="flex min-w-0 items-center gap-2 truncate">
        <Crown className="size-3.5 shrink-0 text-amber-500" />
        {renderWinnerPoints(round.winners[0]?.points ?? 0)}
        <AvatarStack users={round.winners.map((winner) => ({ name: winner.name, image: winner.image }))} />
        <p className="truncate font-semibold text-foreground/80">
          Tie: {round.winners.map((winner) => winner.name).join(", ")}
        </p>
      </div>
    ) : (
      round.winner && (
        <div className="flex min-w-0 items-center gap-2 truncate">
          <Crown className="size-3.5 shrink-0 text-amber-500" />
          {renderWinnerPoints(round.winner.points)}
          <Avatar className="size-4 shrink-0">
            <AvatarImage src={round.winner.image ?? undefined} />
            <AvatarFallback>{round.winner.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <p className="truncate font-semibold text-foreground/80">
            {round.winner.name}
          </p>
          <span className={cn("truncate text-muted-foreground", !isMobile && "hidden lg:inline")}>
            - &quot;{round.winner.songTitle}&quot;
          </span>
        </div>
      )
    );

  const renderMobileSecondaryInfo = () => (
    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
      {round.status === "scheduled" && (
        <div className="flex items-center gap-1.5">
          <Clock className="size-3" />
          <span>Starts {formatShortDateTime(round.submissionStartsAt ?? round.submissionDeadline)}</span>
        </div>
      )}
      {round.status === "submissions" && (
        <div className="flex items-center gap-1.5">
          <Clock className="size-3" />
          <span>Ends {formatShortDateTime(round.submissionDeadline)}</span>
        </div>
      )}
      {round.status === "voting" && (
        <div className="flex items-center gap-1.5">
          <Clock className="size-3" />
          <span>Ends {formatShortDateTime(round.votingDeadline)}</span>
        </div>
      )}
      {round.status === "finished" && renderFinishedSummary(true)}
    </div>
  );

  return (
    <Link
      href={`/leagues/${leagueId}/round/${round._id}`}
      className={cn(
        "group block rounded-lg border p-3 transition-colors",
        isSelected ? "bg-accent border-primary/50" : "hover:bg-accent",
      )}
    >
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {statusInfo.icon}
            <p className="truncate font-semibold">{round.title}</p>
          </div>
          <AvatarStack
            max={5}
            users={
              (
                round.status === "submissions"
                  ? round.submitters
                  : round.status === "voting"
                    ? round.voters
                    : []
              ) ?? []
            }
          />
        </div>
        {renderMobileSecondaryInfo()}
      </div>

      <div className="hidden md:grid md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-4">
        <div className="flex items-center gap-3">
          {statusInfo.icon}
          <span className={cn("font-semibold", statusInfo.textColor)}>{statusInfo.label}</span>
        </div>
        <div>
          <p className="truncate font-semibold">{round.title}</p>
        </div>
        <div className="flex min-w-0 items-center text-sm text-muted-foreground">
          {round.status === "scheduled" && (
            <>
              <Clock className="mr-2 size-4" />
              <span>
                Starts{" "}
                {formatShortDateTime(
                  round.submissionStartsAt ?? round.submissionDeadline,
                )}
              </span>
            </>
          )}
          {round.status === "submissions" && (
            <>
              <Clock className="mr-2 size-4" />
              <span>Ends {formatShortDateTime(round.submissionDeadline)}</span>
            </>
          )}
          {round.status === "voting" && (
            <>
              <Clock className="mr-2 size-4" />
              <span>Ends {formatShortDateTime(round.votingDeadline)}</span>
            </>
          )}
          {round.status === "finished" && renderFinishedSummary(false)}
        </div>
      </div>
    </Link>
  );
}
