"use client";

import { Search } from "lucide-react";

interface BookmarkHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function BookmarkHeader({ searchTerm, onSearchChange }: BookmarkHeaderProps) {
  return (
    <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <h1 className="text-4xl font-bold">Bookmarked Songs</h1>
      <div className="relative w-full flex-1 md:max-w-sm">
        <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search in your bookmarks..."
          className="h-10 w-full rounded-md border-none bg-secondary pl-10 pr-4 text-sm"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </header>
  );
}