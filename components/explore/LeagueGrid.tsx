"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toSvg } from "jdenticon";
import { api } from "@/lib/convex/api";
import type { FunctionReturnType } from "convex/server";

interface LeagueGridProps {
  filteredLeagues: FunctionReturnType<typeof api.leagues.getPublicLeagues>;
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
                  className="generated-art mb-4 aspect-square w-full rounded-md bg-muted"
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
