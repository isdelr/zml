// components/player/PlayerActions.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Bookmark,
  List,
  Volume2,
  Volume1,
  VolumeX,
  PanelRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "../ui/slider";
import { useMemo } from "react";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";

interface PlayerActionsProps {
  isBookmarked: boolean;
  onBookmarkToggle: () => void;
  onQueueOpen: () => void;
  volume: number;
  onVolumeChange: (value: number) => void;
  onMuteToggle: () => void;
}

export function PlayerActions({
  isBookmarked,
  onBookmarkToggle,
  onQueueOpen,
  volume,
  onVolumeChange,
  onMuteToggle,
}: PlayerActionsProps) {
  const { actions, isContextViewOpen } = useMusicPlayerStore();

  const VolumeIcon = useMemo(() => {
    if (volume === 0) {
      return VolumeX;
    }
    if (volume < 0.5) {
      return Volume1;
    }
    return Volume2;
  }, [volume]);

  return (
    <div className="flex w-full items-center justify-end gap-2 md:w-1/4">
      <Button
        variant="ghost"
        size="icon"
        className="flex-shrink-0"
        onClick={actions.toggleContextView}
        title="Now Playing View"
      >
        <PanelRight className={cn("size-5", isContextViewOpen && "text-primary")} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="flex-shrink-0"
        onClick={onBookmarkToggle}
        title="Bookmark song"
      >
        <Bookmark
          className={cn("size-5", isBookmarked && "fill-primary text-primary")}
        />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="flex-shrink-0"
        onClick={onQueueOpen}
        title="Queue"
      >
        <List className="size-5" />
      </Button>
      <div className="hidden items-center gap-2 md:flex w-32">
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          onClick={onMuteToggle}
          title="Mute"
        >
          <VolumeIcon className="size-5" />
        </Button>
        <Slider
          value={[volume]}
          max={1}
          step={0.01}
          onValueChange={(value) => {
            const nextValue = value[0];
            if (nextValue === undefined) return;
            onVolumeChange(nextValue);
          }}
        />
      </div>
    </div>
  );
}
