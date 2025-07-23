// components/NowPlayingView.tsx
"use client";

import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";

export function NowPlayingView() {
  const { currentTrackIndex, queue, actions, isContextViewOpen } = useMusicPlayerStore();
  const track = currentTrackIndex !== null ? queue[currentTrackIndex] : null;

  if (!isContextViewOpen || !track) {
    return null;
  }

  const { songTitle, artist, albumArtUrl, submittedBy, roundTitle, leagueName, leagueId, comment } = track;

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col w-96 bg-sidebar p-4 text-sidebar-foreground border-l border-sidebar-border h-screen overflow-y-auto"
      )}
    >
      <div className="flex justify-between items-center mb-4">
        <p className="font-semibold">{artist}</p>
        <Button variant="ghost" size="icon" onClick={actions.closeContextView}>
          <X className="size-5" />
        </Button>
      </div>

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
                &quot;{comment}&quot;
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
      </div>
    </aside>
  );
}