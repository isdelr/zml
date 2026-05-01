"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  ChevronLeft,
  Crown,
  Download,
  Flag,
  Medal,
  Music4,
  Trophy,
} from "lucide-react";
import { toSvg } from "jdenticon";

import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import type { LeagueExportSummary } from "@/lib/convex/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MediaImage } from "@/components/ui/media-image";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ExportSummaryState = Exclude<LeagueExportSummary, undefined>;
type ExportSummaryData = Extract<ExportSummaryState, { status: "ok" }>;
type ExportRound = ExportSummaryData["rounds"][number];
type ExportStanding = ExportRound["standings"][number];

function buildAvatarMarkup(seed: string, size: number) {
  return { __html: toSvg(seed, size) };
}

function slugifySegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildExportFilename(leagueName: string, label: string) {
  const leagueSlug = slugifySegment(leagueName) || "league";
  const labelSlug = slugifySegment(label) || "summary";
  return `${leagueSlug}-${labelSlug}.png`;
}

async function exportNodeAsPng(node: HTMLElement, filename: string) {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
  });
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function ReportStateMessage({
  title,
  copy,
  backHref,
}: {
  title: string;
  copy: string;
  backHref?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 xl:px-8">
      <div className="overflow-hidden rounded-[2rem] border bg-card/75 shadow-sm">
        <div className="border-b bg-gradient-to-br from-primary/12 via-background to-background px-6 py-6">
          <Badge className="bg-primary/90 text-primary-foreground">
            League Export
          </Badge>
          <h1 className="mt-4 text-3xl font-bold">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy}</p>
        </div>
        {backHref ? (
          <div className="px-6 py-5">
            <Button asChild variant="outline">
              <Link href={backHref}>
                <ChevronLeft className="size-4" />
                Back to League
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 xl:px-8">
      <section className="overflow-hidden rounded-[2rem] border bg-card/70">
        <div className="border-b px-6 py-6">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="mt-4 h-10 w-72" />
          <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
        </div>
        <div className="grid gap-3 px-6 py-5 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-2xl" />
          ))}
        </div>
      </section>
      {Array.from({ length: 2 }).map((_, index) => (
        <section
          key={index}
          className="overflow-hidden rounded-[2rem] border bg-card/70"
        >
          <div className="border-b px-6 py-6">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-3 h-8 w-64" />
          </div>
          <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
            <Skeleton className="min-h-80 rounded-3xl" />
            <Skeleton className="min-h-80 rounded-3xl" />
          </div>
        </section>
      ))}
    </div>
  );
}

function StandingsList({
  standings,
  compact = false,
}: {
  standings: ExportStanding[];
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      {standings.map((standing) => (
        <div
          key={standing.userId}
          className={cn(
            "rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm",
            compact && "px-3 py-2.5",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex w-8 shrink-0 items-center justify-center pt-1 text-sm font-semibold text-muted-foreground">
              {standing.rank === 1 ? (
                <Crown className="size-4 text-warning" />
              ) : (
                <span>{standing.rank}</span>
              )}
            </div>
            <Avatar className={cn("size-10 border border-border/60", compact && "size-9")}>
              <AvatarImage src={standing.image} alt={standing.name} />
              <AvatarFallback
                dangerouslySetInnerHTML={buildAvatarMarkup(
                  standing.userId.toString(),
                  48,
                )}
              />
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold">{standing.name}</p>
                {standing.wonOnTieBreak ? (
                  <Badge
                    variant="outline"
                    className="border-primary/25 bg-primary/10 text-[10px] uppercase tracking-[0.12em] text-primary"
                  >
                    <Flag className="size-3" />
                    Tie-break
                  </Badge>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{standing.totalPoints} pts</span>
                <span>{standing.totalWins} round wins</span>
              </div>
              {standing.tieBreakSummary ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {standing.tieBreakSummary}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SubmissionGrid({ round }: { round: ExportRound }) {
  return (
    <div className="grid gap-3">
      {round.submissions.map((submission: ExportRound["submissions"][number]) => (
        <article
          key={submission.submissionId}
          className="flex items-center gap-3 rounded-3xl border border-border/60 bg-background/80 p-3 shadow-sm"
        >
          <MediaImage
            src={submission.albumArtUrl ?? "/icons/web-app-manifest-192x192.png"}
            alt={submission.songTitle}
            width={72}
            height={72}
            className="size-[4.5rem] shrink-0 rounded-2xl object-cover"
            fallbackSrc="/icons/web-app-manifest-192x192.png"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold">{submission.songTitle}</p>
              {submission.isWinner ? (
                <Badge className="bg-primary/90 text-primary-foreground">
                  Winner
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {submission.artist}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-2 rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                <Avatar className="size-5">
                  <AvatarImage
                    src={submission.submitterImage}
                    alt={submission.submitterName}
                  />
                  <AvatarFallback
                    dangerouslySetInnerHTML={buildAvatarMarkup(
                      submission.userId.toString(),
                      24,
                    )}
                  />
                </Avatar>
                <span>{submission.submitterName}</span>
              </div>
              <Badge variant="outline" className="border-primary/20 bg-primary/8">
                {submission.points} pts
              </Badge>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function RoundWinners({
  winners,
  roundTitle,
}: {
  winners: ExportRound["winners"];
  roundTitle: string;
}) {
  if (winners.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border/70 bg-background/45 px-4 py-5 text-sm text-muted-foreground">
        No recorded winners for {roundTitle}.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {winners.map((winner: ExportRound["winners"][number]) => (
        <div
          key={`${winner.userId}-${winner.songTitle}`}
          className="accent-panel rounded-3xl border p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <Avatar className="size-12 border border-background/60">
              <AvatarImage src={winner.image} alt={winner.name} />
              <AvatarFallback
                dangerouslySetInnerHTML={buildAvatarMarkup(
                  winner.userId.toString(),
                  52,
                )}
              />
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary/90 text-primary-foreground">
                  <Trophy className="size-3.5" />
                  Round Winner
                </Badge>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  {winner.points} pts
                </span>
              </div>
              <p className="mt-3 truncate text-lg font-semibold">{winner.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {winner.songTitle}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CaptureCard({
  cardId,
  onReadyChange,
  onNodeChange,
  children,
}: {
  cardId: string;
  onReadyChange: (cardId: string, ready: boolean) => void;
  onNodeChange: (cardId: string, node: HTMLDivElement | null) => void;
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onNodeChange(cardId, cardRef.current);
    return () => onNodeChange(cardId, null);
  }, [cardId, onNodeChange]);

  useEffect(() => {
    const node = cardRef.current;
    if (!node) {
      onReadyChange(cardId, false);
      return;
    }

    let disposed = false;
    let cleanupCallbacks: Array<() => void> = [];

    const evaluate = () => {
      cleanupCallbacks.forEach((cleanup) => cleanup());
      cleanupCallbacks = [];

      const images = [...node.querySelectorAll("img")];
      const pendingImages = images.filter((image) => !image.complete);

      if (pendingImages.length === 0) {
        onReadyChange(cardId, true);
        return;
      }

      onReadyChange(cardId, false);
      for (const image of pendingImages) {
        const handleDone = () => {
          if (!disposed) {
            evaluate();
          }
        };
        image.addEventListener("load", handleDone);
        image.addEventListener("error", handleDone);
        cleanupCallbacks.push(() => {
          image.removeEventListener("load", handleDone);
          image.removeEventListener("error", handleDone);
        });
      }
    };

    evaluate();

    return () => {
      disposed = true;
      cleanupCallbacks.forEach((cleanup) => cleanup());
      onReadyChange(cardId, false);
    };
  }, [cardId, onReadyChange]);

  return <div ref={cardRef}>{children}</div>;
}

function RoundExportCard({ round }: { round: ExportRound }) {
  return (
    <section className="overflow-hidden rounded-[2rem] border bg-card/75 shadow-sm">
      <div className="border-b bg-gradient-to-br from-primary/12 via-background to-background px-6 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-primary/90 text-primary-foreground">
            Round {round.roundOrder}
          </Badge>
          <Badge variant="outline">{round.submissions.length} submissions</Badge>
        </div>
        <h2 className="mt-4 text-3xl font-bold">{round.roundTitle}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {round.roundDescription}
        </p>
      </div>
      <div className="grid gap-6 p-6">
        {round.roundImageUrl ? (
          <MediaImage
            src={round.roundImageUrl}
            alt={round.roundTitle}
            width={1600}
            height={640}
            className="h-64 w-full rounded-[1.75rem] object-cover"
            fallbackSrc="/icons/web-app-manifest-192x192.png"
          />
        ) : null}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <div className="space-y-6">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Trophy className="size-4 text-primary" />
                <h3 className="text-lg font-semibold">Round Winners</h3>
              </div>
              <RoundWinners winners={round.winners} roundTitle={round.roundTitle} />
            </div>
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Music4 className="size-4 text-primary" />
                <h3 className="text-lg font-semibold">All Submissions</h3>
              </div>
              <SubmissionGrid round={round} />
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Medal className="size-4 text-primary" />
              <h3 className="text-lg font-semibold">Standings After This Round</h3>
            </div>
            <StandingsList standings={round.standings} />
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalExportCard({
  data,
}: {
  data: ExportSummaryData;
}) {
  const summaryLabel =
    data.league.finishedRoundCount === data.league.totalRounds &&
    data.league.totalRounds > 0
      ? "Final Results"
      : "Current Results";
  const champion = data.finalSummary.topFinishers[0] ?? null;

  return (
    <section className="overflow-hidden rounded-[2rem] border bg-card/75 shadow-sm">
      <div className="border-b bg-gradient-to-br from-warning/16 via-background to-primary/10 px-6 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-primary/90 text-primary-foreground">
            {summaryLabel}
          </Badge>
          <Badge variant="outline">
            {data.finalSummary.standings.length} ranked members
          </Badge>
        </div>
        <h2 className="mt-4 text-3xl font-bold">{data.league.name}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          League-wide snapshot covering every finished round plus the latest
          standings and winners.
        </p>
      </div>
      <div className="grid gap-6 p-6">
        {champion ? (
          <div className="accent-panel rounded-[1.75rem] border p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar className="size-20 border-4 border-background/70 shadow-sm">
                <AvatarImage src={champion.image} alt={champion.name} />
                <AvatarFallback
                  dangerouslySetInnerHTML={buildAvatarMarkup(
                    champion.userId.toString(),
                    96,
                  )}
                />
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-warning">
                  <Crown className="size-4 fill-current stroke-current" />
                  <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                    {summaryLabel === "Final Results" ? "League Winner" : "Current Leader"}
                  </span>
                </div>
                <h3 className="mt-2 truncate text-2xl font-bold">
                  {champion.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {champion.totalPoints} pts
                </p>
                {champion.tieBreakSummary ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {champion.tieBreakSummary}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Medal className="size-4 text-primary" />
              <h3 className="text-lg font-semibold">Final Standings</h3>
            </div>
            <StandingsList standings={data.finalSummary.standings} compact />
          </div>
          <div className="space-y-6">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Trophy className="size-4 text-primary" />
                <h3 className="text-lg font-semibold">Top Finishers</h3>
              </div>
              <div className="grid gap-3">
                {data.finalSummary.topFinishers.map(
                  (
                    finisher: ExportSummaryData["finalSummary"]["topFinishers"][number],
                  ) => (
                  <div
                    key={finisher.userId}
                    className="rounded-3xl border border-border/60 bg-background/80 p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="size-12 border border-border/60">
                        <AvatarImage src={finisher.image} alt={finisher.name} />
                        <AvatarFallback
                          dangerouslySetInnerHTML={buildAvatarMarkup(
                            finisher.userId.toString(),
                            52,
                          )}
                        />
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">#{finisher.rank}</Badge>
                          {finisher.wonOnTieBreak ? (
                            <Badge
                              variant="outline"
                              className="border-primary/25 bg-primary/10 text-primary"
                            >
                              <Flag className="size-3" />
                              Tie-break
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-3 truncate font-semibold">
                          {finisher.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {finisher.totalPoints} pts
                        </p>
                      </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Music4 className="size-4 text-primary" />
                <h3 className="text-lg font-semibold">Champion Submissions</h3>
              </div>
              <div className="grid gap-3">
                {data.finalSummary.winnerSubmissions.length > 0 ? (
                  data.finalSummary.winnerSubmissions.map(
                    (
                      submission: ExportSummaryData["finalSummary"]["winnerSubmissions"][number],
                    ) => (
                      <article
                        key={submission.submissionId}
                        className="flex items-center gap-3 rounded-3xl border border-border/60 bg-background/80 p-3 shadow-sm"
                      >
                        <MediaImage
                          src={
                            submission.albumArtUrl ??
                            "/icons/web-app-manifest-192x192.png"
                          }
                          alt={submission.songTitle}
                          width={72}
                          height={72}
                          className="size-[4.5rem] shrink-0 rounded-2xl object-cover"
                          fallbackSrc="/icons/web-app-manifest-192x192.png"
                        />
                        <div className="min-w-0 flex-1">
                          <Badge variant="secondary">{submission.roundTitle}</Badge>
                          <p className="mt-2 truncate font-semibold">
                            {submission.songTitle}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {submission.artist}
                          </p>
                          <p className="mt-2 text-xs font-semibold text-primary">
                            {submission.points} pts
                          </p>
                        </div>
                      </article>
                    ),
                  )
                ) : (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-background/45 px-4 py-5 text-sm text-muted-foreground">
                    No champion submissions to display yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LeagueExportReportPage({ leagueId }: { leagueId: string }) {
  const exportSummary = useQuery(api.leagues.getLeagueExportSummary, {
    leagueId: leagueId as Id<"leagues">,
  });
  const cardNodesRef = useRef<Record<string, HTMLDivElement | null>>({});
  const [cardReadyState, setCardReadyState] = useState<Record<string, boolean>>(
    {},
  );
  const [activeExportCardId, setActiveExportCardId] = useState<string | null>(
    null,
  );
  const [isExportingAll, setIsExportingAll] = useState(false);

  useEffect(() => {
    setCardReadyState({});
  }, [exportSummary]);

  if (exportSummary === undefined) {
    return <ReportSkeleton />;
  }

  if (exportSummary.status === "not_found") {
    return (
      <ReportStateMessage
        title="League Not Found"
        copy="This league no longer exists, or the report path is invalid."
      />
    );
  }

  if (exportSummary.status === "forbidden") {
    return (
      <ReportStateMessage
        title="Export Access Restricted"
        copy="Only league owners and managers can open this report."
        backHref={`/leagues/${leagueId}`}
      />
    );
  }

  const data = exportSummary;
  const hasFinishedRounds = data.rounds.length > 0;
  const cards = hasFinishedRounds
    ? [
        ...data.rounds.map((round: ExportRound) => ({
          id: `round-${round.roundId}`,
          label: `round-${round.roundOrder}`,
          title: `Round ${round.roundOrder}`,
          content: <RoundExportCard round={round} />,
        })),
        {
          id: "final-summary",
          label:
            data.league.finishedRoundCount === data.league.totalRounds &&
            data.league.totalRounds > 0
              ? "final-results"
              : "current-results",
          title:
            data.league.finishedRoundCount === data.league.totalRounds &&
            data.league.totalRounds > 0
              ? "Final Results"
              : "Current Results",
          content: <FinalExportCard data={data} />,
        },
      ]
    : [];
  const allCardsReady =
    cards.length > 0 && cards.every((card) => cardReadyState[card.id]);

  const handleReadyChange = (cardId: string, ready: boolean) => {
    setCardReadyState((current) => {
      if (current[cardId] === ready) {
        return current;
      }
      return {
        ...current,
        [cardId]: ready,
      };
    });
  };

  const handleNodeChange = (cardId: string, node: HTMLDivElement | null) => {
    cardNodesRef.current[cardId] = node;
  };

  const downloadCard = async (cardId: string, label: string) => {
    const node = cardNodesRef.current[cardId];
    if (!node) {
      return;
    }

    try {
      setActiveExportCardId(cardId);
      await exportNodeAsPng(
        node,
        buildExportFilename(data.league.name, label),
      );
      toast.success("Exported summary card.");
    } catch {
      toast.error("Failed to export summary card.");
    } finally {
      setActiveExportCardId(null);
    }
  };

  const downloadAllCards = async () => {
    try {
      setIsExportingAll(true);
      for (const card of cards) {
        const node = cardNodesRef.current[card.id];
        if (!node) {
          continue;
        }
        await exportNodeAsPng(
          node,
          buildExportFilename(data.league.name, card.label),
        );
      }
      toast.success("Exported every summary card.");
    } catch {
      toast.error("Failed to export all summary cards.");
    } finally {
      setIsExportingAll(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 xl:px-8">
      <section className="overflow-hidden rounded-[2rem] border bg-card/75 shadow-sm">
        <div className="border-b bg-gradient-to-br from-primary/14 via-background to-background px-6 py-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/90 text-primary-foreground">
              League Export
            </Badge>
            <Badge variant="outline">
              {data.league.finishedRoundCount} finished / {data.league.totalRounds} total rounds
            </Badge>
          </div>
          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
            {data.league.name}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {data.league.description}
          </p>
        </div>
        <div className="flex flex-col gap-5 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Members
              </p>
              <p className="mt-2 text-2xl font-bold">{data.league.memberCount}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Finished Rounds
              </p>
              <p className="mt-2 text-2xl font-bold">
                {data.league.finishedRoundCount}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Export Cards
              </p>
              <p className="mt-2 text-2xl font-bold">{cards.length}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={`/leagues/${leagueId}`}>
                <ChevronLeft className="size-4" />
                Back to League
              </Link>
            </Button>
            <Button
              onClick={downloadAllCards}
              disabled={!allCardsReady || isExportingAll || cards.length === 0}
            >
              <Download className="size-4" />
              {isExportingAll ? "Exporting..." : "Download All"}
            </Button>
          </div>
        </div>
      </section>

      {!hasFinishedRounds ? (
        <ReportStateMessage
          title="No Finished Rounds Yet"
          copy="This league does not have any completed rounds to export yet. Export cards unlock once the first round reaches finished status."
          backHref={`/leagues/${leagueId}`}
        />
      ) : null}

      {cards.map((card) => (
        <div key={card.id} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{card.title}</h2>
              <p className="text-sm text-muted-foreground">
                {cardReadyState[card.id]
                  ? "Ready to export."
                  : "Waiting for card media to finish loading."}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => downloadCard(card.id, card.label)}
              disabled={!cardReadyState[card.id] || isExportingAll}
            >
              <Download className="size-4" />
              {activeExportCardId === card.id ? "Exporting..." : "Download PNG"}
            </Button>
          </div>
          <CaptureCard
            cardId={card.id}
            onReadyChange={handleReadyChange}
            onNodeChange={handleNodeChange}
          >
            {card.content}
          </CaptureCard>
        </div>
      ))}
    </div>
  );
}
