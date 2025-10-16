"use client";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useRef, useState } from "react";
import { AvatarStack } from "@/components/AvatarStack";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toSvg } from "jdenticon";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye } from "lucide-react";

function InviteCardSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="space-y-2">
            <Skeleton className="mx-auto h-6 w-64" />
            <Skeleton className="mx-auto h-6 w-40" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-16 w-full" />
          <div className="flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function InviteLeaguePage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const hasAttemptedJoin = useRef(false);
  const [showJoinChoice, setShowJoinChoice] = useState(false);

  const inviteCode = params.inviteCode as string;
  const inviteInfo = useQuery(api.leagues.getInviteInfo, { inviteCode });
  const joinLeague = useMutation(api.leagues.joinWithInviteCode);

  const handleJoinLeague = async (asSpectator: boolean = false) => {
    if (!isAuthenticated) {
      signIn("discord", { redirectTo: pathname });
      return;
    }
    if (!inviteCode) return;

    const toastId = toast.loading(asSpectator ? "Joining as spectator..." : "Joining league...");
    try {
      const result = await joinLeague({ inviteCode, asSpectator });
      if (result === "not_found") {
        toast.error("Invite link is invalid or has expired.", { id: toastId });
        router.push("/explore");
      } else if (result === "already_joined") {
        toast.info("You are already a member of this league.", { id: toastId });
        if (inviteInfo) {
          router.push(`/leagues/${inviteInfo._id}`);
        } else {
          router.push("/explore");
        }
      } else {
        toast.success(`Successfully joined ${inviteInfo?.name}${asSpectator ? " as a spectator" : ""}!`, { id: toastId });
        router.push(`/leagues/${result}`);
      }
    } catch {
      toast.error("Failed to join the league. Please try again.", {
        id: toastId,
      });
    }
  };

  useEffect(() => {
    if (isAuthenticated && inviteInfo && !hasAttemptedJoin.current) {
      hasAttemptedJoin.current = true;
      // Instead of auto-joining, show the choice
      setShowJoinChoice(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, inviteInfo]);

  if (isAuthLoading || inviteInfo === undefined) {
    return <InviteCardSkeleton />;
  }

  if (inviteInfo === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-bold">Invite Not Found</h1>
        <p className="text-muted-foreground">
          This invite link is invalid or the league has been deleted.
        </p>
        <Button onClick={() => router.push("/explore")}>Go to Explore</Button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">You&apos;ve been invited to join</CardTitle>
            <CardDescription className="text-xl font-bold text-foreground">
              {inviteInfo.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="break-words text-center text-muted-foreground">
              {inviteInfo.description}
            </p>
            <div className="flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                {inviteInfo.members && <AvatarStack users={inviteInfo.members} />}
                <span>{inviteInfo.memberCount} members</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Created by</span>
                <Avatar className="size-5">
                  <AvatarImage
                    src={inviteInfo.creatorImage ?? undefined}
                    alt={inviteInfo.creatorName}
                  />
                  <AvatarFallback
                    dangerouslySetInnerHTML={{ __html: toSvg(inviteInfo.creatorName, 20) }}
                  />
                </Avatar>
                <span>{inviteInfo.creatorName}</span>
              </div>
            </div>
            <div className="space-y-3">
              <Button size="lg" className="w-full" onClick={() => handleJoinLeague(false)}>
                Accept Invite
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

  // Show choice screen if user is authenticated and has the info
  if (isAuthenticated && showJoinChoice && inviteInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Join {inviteInfo.name}</CardTitle>
            <CardDescription className="text-foreground">
              Choose how you&apos;d like to participate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="break-words text-center text-muted-foreground">
              {inviteInfo.description}
            </p>
            <div className="flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                {inviteInfo.members && <AvatarStack users={inviteInfo.members} />}
                <span>{inviteInfo.memberCount} members</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Created by</span>
                <Avatar className="size-5">
                  <AvatarImage
                    src={inviteInfo.creatorImage ?? undefined}
                    alt={inviteInfo.creatorName}
                  />
                  <AvatarFallback
                    dangerouslySetInnerHTML={{ __html: toSvg(inviteInfo.creatorName, 20) }}
                  />
                </Avatar>
                <span>{inviteInfo.creatorName}</span>
              </div>
            </div>
            <div className="space-y-3">
              <Button size="lg" className="w-full" onClick={() => handleJoinLeague(false)}>
                Join as Full Member
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

  return <InviteCardSkeleton />;
}