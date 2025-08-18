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

export function NowPlayingView() {
  const { currentTrackIndex, queue, actions, isContextViewOpen } =
    useMusicPlayerStore();
  const track = currentTrackIndex !== null ? queue[currentTrackIndex] : null;
  const { width } = useWindowSize();
  const isMobile = width < 768;

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