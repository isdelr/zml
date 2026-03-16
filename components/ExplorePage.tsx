"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import {
  filterExploreLeagues,
  type ExploreLeagueTab,
} from "@/lib/explore/filter-leagues";
import { dynamicImport } from "./ui/dynamic-import";
import type { FunctionReturnType } from "convex/server";

const ExploreHeader = dynamicImport(() =>
  import("./explore/ExploreHeader").then((mod) => ({
    default: mod.ExploreHeader,
  })),
);
const ExploreFilters = dynamicImport(() =>
  import("./explore/ExploreFilters").then((mod) => ({
    default: mod.ExploreFilters,
  })),
);
const LeagueGrid = dynamicImport(() =>
  import("./explore/LeagueGrid").then((mod) => ({ default: mod.LeagueGrid })),
);

type ExploreLeagues = FunctionReturnType<typeof api.leagues.getExploreLeagues>;
type ExploreLeague =
  | ExploreLeagues["publicLeagues"][number]
  | ExploreLeagues["joinedPrivateLeagues"][number];

export function ExplorePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<ExploreLeagueTab>("All");

  const leagues = useQuery(api.leagues.getExploreLeagues, { limit: 25 });

  const filterTabs: ExploreLeagueTab[] = ["All", "Popular", "New", "Active"];
  const isLoading = leagues === undefined;

  const filteredPublicLeagues = useMemo<ExploreLeague[]>(() => {
    return filterExploreLeagues(leagues?.publicLeagues ?? [], {
      searchTerm,
      activeTab,
    });
  }, [leagues, searchTerm, activeTab]);

  const filteredJoinedPrivateLeagues = useMemo<ExploreLeague[]>(() => {
    return filterExploreLeagues(leagues?.joinedPrivateLeagues ?? [], {
      searchTerm,
      activeTab,
    });
  }, [leagues, searchTerm, activeTab]);

  const hasJoinedPrivateLeagues = (leagues?.joinedPrivateLeagues.length ?? 0) > 0;

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto flex w-full flex-col gap-6 p-4 sm:gap-7 sm:p-6 lg:gap-8 lg:p-8">
        <ExploreHeader
          searchTerm={searchTerm}
          onSearchChange={(value) => setSearchTerm(value)}
        />

        <ExploreFilters
          activeTab={activeTab}
          filterTabs={filterTabs}
          onTabChange={setActiveTab}
        />

        {isLoading ? (
          <div className="rounded-lg border border-dashed py-20 text-center">
            <h2 className="text-xl font-semibold">Loading Leagues</h2>
            <p className="mt-2 text-muted-foreground">
              Fetching league directory...
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {hasJoinedPrivateLeagues ? (
              <LeagueGrid
                description="These leagues are only visible here because you've already joined them."
                emptyDescription="None of your joined private leagues match the current search or filter."
                emptyTitle="No Matching Private Leagues"
                filteredLeagues={filteredJoinedPrivateLeagues}
                title="Your Private League Joins"
                variant="private"
              />
            ) : null}

            <LeagueGrid
              description="Browse the public directory to find leagues anyone can discover and join."
              emptyDescription="No public leagues match your filter criteria. Try another filter or create your own league."
              emptyTitle="No Public Leagues Found"
              filteredLeagues={filteredPublicLeagues}
              title="Public Leagues"
              variant="public"
            />
          </div>
        )}
      </div>
    </div>
  );
}
