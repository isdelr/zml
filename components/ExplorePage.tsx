"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";
import { dynamicImport } from "./ui/dynamic-import";

// Dynamically import components
const ExploreHeader = dynamicImport(() => import("./explore/ExploreHeader").then(mod => ({ default: mod.ExploreHeader })));
const ExploreFilters = dynamicImport(() => import("./explore/ExploreFilters").then(mod => ({ default: mod.ExploreFilters })));
const LeagueGrid = dynamicImport(() => import("./explore/LeagueGrid").then(mod => ({ default: mod.LeagueGrid })));

export function ExplorePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const { currentTrackIndex } = useMusicPlayerStore();
  
  const leagues = useQuery(api.leagues.getPublicLeagues);
  
  const filterTabs = ["All", "Popular", "New", "Active"];
  
  const filteredLeagues = useMemo(() => {
    if (!leagues) return [];
    
    let filtered = leagues;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((league) =>
        league.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        league.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply tab filter
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
    <div
      className={cn(
        "flex-1 overflow-y-auto bg-background p-4 text-foreground md:p-8",
        currentTrackIndex !== null && "pb-32",
      )}
    >
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