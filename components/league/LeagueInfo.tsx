"use client";

import { AvatarStack } from "@/components/AvatarStack";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toSvg } from "jdenticon";
import { Eye } from "lucide-react";

interface LeagueInfoProps {
  leagueData: unknown;
}

export function LeagueInfo({ leagueData }: LeagueInfoProps) {
  if (!leagueData) return null;
  
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
              <div
                dangerouslySetInnerHTML={{
                  __html: toSvg(leagueData.creatorId as string, 24),
                }}
              />
            </AvatarFallback>
          </Avatar>
          <strong className="text-foreground">
            {leagueData.creatorName}
          </strong>
        </div>
      </div>
    </div>
  );
}