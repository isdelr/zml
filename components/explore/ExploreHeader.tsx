"use client";

import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Input } from "@/components/ui/input";

interface ExploreHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function ExploreHeader({
  searchTerm,
  onSearchChange,
}: ExploreHeaderProps) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Explore Public Leagues
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Browse active communities, check what&apos;s moving, and jump into the
          leagues that fit your taste.
        </p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-2xl lg:justify-end">
        <div className="relative w-full sm:flex-1 lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for a league..."
            className="h-11 border-border/60 bg-secondary/70 pl-10 text-sm"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Link href="/leagues/create" className="w-full sm:w-auto">
          <Button className="h-11 w-full sm:w-auto">
            <Plus className="mr-2 size-4" />
            Create League
          </Button>
        </Link>
      </div>
    </header>
  );
}
