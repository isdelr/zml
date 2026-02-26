// File: components/round/SubmissionCommentsPanel.tsx

"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWindowSize } from "@/hooks/useWindowSize";
import { Song } from "@/types";
import Image from "next/image";
import { Button } from "../ui/button";
import { Pause, Play } from "lucide-react";
import { SubmissionComments } from "./SubmissionComments";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";

interface SubmissionCommentsPanelProps {
  submission: Song | null; // Changed from submissionId to the full object
  roundStatus: "voting" | "finished" | "submissions";
  onOpenChange: (isOpen: boolean) => void;
  onPlaySong: (song: Song) => void;
}

export function SubmissionCommentsPanel({
                                          submission,
                                          roundStatus,
                                          onOpenChange,
                                          onPlaySong,
                                        }: SubmissionCommentsPanelProps) {
  const { width } = useWindowSize();
  const isMobile = width < 768;

  const { isPlaying, currentTrackIndex, queue } = useMusicPlayerStore();
  const currentTrack = currentTrackIndex !== null ? queue[currentTrackIndex] : null;

  return (
    <Sheet open={!!submission} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex w-full flex-col p-0 sm:max-w-md",
          isMobile && "h-[90dvh]"
        )}
      >
        <SheetHeader className="p-4 border-b">
          <SheetTitle>
            {submission ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <Image
                    src={submission.albumArtUrl ?? "/icons/web-app-manifest-192x192.png"}
                    alt={submission.songTitle}
                    width={64}
                    height={64}
                    className="rounded-md flex-shrink-0"
                  />
                  <div className="truncate">
                    <p className="text-lg font-bold truncate">{submission.songTitle}</p>
                    <p className="text-sm text-muted-foreground truncate">{submission.artist}</p>
                  </div>
                </div>
                <Button size="icon" variant="outline" className="flex-shrink-0" onClick={() => onPlaySong(submission)}>
                  {isPlaying && currentTrack?._id === submission._id ? <Pause/> : <Play />}
                </Button>
              </div>
            ) : null}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {submission && (
            <SubmissionComments submissionId={submission._id} roundStatus={roundStatus} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
