"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { dynamicImport } from "./ui/dynamic-import";
import type { FunctionReturnType } from "convex/server";

const ExploreHeader = dynamicImport(() => import("./explore/ExploreHeader").then(mod => ({ default: mod.ExploreHeader })));
const ExploreFilters = dynamicImport(() => import("./explore/ExploreFilters").then(mod => ({ default: mod.ExploreFilters })));
const LeagueGrid = dynamicImport(() => import("./explore/LeagueGrid").then(mod => ({ default: mod.LeagueGrid })));

type PublicLeagues = FunctionReturnType<typeof api.leagues.getPublicLeagues>;

export function ExplorePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("All");

  const leagues = useQuery(api.leagues.getPublicLeagues, { limit: 25 });
  
  const filterTabs = ["All", "Popular", "New", "Active"];
  const isLoading = leagues === undefined;
  
  const filteredLeagues = useMemo<PublicLeagues>(() => {
    if (!leagues) return [];
    let filtered = leagues;
    
    if (searchTerm) {
      filtered = filtered.filter((league) =>
        league.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        league.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (activeTab === "Popular") {
      filtered = [...filtered].sort((a, b) => b.memberCount - a.memberCount);
    } else if (activeTab === "New") {
      filtered = [...filtered].sort((a, b) => b._creationTime - a._creationTime);
    } else if (activeTab === "Active") {
      filtered = [...filtered].filter((league) => league.isActive);
    }
    
    return filtered;
  }, [leagues, searchTerm, activeTab]);

  return (
    <div className="min-h-full bg-background p-4 text-foreground md:p-8">
      <ExploreHeader 
        searchTerm={searchTerm}
        onSearchChange={(value) => setSearchTerm(value)}
      />
      
      <ExploreFilters 
        activeTab={activeTab}
        filterTabs={filterTabs}
        onTabChange={(tab) => setActiveTab(tab)}
      />

      {isLoading ? (
        <div className="rounded-lg border border-dashed py-20 text-center">
          <h2 className="text-xl font-semibold">Loading Leagues</h2>
          <p className="mt-2 text-muted-foreground">
            Fetching public leagues...
          </p>
        </div>
      ) : (
        <LeagueGrid filteredLeagues={filteredLeagues} />
      )}
    </div>
  );
}
