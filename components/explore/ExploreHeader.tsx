"use client";

import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ExploreHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function ExploreHeader({ searchTerm, onSearchChange }: ExploreHeaderProps) {
  return (
    <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <h1 className="text-4xl font-bold">Explore Public Leagues</h1>
      <div className="relative w-full flex-1 md:max-w-sm">
        <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search for a league..."
          className="h-10 w-full rounded-md border-none bg-secondary pl-10 pr-4 text-sm"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Link href="/leagues/create" className="md:block md:w-auto hidden">
        <Button>
          <Plus className="mr-2 size-4" />
          Create League
        </Button>
      </Link>
    </header>
  );
}