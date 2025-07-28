// components/NowPlayingView.tsx
"use client";

import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { Users, X } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AvatarStack } from "./AvatarStack";
import { Skeleton } from "./ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { useWindowSize } from "@/hooks/useWindowSize"; // A new custom hook

export function NowPlayingView() {
  const { currentTrackIndex, queue, actions, isContextViewOpen } =
    useMusicPlayerStore();
  const track = currentTrackIndex !== null ? queue[currentTrackIndex] : null;
  const { width } = useWindowSize();
  const isMobile = width < 768; // 768px is the default for md in Tailwind

  const currentUser = useQuery(api.users.getCurrentUser);
  const listeners = useQuery(
    api.presence.list,
    track ? { location: track._id } : { location: null },
  );

  const otherListeners = listeners?.filter(
    (listener) => listener.name !== currentUser?.name,
  );

  if (!track) {
    return null;
  }

  const {
    songTitle,
    artist,
    albumArtUrl,
    submittedBy,
    roundTitle,
    leagueName,
    leagueId,
    comment,
  } = track;

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
          &quot;{comment}&quot;
        </blockquote>
      )}

      <Card className="bg-card/50">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Users className="size-5 text-muted-foreground" />
          <CardTitle className="text-base">Listening Now</CardTitle>
        </CardHeader>
        <CardContent>
          {listeners === undefined || currentUser === undefined ? (
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ) : otherListeners && otherListeners.length > 0 ? (
            <AvatarStack users={otherListeners} />
          ) : (
            <p className="text-sm text-muted-foreground">
              You&apos;re the only one listening right now.
            </p>
          )}
        </CardContent>
      </Card>

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

  if (!isContextViewOpen) {
    return null;
  }

  return (
    <>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside
          className={cn(
            "hidden md:flex flex-col w-96 bg-sidebar p-4 text-sidebar-foreground border-l border-sidebar-border h-screen overflow-y-auto pb-28",
          )}
        >
          <div className="flex justify-between items-center mb-4">
            <p className="font-semibold">{artist}</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={actions.closeContextView}
            >
              <X className="size-5" />
            </Button>
          </div>
          <NowPlayingContent />
        </aside>
      )}

      {/* Mobile Sheet */}
      {isMobile && (
        <Sheet
          open={isContextViewOpen}
          onOpenChange={(isOpen) => !isOpen && actions.closeContextView()}
        >
          <SheetContent side="bottom" className="h-[90dvh] flex flex-col p-0 ">
            <SheetHeader className="p-4 border-b flex-shrink-0">
              <SheetTitle className="text-center">{songTitle}</SheetTitle>
              <p className="text-sm text-muted-foreground text-center">
                {artist}
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