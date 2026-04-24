"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { MoreHorizontal, UserRoundX, VolumeX } from "lucide-react";

import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/lib/convex/api";
import type { LeagueData } from "@/lib/convex/types";
import { toErrorMessage } from "@/lib/errors";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toSvg } from "jdenticon";

interface MembersTabProps {
  league: LeagueData;
}

function MemberRow({
  name,
  image,
  id,
  badges,
  canManage,
  canKick,
  canToggleListenRequirement,
  isListenRequirementVoided,
  onKick,
  onToggleListenRequirement,
  dashed,
}: {
  name?: string | null;
  image?: string | null;
  id: Id<"users">;
  badges?: Array<{ label: string; variant: "secondary" | "outline" }>;
  canManage: boolean;
  canKick: boolean;
  canToggleListenRequirement: boolean;
  isListenRequirementVoided: boolean;
  onKick: (memberId: Id<"users">) => void;
  onToggleListenRequirement: (memberId: Id<"users">, isVoided: boolean) => void;
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
          {badges && badges.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {badges.map((badge) => (
                <Badge
                  key={badge.label}
                  variant={badge.variant}
                  className="w-fit text-xs"
                >
                  {badge.label}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {canManage ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${name ?? "Unknown user"}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {canToggleListenRequirement ? (
              <DropdownMenuItem
                onSelect={() =>
                  onToggleListenRequirement(id, !isListenRequirementVoided)
                }
              >
                <VolumeX className="size-4" />
                {isListenRequirementVoided
                  ? "Restore listening requirement"
                  : "Void listening requirement"}
              </DropdownMenuItem>
            ) : null}
            {canToggleListenRequirement && canKick ? (
              <DropdownMenuSeparator />
            ) : null}
            {canKick ? (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onKick(id)}
              >
                <UserRoundX className="size-4" />
                Kick
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

export function MembersTab({ league }: MembersTabProps) {
  const kickMember = useMutation(api.leagues.kickMember);
  const setMemberListenRequirementVoided = useMutation(
    api.leagues.setMemberListenRequirementVoided,
  );
  const [memberIdPendingKick, setMemberIdPendingKick] = useState<Id<"users"> | null>(
    null,
  );

  const handleKick = (memberIdToKick: Id<"users">) => {
    setMemberIdPendingKick(memberIdToKick);
  };

  const handleListenRequirementToggle = (
    memberId: Id<"users">,
    isVoided: boolean,
  ) => {
    toast.promise(
      setMemberListenRequirementVoided({
        leagueId: league._id,
        memberId,
        isVoided,
      }),
      {
        loading: isVoided
          ? "Voiding listening requirement..."
          : "Restoring listening requirement...",
        success: ({ message }) => message,
        error: (error) =>
          toErrorMessage(error, "Failed to update listening requirement."),
      },
    );
  };

  const confirmKick = () => {
    if (!memberIdPendingKick) return;
    toast.promise(
      kickMember({ leagueId: league._id, memberIdToKick: memberIdPendingKick }),
      {
        loading: "Kicking member...",
        success: "Member kicked.",
        error: (error) => toErrorMessage(error, "Failed to kick member."),
      },
    );
    setMemberIdPendingKick(null);
  };

  const regularMembers = useMemo(() => league.members ?? [], [league.members]);
  const spectators = useMemo(
    () => league.spectators ?? [],
    [league.spectators],
  );
  const canManageMembers = league.canManageLeague;
  const memberPendingKick = useMemo(
    () =>
      [...regularMembers, ...spectators].find(
        (member) => member._id === memberIdPendingKick,
      ) ?? null,
    [memberIdPendingKick, regularMembers, spectators],
  );

  return (
    <>
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
                badges={[
                  ...(member._id === league.creatorId
                    ? [{ label: "Owner", variant: "secondary" as const }]
                    : []),
                  ...(member.listenRequirementVoided
                    ? [{ label: "Listen exempt", variant: "outline" as const }]
                    : []),
                ]}
                canManage={canManageMembers}
                canKick={canManageMembers && member._id !== league.creatorId}
                canToggleListenRequirement={canManageMembers}
                isListenRequirementVoided={
                  member.listenRequirementVoided === true
                }
                onKick={handleKick}
                onToggleListenRequirement={handleListenRequirementToggle}
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
                  badges={[{ label: "Spectator", variant: "outline" }]}
                  canManage={canManageMembers}
                  canKick={canManageMembers}
                  canToggleListenRequirement={false}
                  isListenRequirementVoided={false}
                  onKick={handleKick}
                  onToggleListenRequirement={handleListenRequirementToggle}
                  dashed
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <AlertDialog
        open={memberIdPendingKick !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMemberIdPendingKick(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kick member?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberPendingKick?.name
                ? `Remove ${memberPendingKick.name} from this league?`
                : "Remove this member from this league?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmKick}
            >
              Kick
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
