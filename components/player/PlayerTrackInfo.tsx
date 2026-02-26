"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/lib/convex/api";
import { Song } from "@/types";

interface PlayerTrackInfoProps {
  currentTrack: Song;
  isBookmarked: boolean;
  onBookmarkToggle: () => void;
}

export function PlayerTrackInfo({ currentTrack }: PlayerTrackInfoProps) {
  const getPresignedAlbumArtUrl = useAction(
    api.submissions.getPresignedAlbumArtUrl
  );

  const [effectiveUrl, setEffectiveUrl] = useState<string | null>(
    currentTrack?.albumArtUrl ?? null
  );
  const refreshTimeoutRef = useRef<number | null>(null);

  const parseExpiryFromUrl = (url?: string | null): number | null => {
    if (!url) return null;
    try {
      const u = new URL(url);
      const expires = u.searchParams.get("X-Amz-Expires");
      const date = u.searchParams.get("X-Amz-Date");
      if (expires && date) {
        const year = Number(date.slice(0, 4));
        const month = Number(date.slice(4, 6)) - 1;
        const day = Number(date.slice(6, 8));
        const hour = Number(date.slice(9, 11));
        const min = Number(date.slice(11, 13));
        const sec = Number(date.slice(13, 15));
        const startMs = Date.UTC(year, month, day, hour, min, sec);
        const expSec = Number(expires);
        if (!isNaN(startMs) && !isNaN(expSec)) {
          return startMs + expSec * 1000;
        }
      }
    } catch {}
    return null;
  };

  const scheduleRefresh = (url?: string | null) => {
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    if (!currentTrack || currentTrack.submissionType !== "file") return;
    const expiry = parseExpiryFromUrl(url);
    const SAFETY_MS = 60_000;
    let delay: number;
    if (expiry) {
      delay = Math.max(0, expiry - SAFETY_MS - Date.now());
    } else {
      // Fallback periodic refresh every 30 minutes for file submissions
      delay = 30 * 60 * 1000;
    }
    refreshTimeoutRef.current = window.setTimeout(async () => {
      try {
        const newUrl = await getPresignedAlbumArtUrl({
          submissionId: currentTrack._id,
        });
        if (newUrl) {
          // Prefetch to avoid flicker
          const img = new window.Image();
          img.onload = () => {
            setEffectiveUrl(newUrl);
            scheduleRefresh(newUrl);
          };
          img.src = newUrl;
        } else {
          // stop scheduling if cannot refresh
        }
      } catch {
        // silent
      }
    }, delay);
  };

  useEffect(() => {
    setEffectiveUrl(currentTrack?.albumArtUrl ?? null);
    scheduleRefresh(currentTrack?.albumArtUrl ?? null);
    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?._id]);

  if (!currentTrack) return null;

  const src = effectiveUrl ?? currentTrack.albumArtUrl;

  return (
    <div className="flex w-full min-w-0 items-center gap-3 md:w-1/4">
      {src ? (
        <Image
          src={src}
          alt={currentTrack.songTitle}
          width={48}
          height={48}
          className="flex-shrink-0 rounded-md"
        />
      ) : null}
      <div className="truncate">
        <p className="truncate text-sm font-semibold">{currentTrack.songTitle}</p>
        <p className="truncate text-xs text-muted-foreground">{currentTrack.artist}</p>
      </div>
    </div>
  );
}
