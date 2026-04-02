"use client";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { usePlaybackClockStore } from "@/hooks/usePlaybackClockStore";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { useWindowSize } from "@/hooks/useWindowSize";
import { memo, useEffect, useState, useMemo, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import { toErrorMessage } from "@/lib/errors";
import { buildTrackMetadataText } from "@/lib/music/submission-display";
import { MediaImage } from "@/components/ui/media-image";
import { useShallow } from "zustand/react/shallow";

const FRIENDLY_LYRICS_ERROR =
  "Lyrics are unavailable for this song right now. Please try again later.";

function toLyricsErrorMessage(error: unknown): string {
  const raw = toErrorMessage(error, "").toLowerCase();
  if (raw.includes("no hits") || raw.includes("lyrics not found")) {
    return "No lyrics were found for this song.";
  }
  return FRIENDLY_LYRICS_ERROR;
}

type LrcLine = { time: number; text: string };

const TimedLyrics = memo(function TimedLyrics({
  lines,
}: {
  lines: LrcLine[];
}) {
  const currentTime = usePlaybackClockStore((state) => state.currentTime);

  const activeIndex = useMemo(() => {
    if (lines.length === 0) return -1;
    const t = currentTime || 0;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      if (line.time <= t) idx = i;
      else break;
    }
    return idx;
  }, [currentTime, lines]);

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const isActive = i === activeIndex;
        const isSectionHeader =
          /^(verse|chorus|bridge|intro|outro)/i.test(line.text);

        return (
          <div
            key={`${line.time}-${i}`}
            className={cn(
              "transition-colors duration-200",
              isActive
                ? "text-foreground font-semibold"
                : "text-muted-foreground",
              isSectionHeader && "mt-3",
            )}
          >
            {line.text}
          </div>
        );
      })}
    </div>
  );
});

export function NowPlayingView() {
  const { track, closeContextView, isContextViewOpen } = useMusicPlayerStore(
    useShallow((state) => ({
      track:
        state.currentTrackIndex !== null
          ? state.queue[state.currentTrackIndex] ?? null
          : null,
      closeContextView: state.actions.closeContextView,
      isContextViewOpen: state.isContextViewOpen,
    })),
  );
  const { width } = useWindowSize();
  const isDesktopRail = width >= 1400;
  const lyricsCacheRef = useRef<Record<string, string>>({});
  const lyricsCacheKey = track
    ? `${track._id}:${track.artist}:${track.songTitle}`
    : null;
  const cachedLyrics = lyricsCacheKey
    ? lyricsCacheRef.current[lyricsCacheKey] ?? null
    : null;

  // Lyrics fetching state & action
  const getLyrics = useAction(api.lyrics.getForSubmission);
  const [lyrics, setLyrics] = useState<string | null>(
    track?.lyrics ?? cachedLyrics ?? null,
  );
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);

  // Reset lyrics state when track changes
  useEffect(() => {
    setLyrics(track?.lyrics ?? cachedLyrics ?? null);
    setLyricsError(null);
    setIsLyricsLoading(false);
  }, [cachedLyrics, lyricsCacheKey, track?.lyrics]);

  // Fetch lyrics when Now Playing opens or track changes and lyrics are missing
  useEffect(() => {
    if (!track || !isContextViewOpen || !lyricsCacheKey) return;
    if (track.lyrics || cachedLyrics) return;
    let cancelled = false;
    (async () => {
      try {
        setIsLyricsLoading(true);
        const result = await getLyrics({
          submissionId: track._id as Id<"submissions">,
        });
        if (cancelled) return;
        if (result) {
          lyricsCacheRef.current[lyricsCacheKey] = result;
        }
        setLyrics(result);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to fetch lyrics", error);
        setLyricsError(toLyricsErrorMessage(error));
      } finally {
        if (!cancelled) setIsLyricsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cachedLyrics, getLyrics, isContextViewOpen, lyricsCacheKey, track]);

  const isLrc = useMemo(() => {
    if (!lyrics) return false;
    return /\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/.test(lyrics);
  }, [lyrics]);

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

  const verseParagraphs: string[][] | null = useMemo(() => {
    if (!lyrics || isLrc) return null;
    return lyrics
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => p.split(/\n/));
  }, [lyrics, isLrc]);

  if (!track) return null;

  const {
    songTitle,
    artist,
    albumName,
    year,
    albumArtUrl,
    submittedBy,
    roundTitle,
    leagueName,
    leagueId,
    comment,
  } = track;
  const metadataText = buildTrackMetadataText(artist, albumName, year);
  const albumYearText = [albumName?.trim(), year ? String(year) : ""]
    .filter(Boolean)
    .join(" • ");
  const canRevealSubmitter = track.roundStatus === "finished";
  const visibleSubmittedBy = canRevealSubmitter ? submittedBy : null;
  const hasTrackInformation = Boolean(
    visibleSubmittedBy || roundTitle || leagueName || albumName || year,
  );

  const NowPlayingContent = () => (
    <div className="flex-grow space-y-6">
      <div className="relative">
        <MediaImage
          src={albumArtUrl ?? "/icons/web-app-manifest-192x192.png"}
          alt={songTitle}
          width={352}
          height={352}
          className="rounded-lg aspect-square object-cover w-full"
          fallbackSrc="/icons/web-app-manifest-192x192.png"
        />
      </div>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-2xl font-bold">{songTitle}</h3>
          <p className="text-lg text-muted-foreground">{artist}</p>
          {albumYearText ? (
            <p className="text-sm text-muted-foreground/80">{albumYearText}</p>
          ) : null}
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
              {albumName && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Album</span>
                  <span className="text-right">{albumName}</span>
                </div>
              )}
              {year ? (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Release Year</span>
                  <span className="text-right">{year}</span>
                </div>
              ) : null}
              {leagueName ? (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">League</span>
                  {leagueId ? (
                    <Link
                      href={`/leagues/${leagueId}`}
                      className="hover:underline text-right"
                      onClick={closeContextView}
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
            <p className="text-sm text-center text-muted-foreground">
              {lyricsError}
            </p>
          )}
          {!isLyricsLoading && !lyricsError && lyrics && (
            <div className="leading-relaxed text-md md:text-lg font-sans">
              {isLrc && lrcLines ? (
                <TimedLyrics lines={lrcLines} />
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
      {isDesktopRail && (
        <aside
          className={cn(
            "hidden h-screen w-[22rem] flex-col overflow-y-auto border-l border-sidebar-border bg-sidebar p-4 pb-28 text-sidebar-foreground min-[1400px]:flex 2xl:w-96",
          )}
        >
          <div className="flex justify-between items-center mb-4">
            <p className="truncate font-semibold">{metadataText}</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeContextView}
            >
              <X className="size-5" />
            </Button>
          </div>
          <NowPlayingContent />
        </aside>
      )}

      {!isDesktopRail && (
        <Sheet
          open={isContextViewOpen}
          onOpenChange={(isOpen) => !isOpen && closeContextView()}
        >
          <SheetContent side="bottom" className="h-[90dvh] flex flex-col p-0 ">
            <SheetHeader className="p-4 border-b flex-shrink-0">
              <SheetTitle className="text-center">{songTitle}</SheetTitle>
              <p className="text-sm text-muted-foreground text-center">
                {metadataText}
              </p>
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
