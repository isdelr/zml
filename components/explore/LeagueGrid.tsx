"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/convex/api";
import type { FunctionReturnType } from "convex/server";
import { Badge } from "@/components/ui/badge";
import { LeagueArtwork } from "@/components/league/LeagueArtwork";

type PublicLeague = FunctionReturnType<
  typeof api.leagues.getPublicLeagues
>[number] & {
  roundArt?: string[];
};

interface LeagueGridProps {
  filteredLeagues: PublicLeague[];
}

export function LeagueGrid({ filteredLeagues }: LeagueGridProps) {
  if (filteredLeagues.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-20 text-center">
        <h2 className="text-xl font-semibold">No Leagues Found</h2>
        <p className="mt-2 text-muted-foreground">
          No public leagues match your filter criteria. Try another filter or
          create your own league!
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(14.5rem,16.5rem))] justify-center gap-4 sm:gap-5">
      {filteredLeagues.map((league) => (
        <Link
          href={`/leagues/${league._id}`}
          key={league._id}
          className="w-full"
        >
          <Card className="group flex h-full cursor-pointer flex-col overflow-hidden border-border/60 bg-card/95 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:bg-accent/40 hover:shadow-md">
            <CardHeader className="flex-grow space-y-3 p-3 sm:p-4">
              <LeagueArtwork
                leagueId={league._id}
                leagueName={league.name}
                art={league.art}
                roundArt={league.roundArt}
                className="w-full"
              />
              <div className="space-y-1.5">
                <CardTitle className="line-clamp-1 text-base sm:text-lg">
                  {league.name}
                </CardTitle>
                <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
                  {league.description}
                </p>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3 px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" />
                <span>{league.memberCount} members</span>
              </div>
              {league.isActive ? (
                <Badge
                  variant="secondary"
                  className="h-6 rounded-full px-2.5 text-[11px] font-medium"
                >
                  Active
                </Badge>
              ) : null}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
