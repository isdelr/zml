"use client";

import { AvatarStack } from "@/components/AvatarStack";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toSvg } from "jdenticon";
import { Eye } from "lucide-react";
import type { LeagueData } from "@/lib/convex/types";

interface LeagueInfoProps {
  leagueData: LeagueData;
}

export function LeagueInfo({ leagueData }: LeagueInfoProps) {
  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-4xl font-bold md:text-6xl">{leagueData.name}</h1>
        {leagueData.isSpectator && (
          <Badge variant="secondary" className="h-fit">
            <Eye className="mr-1 size-3" />
            Spectator
          </Badge>
        )}
      </div>
      <div className="mt-4 flex flex-col items-start gap-3 text-muted-foreground md:flex-row md:items-center md:gap-6">
        <div className="flex items-center gap-2">
          {leagueData.members && <AvatarStack users={leagueData.members} />}
          <span>{leagueData.activeMemberCount} {leagueData.activeMemberCount === 1 ? "Member" : "Members"}</span>
        </div>
        {leagueData.spectatorCount > 0 && (
          <div className="flex items-center gap-2">
            {leagueData.spectators && <AvatarStack users={leagueData.spectators} />}
            <span>{leagueData.spectatorCount} {leagueData.spectatorCount === 1 ? "Spectator" : "Spectators"}</span>
          </div>
        )}
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
      {leagueData.description && (
        <p className="mt-6 max-w-xl text-base text-muted-foreground">
          {leagueData.description}
        </p>
      )}
    </div>
  );
}
