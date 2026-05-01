"use client";

import { useQuery } from "convex/react";
import { Crown, Disc3, Flag, Medal, Trophy } from "lucide-react";
import { toSvg } from "jdenticon";

import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import type { LeagueCompletionSummary } from "@/lib/convex/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MediaImage } from "@/components/ui/media-image";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type CompletionSummaryData = Exclude<LeagueCompletionSummary, undefined>;
type Finisher = CompletionSummaryData["topFinishers"][number];
type WinnerSubmission = CompletionSummaryData["winnerSubmissions"][number];

interface LeagueWinnersCardProps {
  leagueId: Id<"leagues">;
}

function TieBreakBadge({
  wonOnTieBreak,
  tieBreakSummary,
  className,
}: {
  wonOnTieBreak: boolean;
  tieBreakSummary: string | null;
  className?: string;
}) {
  if (!wonOnTieBreak) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "border-primary/25 bg-primary/10 text-[10px] uppercase tracking-[0.12em] text-primary/80 dark:text-primary",
            className,
          )}
        >
          <Flag className="size-3" />
          Tie-break
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tieBreakSummary ?? "Won tie-break on round placements."}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function FinisherAvatar({
  finisher,
  sizeClassName,
}: {
  finisher: Finisher;
  sizeClassName: string;
}) {
  return (
    <Avatar className={sizeClassName}>
      <AvatarImage src={finisher.image} alt={finisher.name} />
      <AvatarFallback
        dangerouslySetInnerHTML={{ __html: toSvg(finisher.userId, 96) }}
      />
    </Avatar>
  );
}

function RunnerUpCard({
  finisher,
  accent,
}: {
  finisher: Finisher;
  accent: "silver" | "bronze";
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <FinisherAvatar finisher={finisher} sizeClassName="size-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "border-transparent px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]",
                accent === "silver"
                  ? "bg-slate-500/10 text-slate-600 dark:text-slate-300"
                  : "bg-amber-700/10 text-amber-700 dark:text-amber-300",
              )}
            >
              <Medal className="size-3" />
              {finisher.rank === 2 ? "2nd Place" : "3rd Place"}
            </Badge>
            <TieBreakBadge
              wonOnTieBreak={finisher.wonOnTieBreak}
              tieBreakSummary={finisher.tieBreakSummary}
            />
          </div>
          <p className="mt-3 truncate text-lg font-semibold">{finisher.name}</p>
          <p className="text-sm text-muted-foreground">
            {finisher.totalPoints} pts
          </p>
        </div>
      </div>
    </div>
  );
}

function WinnerSubmissionCard({
  submission,
}: {
  submission: WinnerSubmission;
}) {
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 p-3 shadow-sm transition-colors hover:bg-accent/40">
      <MediaImage
        src={submission.albumArtUrl ?? "/icons/web-app-manifest-192x192.png"}
        alt={submission.songTitle}
        width={64}
        height={64}
        className="size-16 shrink-0 rounded-xl object-cover"
        fallbackSrc="/icons/web-app-manifest-192x192.png"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
            {submission.roundTitle}
          </Badge>
          <span className="text-xs font-semibold text-primary/80 dark:text-primary">
            {submission.points} pts
          </span>
        </div>
        <p className="mt-2 truncate font-semibold">{submission.songTitle}</p>
        <p className="truncate text-sm text-muted-foreground">
          {submission.artist}
        </p>
      </div>
    </article>
  );
}

export function LeagueWinnersCardContent({
  summary,
}: {
  summary: CompletionSummaryData;
}) {
  if (!summary.isLeagueFinished || summary.topFinishers.length === 0) {
    return null;
  }

  const champion = summary.topFinishers[0];
  const runnersUp = summary.topFinishers.slice(1, 3);

  if (!champion) {
    return null;
  }

  return (
    <section className="mb-6 overflow-hidden rounded-[1.75rem] border bg-card/70 shadow-sm backdrop-blur-sm">
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-warning/15 via-background to-primary/10 px-5 py-6 sm:px-6">
        <div className="absolute inset-y-0 right-0 w-48 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -left-16 top-10 size-36 rounded-full bg-warning/10 blur-3xl" />
        <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <div className="rounded-[1.75rem] border border-primary/15 bg-background/80 p-5 shadow-sm backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/90 text-primary-foreground">
                <Trophy className="size-3.5" />
                League Complete
              </Badge>
              <TieBreakBadge
                wonOnTieBreak={champion.wonOnTieBreak}
                tieBreakSummary={champion.tieBreakSummary}
              />
            </div>
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
              <FinisherAvatar finisher={champion} sizeClassName="size-24 shrink-0 border-4 border-background/80 shadow-lg" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-warning">
                  <Crown className="size-5 fill-current stroke-current" />
                  <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                    1st Place
                  </span>
                </div>
                <h2 className="mt-2 truncate text-2xl font-bold sm:text-3xl">
                  {champion.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Finished on top of the final league leaderboard.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary/80 dark:text-primary">
                  <Disc3 className="size-4" />
                  {champion.totalPoints} pts
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3">
            {runnersUp[0] ? (
              <RunnerUpCard finisher={runnersUp[0]} accent="silver" />
            ) : null}
            {runnersUp[1] ? (
              <RunnerUpCard finisher={runnersUp[1]} accent="bronze" />
            ) : null}
          </div>
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Champion Submissions</h3>
            <p className="text-sm text-muted-foreground">
              Every song from {champion.name}&apos;s winning run.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {summary.winnerSubmissions.length}{" "}
            {summary.winnerSubmissions.length === 1 ? "submission" : "submissions"}
          </span>
        </div>
        {summary.winnerSubmissions.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {summary.winnerSubmissions.map((submission) => (
              <WinnerSubmissionCard
                key={submission.submissionId}
                submission={submission}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            No champion submissions to display.
          </div>
        )}
      </div>
    </section>
  );
}

export function LeagueWinnersCard({ leagueId }: LeagueWinnersCardProps) {
  const summary = useQuery(api.leagues.getLeagueCompletionSummary, { leagueId });

  if (summary === undefined) {
    return (
      <section className="mb-6 overflow-hidden rounded-[1.75rem] border bg-card/70">
        <div className="space-y-4 border-b px-5 py-6 sm:px-6">
          <Skeleton className="h-6 w-32 rounded-full" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Skeleton className="size-24 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
        </div>
        <div className="grid gap-3 px-5 py-5 md:grid-cols-2 xl:grid-cols-3 sm:px-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-2xl border p-3"
            >
              <Skeleton className="size-16 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return <LeagueWinnersCardContent summary={summary} />;
}
