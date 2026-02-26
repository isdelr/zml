"use client";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Play, Pause, ListMusic } from "lucide-react";
import { Button } from "./ui/button";
import { Song } from "@/types";

interface MusicQueueProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function MusicQueue({ isOpen, onOpenChange }: MusicQueueProps) {
  const { queue, currentTrackIndex, isPlaying, actions } = useMusicPlayerStore();
  const currentTrack = currentTrackIndex !== null ? queue[currentTrackIndex] : null;

  const handlePlaySong = (song: Song, index: number) => {
    const isThisSongCurrent = currentTrack?._id === song._id;
    if (isThisSongCurrent) {
      actions.togglePlayPause();
    } else {
      actions.playRound(queue, index);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>Up Next</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">
          {queue.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-muted-foreground">
              <ListMusic className="size-12" />
              <p className="text-lg font-medium">Queue is empty</p>
              <p className="text-sm">Songs you play will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {queue.map((song, index) => {
                const isThisSongPlaying = isPlaying && currentTrackIndex === index;
                const isThisSongCurrent = currentTrackIndex === index;
                return (
                  <div
                    key={`${song._id}-${index}`}
                    className={cn("group flex items-center gap-4 rounded-md p-2 hover:bg-accent", isThisSongCurrent && "bg-accent")}
                  >
                    <div className="relative flex-shrink-0">
                      <Image
                        src={song.albumArtUrl ?? "/icons/web-app-manifest-192x192.png"}
                        alt={song.songTitle}
                        width={48}
                        height={48}
                        className="rounded-md"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute inset-0 flex h-full w-full items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => handlePlaySong(song, index)}
                      >
                        {isThisSongPlaying ? <Pause className="size-5 fill-white" /> : <Play className="size-5 fill-white" />}
                      </Button>
                    </div>
                    <div className="flex-1 truncate">
                      <p className={cn("truncate font-semibold", isThisSongCurrent && "text-primary")}>{song.songTitle}</p>
                      <p className="truncate text-sm text-muted-foreground">{song.artist}</p>
                    </div>
                    {isThisSongPlaying && (
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:-0.3s]"></span>
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:-0.15s]"></span>
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"></span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
