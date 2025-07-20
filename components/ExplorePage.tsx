"use client";

import { Plus, Search, Users } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import Link from "next/link";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "./ui/skeleton";
import { toSvg } from "jdenticon";

const LeaguesSkeleton = () => (
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

export function ExplorePage() {
  const [activeTab, setActiveTab] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const currentTrackIndex = useMusicPlayerStore(
    (state) => state.currentTrackIndex,
  );

  const allLeagues = useQuery(api.leagues.getPublicLeagues);

  const availableGenres = useMemo(() => {
    if (!allLeagues) return [];
    const allGenres = allLeagues.flatMap((league) => league.genres);
    return [...new Set(allGenres)].sort();
  }, [allLeagues]);

  const filteredLeagues = useMemo(() => {
    if (!allLeagues) return [];

    let leagues = allLeagues;

    // Filter by search term
    if (searchTerm) {
      leagues = leagues.filter(
        (league) =>
          league.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          league.description.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by tab
    switch (activeTab) {
      case "All":
        // no-op, return all
        break;
      case "Popular":
        leagues = [...leagues].sort((a, b) => b.memberCount - a.memberCount);
        break;
      case "Newest":
        leagues = [...leagues].sort((a, b) => b._creationTime - a._creationTime);
        break;
      default: // This handles genre filtering
        leagues = leagues.filter((league) => league.genres.includes(activeTab));
        break;
    }

    return leagues;
  }, [allLeagues, activeTab, searchTerm]);

  const filterTabs = ["All", "Popular", "Newest", ...availableGenres];

  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto bg-background text-foreground",
        currentTrackIndex !== null && "pb-24",
      )}
    >
      <div className="p-8">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-4xl font-bold">Explore Public Leagues</h1>
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for a league..."
              className="h-10 w-full rounded-md border-none bg-secondary pl-10 pr-4 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Link href="/leagues/create">
            <Button>
              <Plus className="mr-2 size-4" />
              Create League
            </Button>
          </Link>
        </header>

        {/* Filter Tabs */}
        <div className="mb-8 flex items-center gap-2 overflow-x-auto border-b border-border pb-2">
          {filterTabs.map((tab) => (
            <Button
              key={tab}
              variant="ghost"
              className={`flex-shrink-0 font-semibold transition-colors hover:text-foreground ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </Button>
          ))}
        </div>

        {/* League Grid */}
        {allLeagues === undefined ? (
          <LeaguesSkeleton />
        ) : filteredLeagues.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredLeagues.map((league) => (
              <Link href={`/leagues/${league._id}`} key={league._id}>
                <Card className="group flex h-full cursor-pointer flex-col bg-card transition-all hover:bg-accent hover:shadow-md">
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
                        className="mb-4 aspect-square w-full rounded-md bg-muted"
                        dangerouslySetInnerHTML={{ __html: toSvg(league._id, 250) }}
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
        ) : (
          <div className="rounded-lg border border-dashed py-20 text-center">
            <h2 className="text-xl font-semibold">No Leagues Found</h2>
            <p className="mt-2 text-muted-foreground">
              No public leagues match your filter criteria. Try another filter
              or create your own league!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}