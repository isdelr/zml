"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { BarChart3, Crown, ThumbsDown, ThumbsUp, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import Image from "next/image";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { toSvg } from "jdenticon";

interface LeagueStatsProps {
  leagueId: Id<"leagues">;
}

const UserStatDisplay = ({
                           user,
                           label,
                         }: {
  user: { name?: string | null; image?: string | null; count: number } | null | undefined;
  label: string;
}) => {
  if (!user) return <p className="text-muted-foreground">Not enough data to determine.</p>;
  return (
    <div className="flex items-center gap-4">
      <Avatar>
        <AvatarImage src={user.image ?? undefined} />
        <AvatarFallback>
          <div dangerouslySetInnerHTML={{ __html: toSvg(user.name ?? "anonymous", 40) }} />
        </AvatarFallback>
      </Avatar>
      <div>
        <p className="font-bold">{user.name}</p>
        <p className="text-sm text-muted-foreground">
          {user.count} {label}
        </p>
      </div>
    </div>
  );
};

export function LeagueStats({ leagueId }: LeagueStatsProps) {
  const stats = useQuery(api.leagues.getLeagueStats, { leagueId });

  if (stats === undefined) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Skeleton className="size-10 rounded-full" />
                <div className="w-full space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
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
        <h3 className="text-xl font-semibold">Stats Are Brewing!</h3>
        <p className="mt-2 text-muted-foreground">Complete more rounds to unlock the final league awards.</p>
      </div>
    );
  }

  const { overlord, peopleChampion, mostControversial, topSong, genreBreakdown } = stats;
  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  const chartConfig = genreBreakdown.reduce((acc, entry, index) => {
    acc[entry.name] = {
      label: entry.name,
      color: COLORS[index % COLORS.length],
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold">League Awards</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="text-yellow-400" />
              El Sujeto
            </CardTitle>
            <CardDescription>Most round wins</CardDescription>
          </CardHeader>
          <CardContent>
            <UserStatDisplay user={overlord} label="wins" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="text-green-400" />
              People&apos;s Champion
            </CardTitle>
            <CardDescription>Most upvotes received</CardDescription>
          </CardHeader>
          <CardContent>
            <UserStatDisplay user={peopleChampion} label="upvotes" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsDown className="text-red-400" />
              Most Controversial
            </CardTitle>
            <CardDescription>Most downvotes received</CardDescription>
          </CardHeader>
          <CardContent>
            <UserStatDisplay user={mostControversial} label="downvotes" />
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="text-blue-400" />
              Top Voted Song
            </CardTitle>
            <CardDescription>Highest scoring submission in the league</CardDescription>
          </CardHeader>
          <CardContent>
            {topSong ? (
              <div className="flex items-center gap-4">
                <Image
                  src={topSong.albumArtUrl || "/icons/web-app-manifest-192x192.png"}
                  alt={topSong.songTitle}
                  width={80}
                  height={80}
                  className="rounded-md"
                />
                <div>
                  <p className="text-lg font-bold">{topSong.songTitle}</p>
                  <p className="text-muted-foreground">{topSong.artist}</p>
                  <p className="text-sm">Submitted by {topSong.submittedBy}</p>
                  <p className="text-lg font-bold text-primary">{topSong.score} points</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Not enough data</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 />
            Genre Breakdown
          </CardTitle>
          <CardDescription>Distribution of genres from submitted rounds</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {genreBreakdown && genreBreakdown.length > 0 ? (
            <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[300px]">
              <PieChart>
                <Tooltip cursor={false} content={<ChartTooltipContent />} />
                <Legend />
                <Pie data={genreBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false}>
                  {genreBreakdown.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={chartConfig[entry.name].color} />
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
