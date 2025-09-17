"use client";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { useWindowSize } from "@/hooks/useWindowSize";
import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function NowPlayingView() {
  const { currentTrackIndex, queue, actions, isContextViewOpen } =
    useMusicPlayerStore();
  const track = currentTrackIndex !== null ? queue[currentTrackIndex] : null;
  const { width } = useWindowSize();
  const isMobile = width < 768;

  // Lyrics fetching state & action
  const getLyrics = useAction(api.lyrics.getForSubmission);
  const [lyrics, setLyrics] = useState<string | null>(track?.lyrics ?? null);
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);

  // Reset lyrics state when track changes
  useEffect(() => {
    setLyrics(track?.lyrics ?? null);
    setLyricsError(null);
    setIsLyricsLoading(false);
  }, [track?._id]);

  // Fetch lyrics when Now Playing opens or track changes and lyrics are missing
  useEffect(() => {
    if (!track || !isContextViewOpen) return;
    if (lyrics && lyrics.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        setIsLyricsLoading(true);
        const result = await getLyrics({ submissionId: track._id as Id<"submissions"> });
        if (cancelled) return;
        setLyrics(result);
      } catch (e) {
        if (cancelled) return;
        console.error("Failed to fetch lyrics", e);
        setLyricsError("Could not load lyrics.");
      } finally {
        if (!cancelled) setIsLyricsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track?._id, isContextViewOpen, getLyrics, lyrics]);

  if (!track) return null;

  const { songTitle, artist, albumArtUrl, submittedBy, roundTitle, leagueName, leagueId, comment } =
    track;

  const NowPlayingContent = () => (
    <div className="flex-grow space-y-6">
      <div className="relative">
        <Image
          src={albumArtUrl}
          alt={songTitle}
          width={352}
          height={352}
          className="rounded-lg aspect-square object-cover w-full"
        />
      </div>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-2xl font-bold">{songTitle}</h3>
          <p className="text-lg text-muted-foreground">{artist}</p>
        </div>
      </div>
      {comment && (
        <blockquote className="border-l-2 pl-3 text-sm italic text-muted-foreground">
          “{comment}”
        </blockquote>
      )}
      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle className="text-base">Track Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-card-foreground">
          {submittedBy && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Submitted by</span>
              <span>{submittedBy}</span>
            </div>
          )}
          {roundTitle && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Round</span>
              <span className="text-right">{roundTitle}</span>
            </div>
          )}
          {leagueName && leagueId && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">League</span>
              <Link
                href={`/leagues/${leagueId}`}
                className="hover:underline text-right"
                onClick={actions.closeContextView}
              >
                {leagueName}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h4 className="text-base font-semibold">Lyrics</h4>
        <div className="bg-muted/30 rounded-md p-4">
          {isLyricsLoading && (
            <p className="text-sm text-muted-foreground">Loading lyrics...</p>
          )}
          {lyricsError && (
            <p className="text-sm text-destructive">{lyricsError}</p>
          )}
          {!isLyricsLoading && !lyricsError && lyrics && (
            <pre className="whitespace-pre-wrap leading-relaxed text-lg md:text-xl font-sans">
              {lyrics}
            </pre>
          )}
          {!isLyricsLoading && !lyricsError && !lyrics && (
            <p className="text-sm text-muted-foreground">No lyrics found.</p>
          )}
        </div>
      </section>
    </div>
  );

  if (!isContextViewOpen) return null;

  return (
    <>
      {!isMobile && (
        <aside className={cn("hidden md:flex flex-col w-96 bg-sidebar p-4 text-sidebar-foreground border-l border-sidebar-border h-screen overflow-y-auto pb-28")}>
          <div className="flex justify-between items-center mb-4">
            <p className="font-semibold">{artist}</p>
            <Button variant="ghost" size="icon" onClick={actions.closeContextView}>
              <X className="size-5" />
            </Button>
          </div>
          <NowPlayingContent />
        </aside>
      )}

      {isMobile && (
        <Sheet open={isContextViewOpen} onOpenChange={(isOpen) => !isOpen && actions.closeContextView()}>
          <SheetContent side="bottom" className="h-[90dvh] flex flex-col p-0 ">
            <SheetHeader className="p-4 border-b flex-shrink-0">
              <SheetTitle className="text-center">{songTitle}</SheetTitle>
              <p className="text-sm text-muted-foreground text-center">{artist}</p>
            </SheetHeader>
            <div className="overflow-y-auto p-4 space-y-6">
              <NowPlayingContent />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}