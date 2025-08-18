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
import { Skeleton } from "@/components/ui/skeleton";
import { toSvg } from "jdenticon";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

interface LeagueJoinCardProps {
  leagueData: Id<"leagues">;
  rounds: Id<"rounds">;
}

export function LeagueJoinCard({ leagueData, rounds }: LeagueJoinCardProps) {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const joinLeagueMutation = useMutation(api.leagues.joinPublicLeague);

  const handleJoinLeague = async () => {
    if (!isAuthenticated) {
      signIn("discord");
      return;
    }
    const toastId = toast.loading("Joining league...");
    try {
      const result = await joinLeagueMutation({
        leagueId: leagueData._id as Id<"leagues">,
      });
      if (result === "not_found") {
        toast.error("This league does not exist.", { id: toastId });
        router.push("/explore");
      } else if (result === "already_joined") {
        toast.info("You are already in this league.", { id: toastId });
      } else {
        toast.success(`Successfully joined ${leagueData.name}!`, {
          id: toastId,
        });
        router.push(`/leagues/${String(result)}`);
      }
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Failed to join league.", { id: toastId });
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
            <div className="flex items-center gap-2">
              <span>{leagueData.memberCount} members</span>
              {leagueData.members && <AvatarStack users={leagueData.members} />}
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
