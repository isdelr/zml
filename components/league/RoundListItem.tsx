"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDeadline } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Clock, Crown, Music, Send, Vote } from "lucide-react";
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
    round.status === "submissions"
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

  const renderMobileSecondaryInfo = () => (
    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
      {round.status === "submissions" && (
        <>
          <div className="flex items-center gap-1.5">
            <Clock className="size-3" /> Ends {formatDeadline(round.submissionDeadline)}
          </div>
          <div className="flex items-center gap-1.5">
            {submitterCount}/{round.leagueMemberCount} submitted
          </div>
        </>
      )}
      {round.status === "voting" && (
        <>
          <div className="flex items-center gap-1.5">
            <Clock className="size-3" /> Ends {formatDeadline(round.votingDeadline)}
          </div>
          <div className="flex items-center gap-1.5">
            {round.voterCount}/{round.leagueMemberCount} voted
          </div>
        </>
      )}
      {round.status === "finished" && (
        round.winners && round.winners.length > 1 ? (
          <div className="flex items-center gap-2 truncate">
            <Crown className="size-3 text-amber-500 flex-shrink-0" />
            <AvatarStack users={round.winners.map(w => ({ name: w.name, image: w.image }))} />
            <p className="font-semibold text-foreground/80 truncate">Tie: {round.winners.map(w => w.name).join(", ")}</p>
          </div>
        ) : (
          round.winner && (
            <div className="flex items-center gap-2 truncate">
              <Crown className="size-3 text-amber-500 flex-shrink-0" />
              <Avatar className="size-4 flex-shrink-0">
                <AvatarImage src={round.winner.image ?? undefined} />
                <AvatarFallback>{round.winner.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <p className="font-semibold text-foreground/80 truncate">{round.winner.name}</p>
              <span className="truncate">- “{round.winner.songTitle}”</span>
            </div>
          )
        )
      )}
    </div>
  );

  // Derive an estimated submitter count from counters to avoid heavy server reads
  const requiredPerUser = round.leagueMemberCount > 0 && round.expectedTrackCount
    ? round.expectedTrackCount / round.leagueMemberCount
    : 1;
  const submitterCount = Math.min(
    round.leagueMemberCount,
    Math.floor(round.submissionCount / (requiredPerUser || 1)),
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
            users={(round.status === "submissions" ? round.submitters : round.voters) ?? []}
          />
        </div>
        {renderMobileSecondaryInfo()}
      </div>

      <div className="hidden md:grid md:grid-cols-[auto_2fr_1.5fr_1.5fr_auto] items-center gap-4">
        <div className="flex items-center gap-3">
          {statusInfo.icon}
          <span className={cn("font-semibold", statusInfo.textColor)}>{statusInfo.label}</span>
        </div>
        <div>
          <p className="font-semibold truncate">{round.title}</p>
        </div>
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
          {round.status === "finished" && (
            round.winners && round.winners.length > 1 ? (
              <div className="flex items-center gap-2 truncate">
                <Crown className="size-4 text-amber-500 flex-shrink-0" />
                <AvatarStack users={round.winners.map(w => ({ name: w.name, image: w.image }))} />
                <p className="font-semibold text-foreground truncate">Tie: {round.winners.map(w => w.name).join(", ")}</p>
              </div>
            ) : (
              round.winner && (
                <div className="flex items-center gap-2 truncate">
                  <Crown className="size-4 text-amber-500 flex-shrink-0" />
                  <Avatar className="size-5 flex-shrink-0">
                    <AvatarImage src={round.winner.image ?? undefined} />
                    <AvatarFallback>{round.winner.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <p className="font-semibold text-foreground truncate">{round.winner.name}</p>
                  <span className="truncate hidden lg:inline">- “{round.winner.songTitle}”</span>
                </div>
              )
            )
          )}
        </div>
        <div className="flex items-center justify-start">
          {(round.status === "submissions" || round.status === "voting") && (
            <div className="flex items-center gap-2">
              <AvatarStack
                users={(round.status === "submissions" ? round.submitters : round.voters) ?? []}
              />
              <span className="text-sm font-medium">
{round.status === "submissions"
  ? `${submitterCount}/${round.leagueMemberCount}`
  : `${round.voterCount}/${round.leagueMemberCount}`}
</span>
            </div>
          )}
          {round.status === "finished" && (
            round.winners && round.winners.length > 1 ? (
              <div className="flex items-center gap-1.5 text-sm font-bold">
                <Music className="size-4 text-muted-foreground" />
                <span>{round.winners[0]?.points ?? 0} pts · tie</span>
              </div>
            ) : (
              round.winner && (
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <Music className="size-4 text-muted-foreground" />
                  <span>{round.winner.points} pts</span>
                </div>
              )
            )
          )}
        </div>
      </div>
    </Link>
  );
}
