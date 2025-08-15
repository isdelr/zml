// File: components/round/SubmissionCommentsPanel.tsx

"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWindowSize } from "@/hooks/useWindowSize";
import { Song } from "@/types";
import { Skeleton } from "../ui/skeleton";
import Image from "next/image";
import { Button } from "../ui/button";
import { Pause, Play } from "lucide-react";
import { SubmissionComments } from "./SubmissionComments";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";

interface SubmissionCommentsPanelProps {
  submission: Song | null; // Changed from submissionId to the full object
  roundStatus: "voting" | "finished" | "submissions";
  onOpenChange: (isOpen: boolean) => void;
  onPlaySong: (song: Song) => void;
}

const PanelHeaderSkeleton = () => (
  <div className="flex items-center gap-4">
    <Skeleton className="size-16 rounded-md" />
    <div className="space-y-2">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-32" />
    </div>
  </div>
);

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
                  <Image src={submission.albumArtUrl} alt={submission.songTitle} width={64} height={64} className="rounded-md flex-shrink-0" />
                  <div className="truncate">
                    <p className="text-lg font-bold truncate">{submission.songTitle}</p>
                    <p className="text-sm text-muted-foreground truncate">{submission.artist}</p>
                  </div>
                </div>
                <Button size="icon" variant="outline" className="flex-shrink-0" onClick={() => onPlaySong(submission)}>
                  {isPlaying && currentTrack?._id === submission._id ? <Pause/> : <Play />}
                </Button>
              </div>
            ) : <PanelHeaderSkeleton />}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {submission && (
            <SubmissionComments submissionId={submission._id as Id<"submissions">} roundStatus={roundStatus} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}