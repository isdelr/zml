"use client";

import { useAction } from "convex/react";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FileText } from "lucide-react";

interface LyricsDisplayProps {
  submissionId: Id<"submissions">;
  songTitle: string;
}

export function LyricsDisplay({ submissionId, songTitle }: LyricsDisplayProps) {
  const getLyrics = useAction(api.lyrics.getForSubmission);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFetchLyrics = async () => {
    if (!submissionId || lyrics) return;
    setIsLoading(true);
    try {
      const result = await getLyrics({ submissionId });
      setLyrics(result);
    } catch (error) {
      console.error("Failed to fetch lyrics", error);
      setLyrics("An error occurred while fetching lyrics.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" onClick={handleFetchLyrics} title="View lyrics">
          <FileText className="size-5" />
          <span className="sr-only">View Lyrics</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Lyrics for {songTitle}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto pr-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading lyrics...</p>}
          {lyrics && (
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
              {lyrics}
            </pre>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
