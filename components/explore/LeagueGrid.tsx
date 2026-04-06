"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe2, Lock, Users } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/convex/api";
import type { FunctionReturnType } from "convex/server";
import { Badge } from "@/components/ui/badge";
import { LeagueArtwork } from "@/components/league/LeagueArtwork";

type ExploreLeague = FunctionReturnType<
  typeof api.leagues.getExploreLeagues
>["publicLeagues"][number] | FunctionReturnType<
  typeof api.leagues.getExploreLeagues
>["joinedPrivateLeagues"][number];

interface LeagueGridProps {
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  filteredLeagues: ExploreLeague[];
  title: string;
  variant: "public" | "private";
}

export function LeagueGrid({
  description,
  emptyDescription,
  emptyTitle,
  filteredLeagues,
  title,
  variant,
}: LeagueGridProps) {
  const isPrivate = variant === "private";

  return (
    <section
      className={
        isPrivate
          ? "space-y-4 rounded-3xl border border-primary/25 bg-primary/5 p-4 shadow-sm sm:p-5"
          : "space-y-4"
      }
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {isPrivate ? (
            <Lock className="size-4 text-primary/80 dark:text-primary" />
          ) : (
            <Globe2 className="size-4 text-muted-foreground" />
          )}
          <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>

      {filteredLeagues.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <h3 className="text-lg font-semibold">{emptyTitle}</h3>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {emptyDescription}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(14.5rem,16.5rem))] justify-center gap-4 sm:gap-5">
          {filteredLeagues.map((league) => (
            <Link
              href={`/leagues/${league._id}`}
              key={league._id}
              className="w-full"
            >
              <Card
                className={`group flex h-full cursor-pointer flex-col overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-1 hover:bg-accent/40 hover:shadow-md ${
                  isPrivate
                    ? "border-primary/25 bg-card/95 hover:border-primary/40"
                    : "border-border/60 bg-card/95 hover:border-primary/30"
                }`}
              >
                <CardHeader className="flex-grow space-y-3 p-3 sm:p-4">
                  <LeagueArtwork
                    leagueId={league._id}
                    leagueName={league.name}
                    art={league.art}
                    roundArt={league.roundArt}
                    className="w-full"
                  />
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-1 text-base sm:text-lg">
                        {league.name}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={
                          league.visibility === "private"
                            ? "shrink-0 border-primary/30 bg-primary/10 text-primary"
                            : "shrink-0"
                        }
                      >
                        {league.visibility === "private" ? "Private Join" : "Public"}
                      </Badge>
                    </div>
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
      )}
    </section>
  );
}
