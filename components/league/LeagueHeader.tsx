"use client";

import { Button } from "@/components/ui/button";
import { Search, Users, Copy, Settings } from "lucide-react";
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

interface LeagueHeaderProps {
  leagueData: unknown;
  currentUser: unknown;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSettingsOpen: () => void;
  searchContainerRef: React.RefObject<HTMLDivElement>;
  searchResults: unknown;
  handleRoundSelect: (roundId: string) => void;
  playerActions: unknown;
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
  const handleCopyInvite = () => {
    if (!leagueData?.inviteCode) return;
    const inviteUrl = `${window.location.origin}/invite/${leagueData.inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied to clipboard!");
  };

  return (
    <header className="mb-8 flex flex-col-reverse items-start justify-between gap-4 md:flex-row md:items-center">
      <div className="flex items-center gap-4">
        {/* Invite Button Popover */}
        {leagueData?.isOwner && (
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
        {leagueData?.isOwner && (
          <Button variant="outline" size="icon" onClick={onSettingsOpen}>
            <Settings className="size-4" />
            <span className="sr-only">League Settings</span>
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
            <div className="absolute top-full z-10 mt-2 w-full max-w-xs rounded-md border bg-card shadow-lg">
              <div className="max-h-96 overflow-y-auto p-2">
                {/* Rounds Section */}
                {searchResults.rounds.length > 0 && (
                  <div>
                    <h4 className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
                      Rounds
                    </h4>
                    <div className="flex flex-col">
                      {searchResults.rounds.map((round: unknown) => (
                        <Button
                          key={round._id}
                          variant="ghost"
                          className="h-auto justify-start p-2 text-left"
                          onClick={() => {
                            handleRoundSelect(round._id);
                            onSearchChange("");
                          }}
                        >
                          <p className="font-semibold">{round.title}</p>
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
                      {searchResults.songs.map((song: unknown) => (
                        <Button
                          key={song._id}
                          variant="ghost"
                          className="flex h-auto items-center justify-start gap-3 p-2 text-left"
                          onClick={() => {
                            playerActions.playSong(song);
                            onSearchChange("");
                          }}
                        >
                          <Avatar className="size-8">
                            <AvatarImage
                              src={song.albumArtUrl}
                              alt={song.songTitle}
                            />
                            <AvatarFallback>
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: toSvg(song._id, 32),
                                }}
                              />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{song.songTitle}</p>
                            <p className="text-sm text-muted-foreground">
                              {song.artist}
                            </p>
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
