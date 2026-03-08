"use client";

import { Button } from "@/components/ui/button";

interface ExploreFiltersProps {
  activeTab: string;
  filterTabs: string[];
  onTabChange: (tab: string) => void;
}

export function ExploreFilters({
  activeTab,
  filterTabs,
  onTabChange,
}: ExploreFiltersProps) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {filterTabs.map((tab) => (
        <Button
          key={tab}
          variant={activeTab === tab ? "secondary" : "ghost"}
          className={`h-9 flex-shrink-0 rounded-full px-4 font-semibold transition-colors ${
            activeTab === tab
              ? "bg-secondary text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => onTabChange(tab)}
        >
          {tab}
        </Button>
      ))}
    </div>
  );
}
