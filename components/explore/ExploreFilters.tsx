"use client";

import { Button } from "@/components/ui/button";

interface ExploreFiltersProps {
  activeTab: string;
  filterTabs: string[];
  onTabChange: (tab: string) => void;
}

export function ExploreFilters({ activeTab, filterTabs, onTabChange }: ExploreFiltersProps) {
  return (
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
          onClick={() => onTabChange(tab)}
        >
          {tab}
        </Button>
      ))}
    </div>
  );
}