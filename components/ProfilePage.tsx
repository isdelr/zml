"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Music, Shield, Trophy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Button } from "./ui/button";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";
import { toSvg } from "jdenticon";

const StatCard = ({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: number | string;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

const ProfilePageSkeleton = () => (
  <div className="p-8">
    <div className="mb-8 flex items-center gap-6">
      <Skeleton className="size-24 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-32" />
      </div>
    </div>
    <div className="mb-8 grid gap-4 md:grid-cols-3">
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
    <Skeleton className="h-80 w-full" />
  </div>
);

export function ProfilePage({ userId }: { userId: string }) {
  const profileData = useQuery(api.users.getProfile, {
    userId: userId as Id<"users">,
  });
  const currentTrackIndex = useMusicPlayerStore(
    (state) => state.currentTrackIndex,
  );

  if (profileData === undefined) {
    return <ProfilePageSkeleton />;
  }

  if (profileData === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <h1 className="text-2xl font-bold">User not found.</h1>
      </div>
    );
  }

  const { name, image, creationTime, stats, leagues } = profileData;

  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto p-8",
        currentTrackIndex !== null && "pb-24",
      )}
    >
      {/* User Header */}
      <header className="mb-8 flex flex-col items-center gap-6 md:flex-row">
        <Avatar className="size-24 border-4 border-primary">
          <AvatarImage src={image ?? undefined} alt={name ?? "User"} />
          <AvatarFallback>
            <div dangerouslySetInnerHTML={{ __html: toSvg(userId, 96) }} />
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-4xl font-bold">{name}</h1>
          <p className="text-muted-foreground">
            Member for {formatDistanceToNow(new Date(creationTime))}
          </p>
        </div>
      </header>

      {/* Stats Grid */}
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<Shield className="size-4 text-muted-foreground" />}
          title="Leagues Joined"
          value={stats.leaguesJoined}
        />
        <StatCard
          icon={<Trophy className="size-4 text-muted-foreground" />}
          title="Total Wins"
          value={stats.totalWins}
        />
        <StatCard
          icon={<Music className="size-4 text-muted-foreground" />}
          title="Total Submissions"
          value={stats.totalSubmissions}
        />
      </section>

      {/* Leagues Table */}
      <Card>
        <CardHeader>
          <CardTitle>League History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>League</TableHead>
                <TableHead className="text-center">Rank</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Wins</TableHead>
                <TableHead className="text-center">Submissions</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {leagues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No active leagues. Explore and join one!
                  </TableCell>
                </TableRow>
              ) : (
                leagues.map((league) => (
                  <TableRow key={league._id}>
                    <TableCell className="font-medium">{league.name}</TableCell>
                    <TableCell className="text-center">
                      {league.userRank ? `#${league.userRank}` : "N/A"}
                    </TableCell>
                    <TableCell className="text-center">
                      {league.userScore ?? "N/A"}
                    </TableCell>
                    <TableCell className="text-center">{league.wins}</TableCell>
                    <TableCell className="text-center">
                      {league.submissionCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/leagues/${league._id}`} passHref>
                        <Button variant="outline">View League</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}