"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Bookmark,
  Crown,
  Flame,
  Gauge,
  Medal,
  Shield,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
  Target,
  Scale,
  ListMusic,
  Download,
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
interface LeagueStatsData {
  overlord: UserAward;
  peopleChampion: UserAward;
  mostControversial: UserAward;
  prolificVoter: UserAward;
  topSong: TopSong | null;
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
                 }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  user: UserAward;
  valueLabel?: (u: NonNullable<UserAward>) => string;
}) {
  return (
    <Card className="overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        {!user ? (
          <p className="text-muted-foreground">Not enough data yet.</p>
        ) : (
          <div className="flex items-center gap-4">
            <Avatar className="size-12">
              <AvatarImage src={user.image ?? undefined} />
              <AvatarFallback>
                <div dangerouslySetInnerHTML={{ __html: toSvg(user.name ?? "anon", 48) }} />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-bold text-foreground">{user.name}</p>
              <p className="text-sm text-muted-foreground">
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
}) {
  return (
    <Card className="overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        {!song ? (
          <p className="text-muted-foreground">Not enough data yet.</p>
        ) : (
          <div className="flex items-center gap-4">
            <NextImage
              src={song.albumArtUrl || "/icons/web-app-manifest-192x192.png"}
              alt={song.songTitle}
              width={64}
              height={64}
              className="rounded-md"
            />
            <div className="flex-1">
              <p className="font-bold">{song.songTitle}</p>
              <p className="text-sm text-muted-foreground">{song.artist}</p>
              <p className="text-xs text-muted-foreground">Submitted by {song.submittedBy}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold">
                {(song.count ?? song.score ?? 0)}
                {valueSuffix}
              </p>
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
    <Card className="overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        {!round ? (
          <p className="text-muted-foreground">Not enough data yet.</p>
        ) : (
          <div className="flex items-center gap-4">
            <NextImage
              src={round.imageUrl || "/icons/web-app-manifest-192x192.png"}
              alt={round.title}
              width={64}
              height={64}
              className="rounded-md"
            />
            <div className="flex-1">
              <p className="font-bold">{round.title}</p>
              <p className="text-sm text-muted-foreground">
                {round.submissions} songs • {round.totalUpvotes} upvotes
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold">
                {metricFormatter ? metricFormatter(round.metric) : round.metric}
                {metricSuffix}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PodiumBar({
                     user,
                     heightClass,
                     points,
                   }: {
  user: { userId: string; name: string; image?: string };
  heightClass: string;
  points: number;
}) {
  const count = useCountUp(points);
  return (
    <div className="flex flex-col items-center justify-end gap-3">
      <Avatar className="size-14 ring-4 ring-primary/30">
        <AvatarImage src={user.image ?? undefined} />
        <AvatarFallback>
          <div dangerouslySetInnerHTML={{ __html: toSvg(user.userId, 56) }} />
        </AvatarFallback>
      </Avatar>
      <div className={cn("w-full rounded-t-md bg-primary/15", heightClass)} />
      <p className="font-bold text-center truncate w-full">{user.name}</p>
      <p className="text-sm text-muted-foreground">{count} pts</p>
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
  return (
    <Card className="border-primary/30 bg-card/60 animate-in fade-in zoom-in-95 duration-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="text-yellow-400" />
          Final Podium
        </CardTitle>
        <CardDescription>Based on total points across finished rounds</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 items-end gap-4">
          {top3.map((p, idx) => {
            const colOrder = [0, 1, 2];
            const height = idx === 1 ? "h-24" : idx === 0 ? "h-16" : "h-14";
            return (
              <div key={p.userId} className={cn("order-" + colOrder[idx])}>
                <PodiumBar
                  user={{ userId: p.userId, name: p.name, image: p.image }}
                  heightClass={height}
                  points={p.totalPoints}
                />
              </div>
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

  // Hooks must be called unconditionally (before any early return)
  const [active, setActive] = useState(0);

  async function onExport() {
    if (!stats) return;
    const width = 1200;
    const height = 675;
    const svg = buildHighlightsSvg({ width, height, standings: standings?.map(s => ({ name: s.name, totalPoints: s.totalPoints })), stats: stats as LeagueStatsData });

    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      await new Promise<void>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
          const scale = 2; // 2x for crispness
          const canvas = document.createElement("canvas");
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas not supported"));
            return;
          }
          ctx.scale(scale, scale);
          ctx.fillStyle = "#0b0b0c";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((out) => {
            if (!out) return reject(new Error("Failed to encode PNG"));
            const a = document.createElement("a");
            const outUrl = URL.createObjectURL(out);
            a.href = outUrl;
            const ts = new Date().toISOString().replace(/[:.]/g, "-");
            a.download = `league-highlights-${ts}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(outUrl);
            resolve();
          }, "image/png");
        };
        img.onerror = () => reject(new Error("Failed to render SVG"));
        img.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const highlights = useMemo(() => {
    if (!stats) return [];
    return [
      {
        key: "overlord",
        node: (
          <UserRow
            icon={<Crown className="text-yellow-400" />}
            title="Overlord"
            desc="Most round wins"
            user={stats.overlord}
            valueLabel={(u) => `${u.count} wins`}
          />
        ),
      },
      {
        key: "peoples",
        node: (
          <UserRow
            icon={<ThumbsUp className="text-green-400" />}
            title="People's Champion"
            desc="Most upvotes received"
            user={stats.peopleChampion}
            valueLabel={(u) => `${u.count} upvotes`}
          />
        ),
      },
      {
        key: "controversial",
        node: (
          <UserRow
            icon={<ThumbsDown className="text-red-400" />}
            title="Lightning Rod"
            desc="Most downvotes received"
            user={stats.mostControversial}
            valueLabel={(u) => `${u.count} downvotes`}
          />
        ),
      },
      {
        key: "prolific",
        node: (
          <UserRow
            icon={<Medal className="text-blue-400" />}
            title="Prolific Voter"
            desc="Most votes cast"
            user={stats.prolificVoter}
            valueLabel={(u) => `${u.count} votes`}
          />
        ),
      },
    ];
  }, [stats]);

  useEffect(() => {
    if (highlights.length === 0) return;
    const id = setInterval(() => setActive((i) => (i + 1) % highlights.length), 3500);
    return () => clearInterval(id);
  }, [highlights.length]);

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
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={onExport} aria-label="export-league-highlights">
          <Download className="size-4" />
          <span className="ml-2">Export highlights (PNG)</span>
        </Button>
      </div>
      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {/* Highlights carousel */}
          <div className="relative">
            <div className="overflow-hidden rounded-xl border">
              <div className="p-4 md:p-6 min-h-[172px]">
                {highlights[active]?.node ?? (
                  <div className="text-muted-foreground">No highlights yet.</div>
                )}
              </div>
            </div>
            <div className="absolute right-3 bottom-3 flex gap-2">
              {highlights.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={cn("size-2 rounded-full", i === active ? "bg-primary" : "bg-muted")}
                  aria-label={"go-to-highlight-" + i}
                />
              ))}
            </div>
          </div>

          {/* Podium */}
          <Podium standings={standings} />
        </div>

        {/* Top voted song wide card */}
        <SongRow
          icon={<Trophy className="text-blue-400" />}
          title="Top Voted Song"
          desc="Highest scoring submission in the league"
          song={stats.topSong ? { ...stats.topSong, count: stats.topSong.score } : null}
        />
      </div>

      {/* Big award grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <SongRow
          icon={<ThumbsUp className="text-green-400" />}
          title="Most Upvoted Song"
          desc="Highest total upvotes"
          song={stats.mostUpvotedSong}
          valueSuffix=""
        />
        <SongRow
          icon={<ThumbsDown className="text-red-400" />}
          title="Most Downvoted Song"
          desc="Highest total downvotes"
          song={stats.mostDownvotedSong}
          valueSuffix=""
        />
        <SongRow
          icon={<Bookmark className="text-primary" />}
          title="Fan Favorite"
          desc="Most bookmarked"
          song={stats.fanFavoriteSong}
          valueSuffix=""
        />
        <UserRow
          icon={<Shield className="text-emerald-400" />}
          title="Attendance Star"
          desc="Most rounds with a submission"
          user={stats.attendanceStar}
          valueLabel={(u) => `${u.count}/${u.meta?.totalRounds ?? "?"} rounds`}
        />
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
        <UserRow
          icon={<Flame className="text-red-500" />}
          title="Biggest Downvoter"
          desc="Most downvotes cast"
          user={stats.biggestDownvoter}
          valueLabel={(u) => `${u.count} downvotes`}
        />
        <RoundRow
          icon={<Gauge className="text-primary" />}
          title="Worst Round"
          desc="Most top-heavy upvotes (top-2 share)"
          round={stats.worstRound}
          metricFormatter={(x) => `${Math.round(x * 100)}%`}
        />
        <RoundRow
          icon={<Scale className="text-emerald-400" />}
          title="Closest Round"
          desc="Smallest gap between 1st and 2nd"
          round={stats.closestRound}
          metricSuffix=" pts"
        />
        <RoundRow
          icon={<Zap className="text-yellow-400" />}
          title="Blowout Round"
          desc="Largest gap between 1st and 2nd"
          round={stats.blowoutRound}
          metricSuffix=" pts"
        />
      </div>

      {/* Genre breakdown */}
      <Card className="animate-in fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListMusic />
            Genre Breakdown
          </CardTitle>
          <CardDescription>Distribution of genres across submitted rounds</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {stats.genreBreakdown && stats.genreBreakdown.length > 0 ? (
            <ChartContainer
              config={Object.fromEntries(
                stats.genreBreakdown.map((g, i) => [g.name, { label: g.name, color: COLORS[i % COLORS.length] }]),
              )}
              className="mx-auto aspect-square h-[300px]"
            >
              <PieChart>
                <Tooltip cursor={false} content={<ChartTooltipContent />} />
                <Legend />
                <Pie
                  data={stats.genreBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  labelLine={false}
                >
                  {stats.genreBreakdown.map((entry, i) => (
                    <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          ) : (
            <p className="py-10 text-muted-foreground">No genre data available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}