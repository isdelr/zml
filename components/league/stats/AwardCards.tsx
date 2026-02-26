"use client";

import { useEffect, useState, type ReactNode } from "react";
import NextImage from "next/image";
import { Medal, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toSvg } from "jdenticon";

function useCountUp(target: number | null | undefined, duration = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target == null) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const progress = Math.min(1, (t - start) / duration);
      setValue(Math.round(progress * target));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

type UserMeta = { totalRounds?: number; rounds?: number; average?: number };
export type UserAward =
  | { name?: string | null; image?: string | null; count: number; meta?: UserMeta }
  | null
  | undefined;

export type SongAward =
  | {
      songTitle: string;
      artist: string;
      albumArtUrl: string | null;
      submittedBy: string;
      count?: number;
      score?: number;
    }
  | null
  | undefined;

export type RoundAward =
  | {
      roundId: string;
      title: string;
      imageUrl: string | null;
      metric: number;
      submissions: number;
      totalUpvotes: number;
    }
  | null
  | undefined;

export function UserRow({
  icon,
  title,
  desc,
  user,
  valueLabel,
  highlight = false,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  user: UserAward;
  valueLabel?: (u: NonNullable<UserAward>) => string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
        highlight && "border-primary/50 bg-gradient-to-br from-primary/5 to-transparent",
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div
            className={cn(
              "rounded-lg p-2 transition-colors",
              highlight ? "bg-primary/20" : "bg-muted",
            )}
          >
            {icon}
          </div>
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        {!user ? (
          <div className="flex items-center gap-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">Not enough data yet.</div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Avatar className="size-16 ring-2 ring-primary/20 ring-offset-2 ring-offset-background transition-all group-hover:ring-primary/40">
              <AvatarImage src={user.image ?? undefined} />
              <AvatarFallback>
                <div dangerouslySetInnerHTML={{ __html: toSvg(user.name ?? "anon", 64) }} />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold">{user.name}</p>
              <p className="text-sm font-medium text-primary">
                {valueLabel ? valueLabel(user) : `${user.count}`}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SongRow({
  icon,
  title,
  desc,
  song,
  valueSuffix,
  highlight = false,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  song: SongAward;
  valueSuffix?: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
        highlight && "border-primary/50 bg-gradient-to-br from-primary/5 to-transparent",
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div
            className={cn(
              "rounded-lg p-2 transition-colors",
              highlight ? "bg-primary/20" : "bg-muted",
            )}
          >
            {icon}
          </div>
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        {!song ? (
          <div className="flex items-center gap-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">Not enough data yet.</div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="relative transition-transform group-hover:scale-105">
              <NextImage
                src={song.albumArtUrl || "/icons/web-app-manifest-192x192.png"}
                alt={song.songTitle}
                width={80}
                height={80}
                className="rounded-lg shadow-md"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">{song.songTitle}</p>
              <p className="truncate text-sm text-muted-foreground">{song.artist}</p>
              <p className="truncate text-xs text-muted-foreground/70">by {song.submittedBy}</p>
            </div>
            <div className="shrink-0 text-right">
              <div
                className={cn(
                  "rounded-full px-3 py-1 text-lg font-bold",
                  highlight ? "bg-primary/20 text-primary" : "bg-muted",
                )}
              >
                {song.count ?? song.score ?? 0}
                {valueSuffix}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RoundRow({
  icon,
  title,
  desc,
  round,
  metricSuffix,
  metricFormatter,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  round: RoundAward;
  metricSuffix?: string;
  metricFormatter?: (x: number) => string;
}) {
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="rounded-lg bg-muted p-2 transition-colors">{icon}</div>
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        {!round ? (
          <div className="flex items-center gap-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">Not enough data yet.</div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="relative transition-transform group-hover:scale-105">
              <NextImage
                src={round.imageUrl || "/icons/web-app-manifest-192x192.png"}
                alt={round.title}
                width={80}
                height={80}
                className="rounded-lg shadow-md"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">{round.title}</p>
              <p className="text-sm text-muted-foreground">
                {round.submissions} songs • {round.totalUpvotes} upvotes
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="rounded-full bg-muted px-3 py-1 text-lg font-bold">
                {metricFormatter ? metricFormatter(round.metric) : round.metric}
                {metricSuffix}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PodiumBar({
  user,
  rank,
  points,
}: {
  user: { userId: string; name: string; image?: string };
  rank: number;
  points: number;
}) {
  const count = useCountUp(points);

  const heights = {
    1: "h-48",
    2: "h-40",
    3: "h-32",
  };

  const medalColors = {
    1: "text-warning",
    2: "text-muted-foreground",
    3: "text-primary",
  };

  const bgGradients = {
    1: "bg-gradient-to-b from-warning/20 to-warning/10",
    2: "bg-gradient-to-b from-muted-foreground/20 to-muted-foreground/10",
    3: "bg-gradient-to-b from-primary/20 to-primary/10",
  };

  const heightClass = heights[rank as keyof typeof heights];
  const medalColor = medalColors[rank as keyof typeof medalColors];
  const bgGradient = bgGradients[rank as keyof typeof bgGradients];

  return (
    <div
      className="flex animate-in flex-col items-center gap-3 fade-in slide-in-from-bottom-4 duration-700"
      style={{ animationDelay: `${rank * 100}ms` }}
    >
      <div className="relative">
        <Avatar
          className={cn(
            "size-20 ring-4 transition-all duration-300 hover:scale-110",
            rank === 1
              ? "ring-warning/50"
              : rank === 2
                ? "ring-muted-foreground/50"
                : "ring-primary/50",
          )}
        >
          <AvatarImage src={user.image ?? undefined} />
          <AvatarFallback>
            <div dangerouslySetInnerHTML={{ __html: toSvg(user.userId, 80) }} />
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "absolute -right-2 -top-2 rounded-full p-2 shadow-lg",
            rank === 1 ? "bg-warning" : rank === 2 ? "bg-muted-foreground" : "bg-primary",
          )}
        >
          <Medal className="size-5 text-white" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div
          className={cn(
            "relative w-32 overflow-hidden rounded-t-xl transition-all duration-500",
            heightClass,
            bgGradient,
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
          <div className="absolute left-1/2 top-4 -translate-x-1/2">
            <div className={cn("text-4xl font-bold", medalColor)}>
              {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
            </div>
          </div>
        </div>
        <div className="space-y-1 text-center">
          <p className="w-32 truncate text-base font-bold">{user.name}</p>
          <p className={cn("text-2xl font-extrabold", medalColor)}>{count}</p>
          <p className="text-xs text-muted-foreground">points</p>
        </div>
      </div>
    </div>
  );
}

export function Podium({
  standings,
}: {
  standings: { userId: string; name: string; image?: string; totalPoints: number }[] | undefined;
}) {
  if (!standings || standings.length === 0) return null;
  const top3 = standings.slice(0, 3);
  const podiumOrder = (
    top3.length >= 2 ? [top3[1], top3[0], top3[2]] : top3
  ).filter((player): player is (typeof top3)[number] => Boolean(player));

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-primary/5">
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-orange-500/5" />
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-3 text-2xl">
          <div className="rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 p-3">
            <Trophy className="size-6 text-white" />
          </div>
          Final Podium
        </CardTitle>
        <CardDescription>League champions ranked by total points</CardDescription>
      </CardHeader>
      <CardContent className="relative">
        <div className="flex items-end justify-center gap-8 py-4">
          {podiumOrder.map((player) => {
            const actualRank = top3.indexOf(player) + 1;
            return (
              <PodiumBar
                key={player.userId}
                user={{ userId: player.userId, name: player.name, image: player.image }}
                rank={actualRank}
                points={player.totalPoints}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
