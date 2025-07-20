"use client";

import { Play, Search, Users, Copy, Settings } from "lucide-react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { RoundDetail } from "./RoundDetail";
import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "./ui/skeleton";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { AvatarStack } from "./AvatarStack";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import { Loader2 } from "lucide-react";
import { Standings } from "./Standings";
import { LeagueStats } from "./LeagueStats";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import Image from "next/image";
import { Song } from "@/types";
import { toSvg } from "jdenticon";

const leagueEditSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters."),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters."),
  isPublic: z.boolean(),
  submissionDeadline: z.coerce.number().min(1),
  votingDeadline: z.coerce.number().min(1),
  maxPositiveVotes: z.coerce.number().min(1),
  maxNegativeVotes: z.coerce.number().min(0),
});

function GeneralSettingsTab({
  league,
  onClose,
}: {
  league: Record<string, unknown>;
  onClose: () => void;
}) {
  const updateLeague = useMutation(api.leagues.updateLeague);
  const form = useForm({
    resolver: zodResolver(leagueEditSchema),
    defaultValues: {
      name: league.name as string,
      description: league.description as string,
      isPublic: league.isPublic as boolean,
      submissionDeadline: league.submissionDeadline as number,
      votingDeadline: league.votingDeadline as number,
      maxPositiveVotes: league.maxPositiveVotes as number,
      maxNegativeVotes: league.maxNegativeVotes as number,
    },
  });

  async function onSubmit(values: z.infer<typeof leagueEditSchema>) {
    toast.promise(updateLeague({ leagueId: league._id as Id<"leagues">, ...values }), {
      loading: "Updating league...",
      success: (msg) => {
        onClose();
        return msg;
      },
      error: "Failed to update league.",
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>League Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isPublic"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <FormLabel>Public League</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="submissionDeadline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Submission Period (Days)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="votingDeadline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Voting Period (Days)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          Save Changes
        </Button>
      </form>
    </Form>
  );
}

function MembersTab({
  league,
  currentUser,
}: {
  league: Record<string, unknown>;
  currentUser: Record<string, unknown>;
}) {
  const kickMember = useMutation(api.leagues.kickMember);

  const handleKick = (memberIdToKick: Id<"users">) => {
    toast.promise(kickMember({ leagueId: league._id as Id<"leagues">, memberIdToKick }), {
      loading: "Kicking member...",
      success: "Member kicked.",
      error: (err) => err.data?.message || "Failed to kick member.",
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">League Members</h3>
      <div className="max-h-80 space-y-2 overflow-y-auto pr-2">
        {league.members.map((member: Record<string, unknown>) => (
          <div
            key={member._id}
            className="flex items-center justify-between rounded-md border p-2"
          >
            <div className="flex items-center gap-2">
              <Avatar className="size-8">
                <AvatarImage src={member.image} />
                <AvatarFallback>
                  <div dangerouslySetInnerHTML={{ __html: toSvg(member._id as string, 32) }} />
                </AvatarFallback>
              </Avatar>
              <span>{member.name}</span>
              {member._id === league.creatorId && (
                <span className="text-xs text-yellow-500">(Owner)</span>
              )}
            </div>
            {currentUser?._id === league.creatorId &&
              member._id !== league.creatorId && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleKick(member._id)}
                >
                  Kick
                </Button>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InviteTab({ league }: { league: Record<string, unknown> }) {
  const manageInviteCode = useMutation(api.leagues.manageInviteCode);

  const handleAction = (
    action: "regenerate" | "disable" | "enable",
    messages: { loading: string; success: string; error: string },
  ) => {
    toast.promise(manageInviteCode({ leagueId: league._id as Id<"leagues">, action }), {
      loading: messages.loading,
      success: messages.success,
      error: (err) => err.data?.message || messages.error,
    });
  };

  const inviteUrl =
    league.inviteCode && typeof window !== "undefined"
      ? `${window.location.origin}/invite/${league.inviteCode}`
      : "";

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Manage Invite Link</h3>
      {league.inviteCode ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Input id="invite-link" readOnly value={inviteUrl} />
            <Button
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                navigator.clipboard.writeText(inviteUrl);
                toast.success("Invite link copied!");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                handleAction("regenerate", {
                  loading: "Generating new link...",
                  success: "New invite link generated.",
                  error: "Failed to generate link.",
                })
              }
            >
              Regenerate
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                handleAction("disable", {
                  loading: "Disabling link...",
                  success: "Invite link disabled.",
                  error: "Failed to disable link.",
                })
              }
            >
              Disable Link
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-center">
          <p className="text-muted-foreground">Invite link is disabled.</p>
          <Button
            onClick={() =>
              handleAction("enable", {
                loading: "Enabling link...",
                success: "New invite link enabled.",
                error: "Failed to enable link.",
              })
            }
          >
            Enable Invite Link
          </Button>
        </div>
      )}
    </div>
  );
}

function LeagueSettingsDialog({
  league,
  onClose,
  currentUser,
}: {
  league: Record<string, unknown>;
  onClose: () => void;
  currentUser: Record<string, unknown>;
}) {
  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="invite">Invite Link</TabsTrigger>
      </TabsList>
      <TabsContent value="general">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>
              Update your league&apos;s name, description, and rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GeneralSettingsTab league={league} onClose={onClose} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="members">
        <Card>
          <CardHeader>
            <CardTitle>Manage Members</CardTitle>
            <CardDescription>
              View and remove members from your league.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MembersTab league={league} currentUser={currentUser} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="invite">
        <Card>
          <CardHeader>
            <CardTitle>Invite Link</CardTitle>
            <CardDescription>
              Manage how people can join your league.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteTab league={league} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

interface LeaguePageProps {
  leagueId: string;
}

export function LeaguePage({ leagueId }: LeaguePageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const activeTab = searchParams.get("tab") || "rounds";
  const selectedRoundId = searchParams.get("round") as Id<"rounds"> | null;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const leagueData = useQuery(api.leagues.get, {
    id: leagueId as Id<"leagues">,
  });
  const rounds = useQuery(api.rounds.getForLeague, {
    leagueId: leagueId as Id<"leagues">,
  });
  const searchResults = useQuery(
    api.leagues.searchInLeague,
    searchTerm
      ? { leagueId: leagueId as Id<"leagues">, searchText: searchTerm }
      : "skip",
  );
  const currentUser = useQuery(api.users.getCurrentUser);
  const {
    actions: playerActions,
    currentTrackIndex,
  } = useMusicPlayerStore();
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const joinLeagueMutation = useMutation(api.leagues.joinPublicLeague);

  const isLeagueFinished =
    rounds && rounds.length > 0 && rounds.every((r) => r.status === "finished");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [searchContainerRef]);

  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    if (newTab !== "rounds") {
      params.delete("round");
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleRoundSelect = (roundId: Id<"rounds">) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "rounds");
    params.set("round", roundId);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleJoinLeague = async () => {
    if (!isAuthenticated) {
      signIn("discord");
      return;
    }
    const toastId = toast.loading("Joining league...");
    try {
      const result = await joinLeagueMutation({
        leagueId: leagueId as Id<"leagues">,
      });
      if (result === "not_found") {
        toast.error("This league does not exist.", { id: toastId });
        router.push("/explore");
      } else if (result === "already_joined") {
        toast.info("You are already in this league.", { id: toastId });
      } else {
        toast.success(`Successfully joined ${leagueData?.name}!`, {
          id: toastId,
        });
      }
    } catch (error: unknown) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to join league.", {
        id: toastId,
      });
    }
  };

  useEffect(() => {
    if (rounds && rounds.length > 0) {
      const currentTabInUrl = searchParams.get("tab") || "rounds";
      const currentRoundInUrl = searchParams.get("round");

      if (currentTabInUrl === "rounds" && !currentRoundInUrl) {
        const latestRound = rounds.sort(
          (a, b) => b._creationTime - a._creationTime,
        )[0];
        const params = new URLSearchParams(searchParams.toString());
        params.set("round", latestRound._id);
        router.replace(`${pathname}?${params.toString()}`);
      }
    }
  }, [rounds, searchParams, pathname, router]);

  const selectedRound = rounds?.find((r) => r._id === selectedRoundId);

  const handleCopyInvite = () => {
    if (!leagueData?.inviteCode) return;
    const inviteUrl = `${window.location.origin}/invite/${leagueData.inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied to clipboard!");
  };

  const RoundsSkeleton = () => (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-1/4" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );

if (leagueData === undefined) {
    return (
      <div className="flex-1 overflow-y-auto bg-background p-8 animate-pulse">
        {/* Header Skeleton */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-32 rounded-md" />
            <Skeleton className="size-10 rounded-md" />
          </div>
          <Skeleton className="h-10 w-full max-w-xs rounded-md" />
        </header>
        
        {/* Title Skeleton */}
        <div className="mb-12">
          <Skeleton className="mb-4 h-16 w-3/4 rounded-md" />
          <div className="flex items-center gap-6">
            <Skeleton className="h-6 w-36 rounded-md" />
            <Skeleton className="h-6 w-48 rounded-md" />
          </div>
        </div>

        {/* Tabs and Content Skeleton */}
        <Skeleton className="mb-8 h-10 w-full max-w-md rounded-lg" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (leagueData === null) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background ">
        <div className="text-center">
          <h1 className="text-4xl font-bold">League Not Found</h1>
          <p className="mt-4 text-muted-foreground">
            This league does not exist or you may not have permission to view
            it.
          </p>
        </div>
      </div>
    );
  }

  if (!leagueData.isMember) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background p-8">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-3xl">{leagueData.name}</CardTitle>
            <CardDescription>{leagueData.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="size-4" />
                <span>{leagueData.memberCount} members</span>
                {leagueData.members && (
                  <AvatarStack users={leagueData.members} />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span>Created by</span>
                <Avatar className="size-6">
                  <AvatarImage
                    src={leagueData.creatorImage ?? undefined}
                    alt={leagueData.creatorName}
                  />
                  <AvatarFallback>
                    <div dangerouslySetInnerHTML={{ __html: toSvg(leagueData.creatorId, 24) }} />
                  </AvatarFallback>
                </Avatar>
                <strong className="text-foreground">
                  {leagueData.creatorName}
                </strong>
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-semibold">Rounds</h3>
              <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border bg-card p-2">
                {rounds === undefined && <Skeleton className="h-20 w-full" />}
                {rounds && rounds.length === 0 && (
                  <p className="p-2 text-center text-sm text-muted-foreground">
                    No rounds created yet.
                  </p>
                )}
                {rounds &&
                  rounds.map((round) => (
                    <Card key={round._id} className="p-3">
                      <p className="font-medium">{round.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {round.description}
                      </p>
                    </Card>
                  ))}
              </div>
            </div>
            <Button size="lg" className="w-full" onClick={handleJoinLeague}>
              Join League
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto bg-background  ",
        currentTrackIndex !== null && "pb-24",
      )}
    >
      <div className="p-8">
        <header className="mb-8 flex items-center justify-between">
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
                        <Label htmlFor="invite-link">
                          League Invite Link
                        </Label>
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
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings className="size-4" />
                    <span className="sr-only">League Settings</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>League Settings</DialogTitle>
                    <DialogDescription>
                      Manage your league details, members, and invite settings.
                    </DialogDescription>
                  </DialogHeader>
                  <LeagueSettingsDialog
                    league={leagueData}
                    currentUser={currentUser}
                    onClose={() => setIsSettingsOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="relative max-w-xs flex-1" ref={searchContainerRef}>
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search in this league..."
              className="h-10 w-full rounded-md border-none bg-secondary pl-10 pr-4 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {/* Search Results Dropdown */}
            {searchResults &&
              (searchResults.rounds.length > 0 ||
                searchResults.songs.length > 0) && (
                <Card className="absolute top-full z-10 mt-2 w-full max-w-xs shadow-lg">
                  <CardContent className="max-h-96 overflow-y-auto p-2">
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
                              className="h-auto justify-start p-2 text-left"
                              onClick={() => {
                                handleRoundSelect(round._id);
                                setSearchTerm("");
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
                          {searchResults.songs.map((song) => (
                            <Button
                              key={song._id}
                              variant="ghost"
                              className="flex h-auto items-center justify-start gap-3 p-2 text-left"
                              onClick={() => {
                                playerActions.playSong(song as Song);
                                setSearchTerm("");
                              }}
                            >
                              <Image
                                src={song.albumArtUrl}
                                alt={song.songTitle}
                                width={32}
                                height={32}
                                className="rounded"
                              />
                              <div>
                                <p className="font-semibold">
                                  {song.songTitle}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {song.artist}
                                </p>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
          </div>
        </header>

        <div className="mb-12">
          <h1 className="text-6xl font-bold">{leagueData.name}</h1>
          <div className="mt-4 flex items-center gap-6 text-muted-foreground">
            <div className="flex items-center gap-2">
              {leagueData.members && <AvatarStack users={leagueData.members} />}
              <span>{leagueData.memberCount} Members</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Created by</span>
              <Avatar className="size-6">
                <AvatarImage
                  src={leagueData.creatorImage ?? undefined}
                  alt={leagueData.creatorName}
                />
                <AvatarFallback>
                  <div dangerouslySetInnerHTML={{ __html: toSvg(leagueData.creatorId as string, 24) }} />
                </AvatarFallback>
              </Avatar>
              <strong className="text-foreground">
                {leagueData.creatorName}
              </strong>
            </div>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList
            className={cn(
              "mb-8 grid w-full",
              isLeagueFinished ? "grid-cols-3" : "grid-cols-2",
            )}
          >
            <TabsTrigger value="rounds">Rounds</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
            {isLeagueFinished && (
              <TabsTrigger value="awards">Awards</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="rounds">
            {rounds === undefined ? (
              <RoundsSkeleton />
            ) : rounds.length === 0 ? (
              <div className="rounded-md border border-dashed py-10 text-center">
                <h3 className="text-lg font-semibold">No Rounds Yet</h3>
                <p className="mt-1 text-muted-foreground">
                  Create the first round for this league.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rounds.map((round) => (
                  <Card
                    key={round._id}
                    onClick={() => handleRoundSelect(round._id)}
                    className={`cursor-pointer bg-card transition-colors hover:bg-accent ${
                      selectedRoundId === round._id
                        ? "ring-2 ring-primary"
                        : ""
                    }`}
                  >
                    <CardHeader>
                      <CardTitle>{round.title}</CardTitle>
                      <CardDescription>
                        {round.status.charAt(0).toUpperCase() +
                          round.status.slice(1)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {round.submissionCount} submissions
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full bg-primary font-bold text-primary-foreground hover:bg-primary/90">
                        <Play className="mr-2 size-4 fill-primary-foreground" />
                        View Round
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}

            <div className="my-12 border-b border-border"></div>

            {selectedRound && leagueData ? (
              <RoundDetail
                round={selectedRound}
                league={{
                  maxPositiveVotes: leagueData.maxPositiveVotes,
                  maxNegativeVotes: leagueData.maxNegativeVotes,
                }}
                isOwner={leagueData.isOwner}
              />
            ) : rounds && rounds.length > 0 ? (
              <div className="py-10 text-center">
                <p className="text-muted-foreground">
                  Select a round to see the details.
                </p>
              </div>
            ) : null}
          </TabsContent>
          <TabsContent value="standings">
            <Standings leagueId={leagueId as Id<"leagues">} />
          </TabsContent>
          {isLeagueFinished && (
            <TabsContent value="awards">
              <LeagueStats leagueId={leagueId as Id<"leagues">} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}