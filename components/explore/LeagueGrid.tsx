"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { toSvg } from "jdenticon";

interface LeagueGridProps {
  leagues: unknown[] | undefined;
  filteredLeagues: unknown[];
}

export function LeagueGrid({ leagues, filteredLeagues }: LeagueGridProps) {
  if (leagues === undefined) {
    return <LeaguesSkeleton />;
  }

  if (filteredLeagues.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-20 text-center">
        <h2 className="text-xl font-semibold">No Leagues Found</h2>
        <p className="mt-2 text-muted-foreground">
          No public leagues match your filter criteria. Try another filter
          or create your own league!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filteredLeagues.map((league) => (
        <Link href={`/leagues/${league._id}`} key={league._id}>
          <Card className="group flex h-full cursor-pointer flex-col bg-card transition-all hover:bg-accent hover:shadow-lg">
            <CardHeader className="flex-grow">
              {league.art ? (
                <Image
                  src={league.art}
                  alt={league.name}
                  width={250}
                  height={250}
                  className="mb-4 aspect-square w-full rounded-md object-cover"
                />
              ) : (
                <div
                  className="mb-4 aspect-square size-fit rounded-md bg-muted"
                  dangerouslySetInnerHTML={{
                    __html: toSvg(league._id, 250),
                  }}
                />
              )}
              <CardTitle>{league.name}</CardTitle>
              <CardDescription className="line-clamp-2">
                {league.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" />
                <span>{league.memberCount} members</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function LeaguesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(8)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="aspect-square w-full rounded-md" />
            <Skeleton className="mb-1 mt-4 h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-5 w-1/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}