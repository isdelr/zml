"use client";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
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

export function ProfilePage({ userId }: { userId: string }) {
  const profileData = useQuery(api.users.getProfile, {
    userId: userId as Id<"users">,
  });

  if (profileData === undefined) {
    return null;
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
    <div className="min-h-full p-4 md:p-8">
      <header className="mb-8 flex flex-col items-center gap-4 text-center md:flex-row md:gap-6 md:text-left">
        <Avatar className="size-24 border-4 border-primary">
          <AvatarImage src={image ?? undefined} alt={name ?? "User"} />
          <AvatarFallback>
            <div dangerouslySetInnerHTML={{ __html: toSvg(userId, 96) }} />
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">{name}</h1>
          <p className="text-muted-foreground">Member for {formatDistanceToNow(new Date(creationTime))}</p>
        </div>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={<Shield className="size-4 text-muted-foreground" />} title="Leagues Joined" value={stats.leaguesJoined} />
        <StatCard icon={<Trophy className="size-4 text-muted-foreground" />} title="Total Wins" value={stats.totalWins} />
        <StatCard icon={<Music className="size-4 text-muted-foreground" />} title="Total Submissions" value={stats.totalSubmissions} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>League History</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          <div className="md:hidden">
            {leagues.length === 0 ? (
              <p className="p-4 text-center text-muted-foreground">No active leagues.</p>
            ) : (
              <div className="space-y-4 p-4">
                {leagues.map((league) => (
                  <Card key={league._id} className="p-4">
                    <CardTitle className="mb-2">{league.name}</CardTitle>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <p>
                        <strong>Rank:</strong> {league.userRank ? `#${league.userRank}` : "N/A"}
                      </p>
                      <p>
                        <strong>Wins:</strong> {league.wins}
                      </p>
                      <p>
                        <strong>Score:</strong> {league.userScore ?? "N/A"}
                      </p>
                      <p>
                        <strong>Submissions:</strong> {league.submissionCount}
                      </p>
                    </div>
                    <Link href={`/leagues/${league._id}`} passHref className="mt-4 block">
                      <Button variant="outline" className="w-full">
                        View League
                      </Button>
                    </Link>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Table>
            <TableHeader className="hidden md:table-header-group">
              <TableRow>
                <TableHead>League</TableHead>
                <TableHead className="text-center">Rank</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Wins</TableHead>
                <TableHead className="text-center">Submissions</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody className="hidden md:table-row-group">
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
                    <TableCell className="text-center">{league.userRank ? `#${league.userRank}` : "N/A"}</TableCell>
                    <TableCell className="text-center">{league.userScore ?? "N/A"}</TableCell>
                    <TableCell className="text-center">{league.wins}</TableCell>
                    <TableCell className="text-center">{league.submissionCount}</TableCell>
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
