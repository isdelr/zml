"use client";

import { AvatarRoster } from "@/components/AvatarRoster";
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
    <div className="mb-8">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-4xl font-bold sm:text-5xl lg:text-6xl">
          {leagueData.name}
        </h1>
        {leagueData.isSpectator && (
          <Badge variant="secondary" className="h-fit">
            <Eye className="mr-1 size-3" />
            Spectator
          </Badge>
        )}
      </div>
      {leagueData.description && (
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          {leagueData.description}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-muted-foreground">
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
          <strong className="text-foreground">{leagueData.creatorName}</strong>
        </div>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <section className="rounded-2xl border bg-card/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Members
            </h2>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {leagueData.activeMemberCount}
            </span>
          </div>
          <AvatarRoster
            users={leagueData.members ?? []}
            variant="ghost"
            avatarClassName="size-8 sm:size-9"
          />
        </section>
        {leagueData.spectatorCount > 0 ? (
          <section className="rounded-2xl border bg-card/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Spectators
              </h2>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {leagueData.spectatorCount}
              </span>
            </div>
            <AvatarRoster
              users={leagueData.spectators ?? []}
              variant="ghost"
              avatarClassName="size-8 sm:size-9"
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
