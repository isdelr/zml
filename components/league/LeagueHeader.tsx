"use client";

import { Button } from "@/components/ui/button";
import { Search, Users, Copy, Settings, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toSvg } from "jdenticon";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import type { LeagueData, LeagueSearchResults } from "@/lib/convex/types";
import type { Song } from "@/types";
import { toErrorMessage } from "@/lib/errors";

interface LeagueHeaderProps {
  leagueData: LeagueData;
  currentUser: unknown;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSettingsOpen: () => void;
  searchContainerRef: React.RefObject<HTMLDivElement | null>;
  searchResults: LeagueSearchResults | undefined;
  handleRoundSelect: (roundId: Id<"rounds">) => void;
  playerActions: {
    playSong: (song: Song) => void;
  };
}

export function LeagueHeader({
  leagueData,
  searchTerm,
  onSearchChange,
  onSettingsOpen,
  searchContainerRef,
  searchResults,
  handleRoundSelect,
  playerActions,
}: LeagueHeaderProps) {
  const leaveLeague = useMutation(api.leagues.leaveLeague);

  const handleCopyInvite = () => {
    if (!leagueData.inviteCode) return;
    const inviteUrl = `${window.location.origin}/invite/${leagueData.inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied to clipboard!");
  };

  const handleLeaveLeague = () => {
    if (!window.confirm("Are you sure you want to leave this league?")) return;
    toast.promise(
      leaveLeague({ leagueId: leagueData._id }),
      {
        loading: "Leaving league...",
        success: "You left the league.",
        error: (err: unknown) => toErrorMessage(err, "Failed to leave league."),
      },
    );
  };

  return (
    <header className="mb-8 flex flex-col-reverse items-start justify-between gap-4 md:flex-row md:items-center">
      <div className="flex items-center gap-4">
        {/* Invite Button Popover */}
        {leagueData.canManageLeague && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Users className="mr-2 size-4" />
                Invite People
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Invite Link</h4>
                  <p className="text-sm text-muted-foreground">
                    {leagueData.inviteCode
                      ? "Share this link with others to join your league."
                      : "Invites are currently disabled."}
                  </p>
                </div>
                {leagueData.inviteCode && (
                  <div className="grid gap-2">
                    <Label htmlFor="invite-link">League Invite Link</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="invite-link"
                        readOnly
                        value={`${
                          typeof window !== "undefined"
                            ? window.location.origin
                            : ""
                        }/invite/${leagueData.inviteCode}`}
                      />
                      <Button
                        size="icon"
                        className="h-9 w-9"
                        onClick={handleCopyInvite}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Settings Dialog Trigger */}
        {leagueData.canManageLeague && (
          <Button variant="outline" size="icon" onClick={onSettingsOpen}>
            <Settings className="size-4" />
            <span className="sr-only">League Settings</span>
          </Button>
        )}
        {leagueData.isMember && !leagueData.isOwner && (
          <Button
            variant="destructive"
            onClick={handleLeaveLeague}
            className="flex items-center gap-2"
            title="Leave League"
          >
            <LogOut className="size-4" />
            Leave League
          </Button>
        )}
      </div>
      <div
        className="relative w-full flex-1 md:max-w-xs"
        ref={searchContainerRef}
      >
        <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search in this league..."
          className="h-10 w-full rounded-md border-none bg-secondary pl-10 pr-4 text-sm"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {/* Search Results Dropdown */}
        {searchResults &&
          (searchResults.rounds.length > 0 ||
            searchResults.songs.length > 0) && (
            <div className="absolute top-full z-10 mt-2 w-full rounded-md border bg-card shadow-lg">
              <div className="max-h-96 overflow-y-auto p-2">
                {/* Rounds Section */}
                {searchResults.rounds.length > 0 && (
                  <div>
                    <h4 className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
                      Rounds
                    </h4>
                    <div className="flex flex-col">
                      {searchResults.rounds.map((round) => (
                        <Button
                          key={round._id}
                          variant="ghost"
                          className="h-auto w-full justify-start p-2 text-left"
                          onClick={() => {
                            handleRoundSelect(round._id);
                            onSearchChange("");
                          }}
                        >
                          <p className="font-semibold truncate overflow-hidden text-ellipsis whitespace-nowrap">{round.title}</p>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Songs Section */}
                {searchResults.songs.length > 0 && (
                  <div className="mt-2">
                    <h4 className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
                      Songs
                    </h4>
                    <div className="flex flex-col">
                      {searchResults.songs.map((song) => (
                        <Button
                          key={song._id}
                          variant="ghost"
                          className="flex h-auto w-full items-center justify-start gap-3 p-2 text-left"
                          onClick={() => {
                            playerActions.playSong(song);
                            onSearchChange("");
                          }}
                        >
                          <Avatar className="shrink-0 size-8">
                            <AvatarImage
                              src={song.albumArtUrl ?? undefined}
                              alt={song.songTitle}
                            />
                            <AvatarFallback>
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: toSvg(String(song._id), 32),
                                }}
                              />
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{song.songTitle}</p>
                            <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
      </div>
    </header>
  );
}
