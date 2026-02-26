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
import { useEffect, useState, useMemo } from "react";
import { useAction } from "convex/react";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import { toErrorMessage } from "@/lib/errors";

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
  }, [track?._id, track?.lyrics]);

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
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to fetch lyrics", error);
        setLyricsError(toErrorMessage(error, "Could not load lyrics."));
      } finally {
        if (!cancelled) setIsLyricsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track, track?._id, isContextViewOpen, getLyrics, lyrics]);

  // Derived lyric parsing and timing
  const currentTime = useMusicPlayerStore((s) => s.currentTime);

  const isLrc = useMemo(() => {
    if (!lyrics) return false;
    return /\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/.test(lyrics);
  }, [lyrics]);

  type LrcLine = { time: number; text: string };
  const lrcLines: LrcLine[] | null = useMemo(() => {
    if (!isLrc || !lyrics) return null;
    const lines = lyrics.split(/\r?\n/);
    const out: LrcLine[] = [];
    const tsRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    for (const line of lines) {
      let m: RegExpExecArray | null;
      const times: number[] = [];
      while ((m = tsRegex.exec(line)) !== null) {
        const minutePart = m[1];
        const secondPart = m[2];
        if (!minutePart || !secondPart) continue;
        const min = parseInt(minutePart, 10) || 0;
        const sec = parseInt(secondPart, 10) || 0;
        const ms = m[3] ? parseInt((m[3] + "00").slice(0, 3), 10) : 0;
        const t = min * 60 + sec + ms / 1000;
        times.push(t);
      }
      const text = line.replace(tsRegex, "").trim();
      if (times.length && text) {
        for (const t of times) out.push({ time: t, text });
      }
    }
    out.sort((a, b) => a.time - b.time);
    return out;
  }, [isLrc, lyrics]);

  const activeIndex = useMemo(() => {
    if (!lrcLines || lrcLines.length === 0) return -1;
    const t = currentTime || 0;
    let idx = -1;
    for (let i = 0; i < lrcLines.length; i++) {
      const line = lrcLines[i];
      if (!line) continue;
      if (line.time <= t) idx = i;
      else break;
    }
    return idx;
  }, [lrcLines, currentTime]);

  const verseParagraphs: string[][] | null = useMemo(() => {
    if (!lyrics || isLrc) return null;
    return lyrics
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => p.split(/\n/));
  }, [lyrics, isLrc]);

  if (!track) return null;

  const { songTitle, artist, albumArtUrl, submittedBy, roundTitle, leagueName, leagueId, comment } =
    track;
  const canRevealSubmitter = track.roundStatus === "finished";
  const visibleSubmittedBy = canRevealSubmitter ? submittedBy : null;
  const hasTrackInformation = Boolean(
    visibleSubmittedBy || roundTitle || leagueName,
  );

  const NowPlayingContent = () => (
    <div className="flex-grow space-y-6">
      <div className="relative">
        <Image
          src={albumArtUrl ?? "/icons/web-app-manifest-192x192.png"}
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
          {hasTrackInformation ? (
            <>
              {visibleSubmittedBy && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Submitted by</span>
                  <span>{visibleSubmittedBy}</span>
                </div>
              )}
              {roundTitle && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Round</span>
                  <span className="text-right">{roundTitle}</span>
                </div>
              )}
              {leagueName ? (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">League</span>
                  {leagueId ? (
                    <Link
                      href={`/leagues/${leagueId}`}
                      className="hover:underline text-right"
                      onClick={actions.closeContextView}
                    >
                      {leagueName}
                    </Link>
                  ) : (
                    <span className="text-right">{leagueName}</span>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Track details are unavailable for this source.
            </p>
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
            <p className="text-sm text-center text-muted-foreground">{lyricsError}</p>
          )}
          {!isLyricsLoading && !lyricsError && lyrics && (
            <div className="leading-relaxed text-md md:text-lg font-sans">
              {isLrc && lrcLines ? (
                <div className="space-y-1">
                  {lrcLines.map((line, i) => {
                    const isActive = i === activeIndex;
                    const isSectionHeader = /^(verse|chorus|bridge|intro|outro)/i.test(line.text);
                    return (
                      <div
                        key={`${line.time}-${i}`}
                        className={cn(
                          "transition-colors duration-200",
                          isActive ? "text-foreground font-semibold" : "text-muted-foreground",
                          isSectionHeader && "mt-3"
                        )}
                      >
                        {line.text}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  {verseParagraphs?.map((lines, idx) => (
                    <p key={idx} className="whitespace-pre-wrap">
                      {lines.join("\n")}
                    </p>
                  ))}
                </div>
              )}
            </div>
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
