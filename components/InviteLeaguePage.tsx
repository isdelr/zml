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
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { toast } from "sonner";
import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useRef } from "react";
import { AvatarStack } from "@/components/AvatarStack";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toSvg } from "jdenticon";

export default function InviteLeaguePage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const hasAttemptedJoin = useRef(false);

  const inviteCode = params.inviteCode as string;
  const inviteInfo = useQuery(api.leagues.getInviteInfo, { inviteCode });
  const joinLeague = useMutation(api.leagues.joinWithInviteCode);

  const handleJoinLeague = async () => {
    if (!isAuthenticated) {
      signIn("discord", { callbackUrl: pathname });
      return;
    }
    if (!inviteCode) return;

    const toastId = toast.loading("Joining league...");
    try {
      const result = await joinLeague({ inviteCode });
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
        toast.success(`Successfully joined ${inviteInfo?.name}!`, { id: toastId });
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
      void handleJoinLeague();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, inviteInfo]);

  if (isAuthLoading || inviteInfo === undefined) {
    return <LoadingSpinner />;
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
            <Button size="lg" className="w-full" onClick={handleJoinLeague}>
              Accept Invite
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <LoadingSpinner />;
}