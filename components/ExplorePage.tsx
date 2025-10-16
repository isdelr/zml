"use client";

import { useMemo, useState } from "react";
import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { dynamicImport } from "./ui/dynamic-import";

const ExploreHeader = dynamicImport(() => import("./explore/ExploreHeader").then(mod => ({ default: mod.ExploreHeader })));
const ExploreFilters = dynamicImport(() => import("./explore/ExploreFilters").then(mod => ({ default: mod.ExploreFilters })));
const LeagueGrid = dynamicImport(() => import("./explore/LeagueGrid").then(mod => ({ default: mod.LeagueGrid })));

interface ExplorePageProps {
  preloadedLeagues: Preloaded<typeof api.leagues.getPublicLeagues>;
}

export function ExplorePage({ preloadedLeagues }: ExplorePageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  
  const leagues = usePreloadedQuery(preloadedLeagues);
  
  const filterTabs = ["All", "Popular", "New", "Active"];
  
  const filteredLeagues = useMemo(() => {
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
      
      <LeagueGrid 
        leagues={leagues}
        filteredLeagues={filteredLeagues}
      />
    </div>
  );
}