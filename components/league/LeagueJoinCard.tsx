"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AvatarStack } from "@/components/AvatarStack";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toSvg } from "jdenticon";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex/api";
import { useConvexAuth } from "convex/react";
import { Eye } from "lucide-react";
import type { LeagueData, RoundForLeague } from "@/lib/convex/types";
import { signInWithDiscord } from "@/lib/auth-client";
import { toErrorMessage } from "@/lib/errors";

interface LeagueJoinCardProps {
  leagueData: LeagueData;
  rounds: RoundForLeague[] | undefined;
}

export function LeagueJoinCard({ leagueData, rounds }: LeagueJoinCardProps) {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const joinLeagueMutation = useMutation(api.leagues.joinPublicLeague);

  const handleJoinLeague = async (asSpectator: boolean = false) => {
    if (!isAuthenticated) {
      await signInWithDiscord();
      return;
    }
    const toastId = toast.loading(asSpectator ? "Joining as spectator..." : "Joining league...");
    try {
      const result = await joinLeagueMutation({
        leagueId: leagueData._id,
        asSpectator,
      });
      if (result === "not_found") {
        toast.error("This league does not exist.", { id: toastId });
        router.push("/explore");
      } else if (result === "already_joined") {
        toast.info("You are already in this league.", { id: toastId });
      } else {
        toast.success(`Successfully joined ${leagueData.name}${asSpectator ? " as a spectator" : ""}!`, {
          id: toastId,
        });
        router.push(`/leagues/${String(result)}`);
      }
    } catch (error: unknown) {
      console.error(error);
      toast.error(toErrorMessage(error, "Failed to join league."), {
        id: toastId,
      });
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-background p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl">{leagueData.name}</CardTitle>
          <CardDescription>{leagueData.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {leagueData.members && <AvatarStack users={leagueData.members} />}
                <span>{leagueData.activeMemberCount ?? leagueData.memberCount} {(leagueData.activeMemberCount ?? leagueData.memberCount) === 1 ? "member" : "members"}</span>
              </div>
              {leagueData.spectatorCount > 0 && (
                <div className="flex items-center gap-2">
                  {leagueData.spectators && <AvatarStack users={leagueData.spectators} />}
                  <span>{leagueData.spectatorCount} {leagueData.spectatorCount === 1 ? "spectator" : "spectators"}</span>
                </div>
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
                  <div
                    dangerouslySetInnerHTML={{
                      __html: toSvg(String(leagueData.creatorId), 24),
                    }}
                  />
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
              {rounds?.length === 0 && (
                <p className="p-2 text-center text-sm text-muted-foreground">
                  No rounds created yet.
                </p>
              )}
              {rounds?.map((round) => (
                <Card key={round._id} className="p-3">
                  <p className="font-medium">{round.title}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {round.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Button size="lg" className="w-full" onClick={() => handleJoinLeague(false)}>
              Join League
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full" 
              onClick={() => handleJoinLeague(true)}
            >
              <Eye className="mr-2 size-4" />
              Join as Spectator
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Spectators can listen to playlists but cannot submit songs or vote
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
