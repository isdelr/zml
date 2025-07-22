"use client";

import { Button } from "@/components/ui/button";
import { Bookmark, List, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerActionsProps {
  isBookmarked: boolean;
  onBookmarkToggle: () => void;
  onQueueOpen: () => void;
}

export function PlayerActions({
  isBookmarked,
  onBookmarkToggle,
  onQueueOpen,
}: PlayerActionsProps) {
  return (
    <div className="flex w-1/4 items-center justify-end gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="flex-shrink-0"
        onClick={onBookmarkToggle}
        title="Bookmark song"
      >
        <Bookmark
          className={cn(
            "size-5",
            isBookmarked && "fill-primary text-primary",
          )}
        />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="flex-shrink-0"
        onClick={onQueueOpen}
      >
        <List className="size-5" />
      </Button>
      <Button variant="ghost" size="icon" className="flex-shrink-0">
        <MoreHorizontal className="size-5" />
      </Button>
    </div>
  );
}