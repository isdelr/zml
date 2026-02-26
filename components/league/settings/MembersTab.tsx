"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";

import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/lib/convex/api";
import type { LeagueData } from "@/lib/convex/types";
import { toErrorMessage } from "@/lib/errors";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toSvg } from "jdenticon";

type CurrentUser = FunctionReturnType<typeof api.users.getCurrentUser> | undefined;

interface MembersTabProps {
  league: LeagueData;
  currentUser: CurrentUser;
}

function MemberRow({
  name,
  image,
  id,
  badge,
  canKick,
  onKick,
  dashed,
}: {
  name?: string | null;
  image?: string | null;
  id: Id<"users">;
  badge?: { label: string; variant: "secondary" | "outline" };
  canKick: boolean;
  onKick: (memberId: Id<"users">) => void;
  dashed?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted/50 ${
        dashed ? "border-dashed" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar className="size-10">
          <AvatarImage src={image ?? undefined} />
          <AvatarFallback>
            <div
              dangerouslySetInnerHTML={{
                __html: toSvg(id, 40),
              }}
            />
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="font-medium">{name ?? "Unknown user"}</span>
          {badge ? (
            <Badge variant={badge.variant} className="w-fit text-xs">
              {badge.label}
            </Badge>
          ) : null}
        </div>
      </div>
      {canKick ? (
        <Button variant="destructive" size="sm" onClick={() => onKick(id)}>
          Kick
        </Button>
      ) : null}
    </div>
  );
}

export function MembersTab({ league, currentUser }: MembersTabProps) {
  const kickMember = useMutation(api.leagues.kickMember);

  const handleKick = (memberIdToKick: Id<"users">) => {
    toast.promise(kickMember({ leagueId: league._id, memberIdToKick }), {
      loading: "Kicking member...",
      success: "Member kicked.",
      error: (error) => toErrorMessage(error, "Failed to kick member."),
    });
  };

  const regularMembers = league.members ?? [];
  const spectators = league.spectators ?? [];
  const isOwner = currentUser?._id === league.creatorId;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Members ({regularMembers.length})
          </h3>
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto pr-2">
          {regularMembers.map((member) => (
            <MemberRow
              key={member._id}
              id={member._id}
              name={member.name}
              image={member.image}
              badge={
                member._id === league.creatorId
                  ? { label: "Owner", variant: "secondary" }
                  : undefined
              }
              canKick={isOwner && member._id !== league.creatorId}
              onKick={handleKick}
            />
          ))}
        </div>
      </div>

      {spectators.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Spectators ({spectators.length})
            </h3>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-2">
            {spectators.map((spectator) => (
              <MemberRow
                key={spectator._id}
                id={spectator._id}
                name={spectator.name}
                image={spectator.image}
                badge={{ label: "Spectator", variant: "outline" }}
                canKick={isOwner}
                onKick={handleKick}
                dashed
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
