"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import {
  Bookmark,
  Crown,
  Gauge,
  Medal,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
  Target,
  Scale,
  ListMusic,
  Download,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Skeleton } from "./ui/skeleton";
import NextImage from "next/image";
import { toSvg } from "jdenticon";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Pie, PieChart, Tooltip, Legend, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { toPng } from "html-to-image";

// Simple number animation hook
function useCountUp(target: number | null | undefined, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target == null) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setValue(Math.round(p * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

type UserMeta = { totalRounds?: number; rounds?: number; average?: number };
type UserAward =
  | { name?: string | null; image?: string | null; count: number; meta?: UserMeta }
  | null
  | undefined;

// Types for league stats used in this view
interface TopSong {
  songTitle: string;
  artist: string;
  albumArtUrl: string | null;
  score: number;
  submittedBy: string;
}
interface SongAward {
  songTitle: string;
  artist: string;
  albumArtUrl: string | null;
  submittedBy: string;
  count: number;
}
interface RoundAward {
  roundId: string;
  title: string;
  imageUrl: string | null;
  metric: number;
  submissions: number;
  totalUpvotes: number;
}
interface GenreSlice { name: string; value: number }
interface RoundSummary {
  roundId: string;
  title: string;
  imageUrl: string | null;
  status: string;
  submissionCount: number;
  totalVotes: number;
}
interface LeagueStatsData {
  overlord: UserAward;
  peopleChampion: UserAward;
  mostControversial: UserAward;
  prolificVoter: UserAward;
  topSong: TopSong | null;
  top10Songs: TopSong[];
  allRounds: RoundSummary[];
  mostUpvotedSong: SongAward | null;
  mostDownvotedSong: SongAward | null;
  fanFavoriteSong: SongAward | null;
  attendanceStar: UserAward;
  goldenEars: UserAward;
  consistencyKing: UserAward;
  biggestDownvoter: UserAward;
  worstRound: RoundAward | null;
  closestRound: RoundAward | null;
  blowoutRound: RoundAward | null;
  genreBreakdown: GenreSlice[];
}

interface StandingsItem { name: string; totalPoints: number }

interface TileSpec {
  x: number; y: number; w: number; h: number; title: string; subtitle: string;
}

function UserRow({
                   icon,
                   title,
                   desc,
                   user,
                   valueLabel,
                   highlight = false,
                 }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  user: UserAward;
  valueLabel?: (u: NonNullable<UserAward>) => string;
  highlight?: boolean;
}) {
  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02]",
      highlight && "border-primary/50 bg-gradient-to-br from-primary/5 to-transparent"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className={cn(
            "p-2 rounded-lg transition-colors",
            highlight ? "bg-primary/20" : "bg-muted"
          )}>
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
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg truncate">{user.name}</p>
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

function SongRow({
                   icon,
                   title,
                   desc,
                   song,
                   valueSuffix,
                   highlight = false,
                 }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  song:
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
  valueSuffix?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02]",
      highlight && "border-primary/50 bg-gradient-to-br from-primary/5 to-transparent"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className={cn(
            "p-2 rounded-lg transition-colors",
            highlight ? "bg-primary/20" : "bg-muted"
          )}>
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
            <div className="relative group-hover:scale-105 transition-transform">
              <NextImage
                src={song.albumArtUrl || "/icons/web-app-manifest-192x192.png"}
                alt={song.songTitle}
                width={80}
                height={80}
                className="rounded-lg shadow-md"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base truncate">{song.songTitle}</p>
              <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
              <p className="text-xs text-muted-foreground/70 truncate">by {song.submittedBy}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={cn(
                "px-3 py-1 rounded-full font-bold text-lg",
                highlight ? "bg-primary/20 text-primary" : "bg-muted"
              )}>
                {(song.count ?? song.score ?? 0)}
                {valueSuffix}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RoundRow({
                    icon,
                    title,
                    desc,
                    round,
                    metricSuffix,
                    metricFormatter,
                  }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  round:
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
  metricSuffix?: string;
  metricFormatter?: (x: number) => string;
}) {
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-lg bg-muted transition-colors">
            {icon}
          </div>
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
            <div className="relative group-hover:scale-105 transition-transform">
              <NextImage
                src={round.imageUrl || "/icons/web-app-manifest-192x192.png"}
                alt={round.title}
                width={80}
                height={80}
                className="rounded-lg shadow-md"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base truncate">{round.title}</p>
              <p className="text-sm text-muted-foreground">
                {round.submissions} songs • {round.totalUpvotes} upvotes
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="px-3 py-1 rounded-full bg-muted font-bold text-lg">
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
    1: "text-yellow-400",
    2: "text-gray-400",
    3: "text-orange-400",
  };
  
  const bgGradients = {
    1: "bg-gradient-to-b from-yellow-500/20 to-yellow-600/10",
    2: "bg-gradient-to-b from-gray-500/20 to-gray-600/10",
    3: "bg-gradient-to-b from-orange-500/20 to-orange-600/10",
  };
  
  const heightClass = heights[rank as keyof typeof heights];
  const medalColor = medalColors[rank as keyof typeof medalColors];
  const bgGradient = bgGradients[rank as keyof typeof bgGradients];
  
  return (
    <div className="flex flex-col items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-700" style={{ animationDelay: `${rank * 100}ms` }}>
      <div className="relative">
        <Avatar className={cn(
          "size-20 ring-4 transition-all duration-300 hover:scale-110",
          rank === 1 ? "ring-yellow-400/50" : rank === 2 ? "ring-gray-400/50" : "ring-orange-400/50"
        )}>
          <AvatarImage src={user.image ?? undefined} />
          <AvatarFallback>
            <div dangerouslySetInnerHTML={{ __html: toSvg(user.userId, 80) }} />
          </AvatarFallback>
        </Avatar>
        <div className={cn(
          "absolute -top-2 -right-2 rounded-full p-2 shadow-lg",
          rank === 1 ? "bg-yellow-400" : rank === 2 ? "bg-gray-400" : "bg-orange-400"
        )}>
          <Medal className={cn("size-5 text-white")} />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className={cn("w-32 rounded-t-xl transition-all duration-500 relative overflow-hidden", heightClass, bgGradient)}>
          <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <div className={cn("text-4xl font-bold", medalColor)}>
              {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
            </div>
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="font-bold text-base truncate w-32">{user.name}</p>
          <p className={cn("text-2xl font-extrabold", medalColor)}>{count}</p>
          <p className="text-xs text-muted-foreground">points</p>
        </div>
      </div>
    </div>
  );
}

function Podium({
                  standings,
                }: {
  standings:
    | { userId: string; name: string; image?: string; totalPoints: number }[]
    | undefined;
}) {
  if (!standings || standings.length === 0) return null;
  const top3 = standings.slice(0, 3);
  
  // Reorder for podium display: 2nd, 1st, 3rd
  const podiumOrder = top3.length >= 2 ? [top3[1], top3[0], top3[2]].filter(Boolean) : top3;
  
  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-primary/5">
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-orange-500/5" />
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-3 text-2xl">
          <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500">
            <Trophy className="size-6 text-white" />
          </div>
          Final Podium
        </CardTitle>
        <CardDescription>League champions ranked by total points</CardDescription>
      </CardHeader>
      <CardContent className="relative">
        <div className="flex items-end justify-center gap-8 py-4">
          {podiumOrder.map((p, displayIdx) => {
            // Get actual rank (1st, 2nd, 3rd)
            const actualRank = top3.indexOf(p) + 1;
            return (
              <PodiumBar
                key={p.userId}
                user={{ userId: p.userId, name: p.name, image: p.image }}
                rank={actualRank}
                points={p.totalPoints}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Export poster generation (SVG -> PNG) ---
function escapeXml(text?: string | null) {
  return (text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function buildHighlightsSvg(params: {
  width: number;
  height: number;
  standings?: StandingsItem[];
  stats: LeagueStatsData;
}) {
  const { width, height, standings, stats } = params;
  const w = width;
  const h = height;

  const winner = standings && standings.length > 0 ? standings[0] : { name: "ultravo" };
  const runner = standings && standings.length > 1 ? standings[1] : { name: "Isa" };
  const third = standings && standings.length > 2 ? standings[2] : { name: "Kyfa" };

  const topSong = stats?.topSong ?? { songTitle: "HOT TO GO!", artist: "Chappell Roan", score: 10 };

  const tiles = [
    { x: 36, y: 40, w: 280, h: 100, title: "Overlord", subtitle: `${stats?.overlord?.name ?? "Kyfa"} · ${stats?.overlord?.count ?? 2} wins` },
    { x: 36, y: 155, w: 280, h: 100, title: "People's Champion", subtitle: `${stats?.peopleChampion?.name ?? "ultravo"} · ${stats?.peopleChampion?.count ?? 52} upvotes` },
    { x: 36, y: 270, w: 280, h: 100, title: "Fan Favorite", subtitle: `${stats?.fanFavoriteSong?.songTitle ?? "Doki Doki Oyako Lesson"} | ${stats?.fanFavoriteSong?.artist ?? "Naotoshi Nishino - Silence - SurrealistBGM"}` },
    { x: w - 316, y: 40, w: 280, h: 100, title: "Golden Ears", subtitle: `${stats?.goldenEars?.name ?? "ultravo"} · ${stats?.goldenEars?.count ?? 6.4} avg` },
    { x: w - 316, y: 155, w: 280, h: 100, title: "Consistency King", subtitle: `${stats?.consistencyKing?.name ?? "jasoones"} · σ ${stats?.consistencyKing?.count ?? 0.5}` },
    { x: w - 316, y: 270, w: 280, h: 100, title: "Top Voted Song", subtitle: `${topSong.songTitle} — ${topSong.artist} · ${topSong.score} pts` },
  ];

  const now = new Date();
  const dateLabel = "Sep 19, 2025";

  function tileRect(t: TileSpec, i: number) {
    return `
      <g>
        <rect x="${t.x}" y="${t.y}" rx="24" ry="24" width="${t.w}" height="${t.h}" fill-opacity="0.1" fill="white"/>
        <text x="${t.x + 25}" y="${t.y + 40}" font-family="Arial, sans-serif" font-size="20" fill="white" font-weight="bold">${escapeXml(t.title)}</text>
        <text x="${t.x + 25}" y="${t.y + 65}" font-family="Arial, sans-serif" font-size="14" fill="white">${escapeXml(t.subtitle)}</text>
      </g>`;
  }

  const centralTitle = winner ? `${winner.name} wins the league` : "League Highlights";
  const centralSub = winner ? `Runner-up: ${runner?.name ?? "—"} • Third: ${third?.name ?? "—"}` : "Top 3: —";

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:rgb(59,130,246);stop-opacity:1" />
        <stop offset="100%" style="stop-color:rgb(109,40,217);stop-opacity:1" />
      </linearGradient>
       <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>

    <!-- Central hero tile -->
    <g filter="url(#softShadow)">
      <rect x="${w/2 - 250}" y="${h/2 - 125}" rx="28" ry="28" width="500" height="250" fill="#1e293b" fill-opacity="0.8"/>
      <text x="${w / 2}" y="${h / 2 - 20}" text-anchor="middle" font-size="36" font-weight="bold" fill="white" font-family="Arial, sans-serif">${escapeXml(centralTitle)}</text>
      <text x="${w / 2}" y="${h / 2 + 15}" text-anchor="middle" font-size="16" fill="white" font-family="Arial, sans-serif">${escapeXml(centralSub)}</text>
      <text x="${w / 2}" y="${h / 2 + 50}" text-anchor="middle" font-size="14" fill="white" font-family="Arial, sans-serif">${topSong ? `Top Song: ${escapeXml(topSong.songTitle)} — ${escapeXml(topSong.artist)}` : ""}</text>
    </g>

    <!-- Side tiles -->
    ${tiles.map(tileRect).join("\n")}

    <text x="${w - 36}" y="${h - 24}" text-anchor="end" font-size="14" fill="white" font-family="Arial, sans-serif">${escapeXml(dateLabel)} • zml.gg</text>
  </svg>`;
}


export function LeagueStats({ leagueId }: { leagueId: Id<"leagues"> }) {
  const stats = useQuery(api.leagues.getLeagueStats, { leagueId });
  const standings = useQuery(api.leagues.getLeagueStandings, { leagueId });
  const exportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  async function onExport() {
    if (!exportRef.current || !stats) return;
    
    setIsExporting(true);
    try {
      // Wait for any animations to settle
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const dataUrl = await toPng(exportRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#0a0a0a',
        cacheBust: true,
        skipAutoScale: true,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
      });
      
      const a = document.createElement("a");
      a.href = dataUrl;
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
      a.download = `league-awards-${ts}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error("Failed to export:", error);
      alert("Failed to export image. Please try again or check the console for details.");
    } finally {
      setIsExporting(false);
    }
  }

  if (stats === undefined) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <Skeleton className="size-10 rounded-full" />
              <div className="w-full space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (stats === null) {
    return (
      <div className="py-20 text-center">
        <h3 className="text-xl font-semibold">Stats are brewing…</h3>
        <p className="mt-2 text-muted-foreground">Finish a round to unlock the award ceremony.</p>
      </div>
    );
  }

  const COLORS = [
    "#3b82f6", // blue
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#f59e0b", // amber
    "#10b981", // emerald
    "#06b6d4", // cyan
    "#f97316", // orange
    "#6366f1", // indigo
  ];

  const hasGenreData = stats.genreBreakdown && stats.genreBreakdown.length > 0;

  return (
    <div className="space-y-8">
      {/* Header with export button */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Sparkles className="size-8 text-primary" />
            League Awards
          </h2>
          <p className="text-muted-foreground">Celebrating the best performances and memorable moments</p>
        </div>
        <Button 
          variant="outline" 
          size="lg" 
          onClick={onExport} 
          disabled={isExporting}
          className="gap-2"
        >
          <Download className="size-4" />
          {isExporting ? "Exporting..." : "Export PNG"}
        </Button>
      </div>

      <div ref={exportRef} className="space-y-8 bg-background p-4 rounded-lg">
        {/* Hero Section - Podium and Top Song */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Podium standings={standings} />
          
          <SongRow
            icon={<Trophy className="text-blue-400" />}
            title="Top Voted Song"
            desc="Highest scoring submission in the league"
            song={stats.topSong ? { ...stats.topSong, count: stats.topSong.score } : null}
            highlight={true}
          />
        </div>

        {/* Spotlight Awards - Key User Achievements */}
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Crown className="size-5 text-yellow-400" />
            Hall of Fame
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <UserRow
              icon={<Crown className="text-yellow-400" />}
              title="Overlord"
              desc="Most round wins"
              user={stats.overlord}
              valueLabel={(u) => `${u.count} wins`}
              highlight={true}
            />
            <UserRow
              icon={<ThumbsUp className="text-green-400" />}
              title="People's Champion"
              desc="Most upvotes received"
              user={stats.peopleChampion}
              valueLabel={(u) => `${u.count} upvotes`}
              highlight={true}
            />
            <UserRow
              icon={<Medal className="text-blue-400" />}
              title="Prolific Voter"
              desc="Most votes cast"
              user={stats.prolificVoter}
              valueLabel={(u) => `${u.count} votes`}
            />
            <UserRow
              icon={<ThumbsDown className="text-red-400" />}
              title="Lightning Rod"
              desc="Most downvotes received"
              user={stats.mostControversial}
              valueLabel={(u) => `${u.count} downvotes`}
            />
          </div>
        </div>

        {/* Song Awards */}
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Star className="size-5 text-amber-400" />
            Song Awards
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <SongRow
              icon={<ThumbsUp className="text-green-400" />}
              title="Most Upvoted Song"
              desc="Highest total upvotes"
              song={stats.mostUpvotedSong}
              valueSuffix=""
            />
            <SongRow
              icon={<Bookmark className="text-primary" />}
              title="Fan Favorite"
              desc="Most bookmarked"
              song={stats.fanFavoriteSong}
              valueSuffix=""
            />
            <SongRow
              icon={<ThumbsDown className="text-red-400" />}
              title="Most Downvoted Song"
              desc="Highest total downvotes"
              song={stats.mostDownvotedSong}
              valueSuffix=""
            />
          </div>
        </div>

        {/* Top 10 Songs */}
        {stats.top10Songs && stats.top10Songs.length > 0 && (
          <div>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="size-5 text-primary" />
              Top 10 Most Voted Songs
            </h3>
            <div className="grid gap-4">
              {stats.top10Songs.map((song, index) => (
                <Card key={index} className={cn(
                  "group transition-all duration-300 hover:shadow-lg hover:scale-[1.01]",
                  index === 0 && "border-primary/50 bg-gradient-to-br from-primary/5 to-transparent"
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "flex size-12 items-center justify-center rounded-lg font-bold text-xl",
                        index === 0 ? "bg-yellow-400 text-yellow-900" :
                        index === 1 ? "bg-slate-300 text-slate-700" :
                        index === 2 ? "bg-amber-600 text-amber-100" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}
                      </div>
                      {song.albumArtUrl ? (
                        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg">
                          <NextImage
                            src={song.albumArtUrl}
                            alt={song.songTitle}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="size-16 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                          <Star className="size-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{song.songTitle}</h4>
                        <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                        <p className="text-xs text-muted-foreground">by {song.submittedBy}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">{song.score}</div>
                        <div className="text-xs text-muted-foreground">points</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Performance Awards */}
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Target className="size-5 text-purple-400" />
            Performance Awards
          </h3>
          <div className="grid gap-6 md:grid-cols-2">
            <UserRow
              icon={<Star className="text-amber-400" />}
              title="Golden Ears"
              desc="Highest average points per submission"
              user={stats.goldenEars}
              valueLabel={(u) => `${u.count} avg (${u.meta?.rounds ?? 0} rounds)`}
            />
            <UserRow
              icon={<Target className="text-purple-400" />}
              title="Consistency King"
              desc="Lowest score variability (σ)"
              user={stats.consistencyKing}
              valueLabel={(u) => `σ ${u.count} (avg ${u.meta?.average ?? "?"})`}
            />
          </div>
        </div>

        {/* Round Awards */}
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Zap className="size-5 text-yellow-400" />
            Notable Rounds
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <RoundRow
              icon={<Zap className="text-yellow-400" />}
              title="Blowout Round"
              desc="Largest gap between 1st and 2nd"
              round={stats.blowoutRound}
              metricSuffix=" pts"
            />
            <RoundRow
              icon={<Scale className="text-emerald-400" />}
              title="Closest Round"
              desc="Smallest gap between 1st and 2nd"
              round={stats.closestRound}
              metricSuffix=" pts"
            />
            <RoundRow
              icon={<Gauge className="text-primary" />}
              title="Most Competitive"
              desc="Most top-heavy upvotes (top-2 share)"
              round={stats.worstRound}
              metricFormatter={(x) => `${Math.round(x * 100)}%`}
            />
          </div>
        </div>

        {/* All Rounds Summary */}
        {stats.allRounds && stats.allRounds.length > 0 && (
          <div>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <ListMusic className="size-5 text-primary" />
              All Rounds & Playlists
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {stats.allRounds.map((round) => (
                <Link key={round.roundId} href={`/leagues/${leagueId}/round/${round.roundId}`}>
                  <Card className="group transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        {round.imageUrl ? (
                          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg">
                            <NextImage
                              src={round.imageUrl}
                              alt={round.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="size-20 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                            <ListMusic className="size-10 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate mb-1">{round.title}</h4>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <span className={cn(
                                "inline-block size-2 rounded-full",
                                round.status === "finished" ? "bg-green-500" :
                                round.status === "voting" ? "bg-yellow-500" :
                                round.status === "submissions" ? "bg-blue-500" :
                                "bg-muted-foreground"
                              )}></span>
                              <span className="capitalize">{round.status}</span>
                            </div>
                            <div>{round.submissionCount} submissions</div>
                            <div>{round.totalVotes} votes cast</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Genre breakdown - Only show if there's data */}
        {hasGenreData && (
          <div>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <ListMusic className="size-5" />
              Genre Breakdown
            </h3>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardDescription>Distribution of genres across all submissions</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <ChartContainer
                  config={Object.fromEntries(
                    stats.genreBreakdown.map((g, i) => [
                      g.name, 
                      { 
                        label: g.name, 
                        color: COLORS[i % COLORS.length] 
                      }
                    ]),
                  )}
                  className="mx-auto aspect-square h-[300px]"
                >
                  <PieChart>
                    <Tooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      iconType="circle"
                    />
                    <Pie
                      data={stats.genreBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {stats.genreBreakdown.map((entry, i) => (
                        <Cell 
                          key={entry.name} 
                          fill={COLORS[i % COLORS.length]}
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}