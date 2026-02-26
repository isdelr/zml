"use client";

import { useMemo } from "react";
import { useMutation } from "convex/react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/convex/api";
import type { LeagueData } from "@/lib/convex/types";
import { toErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface InviteTabProps {
  league: LeagueData;
}

export function InviteTab({ league }: InviteTabProps) {
  const manageInviteCode = useMutation(api.leagues.manageInviteCode);

  const handleAction = (
    action: "regenerate" | "disable" | "enable",
    messages: { loading: string; success: string; error: string },
  ) => {
    toast.promise(manageInviteCode({ leagueId: league._id, action }), {
      loading: messages.loading,
      success: messages.success,
      error: (error) => toErrorMessage(error, messages.error),
    });
  };

  const inviteUrl = useMemo(() => {
    if (!league.inviteCode || typeof window === "undefined") return "";
    return `${window.location.origin}/invite/${league.inviteCode}`;
  }, [league.inviteCode]);

  return (
    <div className="space-y-4">
      {league.inviteCode ? (
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              Share this link
            </h3>
            <div className="flex items-center space-x-2">
              <Input
                id="invite-link"
                readOnly
                value={inviteUrl}
                className="font-mono text-sm"
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl);
                  toast.success("Invite link copied!");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Anyone with this link can join your league.
            </p>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              Manage Link
            </h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  handleAction("regenerate", {
                    loading: "Generating new link...",
                    success:
                      "New invite link generated. The old link will no longer work.",
                    error: "Failed to generate link.",
                  })
                }
              >
                Regenerate Link
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  handleAction("disable", {
                    loading: "Disabling link...",
                    success:
                      "Invite link disabled. No one can join using this link.",
                    error: "Failed to disable link.",
                  })
                }
              >
                Disable Link
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border bg-muted/50 p-6 text-center">
          <p className="text-muted-foreground">Invite link is currently disabled.</p>
          <p className="text-sm text-muted-foreground">
            Enable it to allow people to join your league via a shareable link.
          </p>
          <Button
            onClick={() =>
              handleAction("enable", {
                loading: "Enabling link...",
                success:
                  "Invite link enabled! Share it with others to let them join.",
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
