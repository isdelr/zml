"use client";

import { AvatarStack } from "@/components/AvatarStack";

type Participant = {
  _id?: string;
  name?: string | null;
  image?: string | null;
};

interface RoundParticipationSummaryProps {
  groups: {
    label: string;
    users: Participant[];
  }[];
}

export function RoundParticipationSummary({
  groups,
}: RoundParticipationSummaryProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
      {groups.map((group) => (
        <div key={group.label} className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {group.label}
            <span className="ml-1 text-[10px] tracking-[0.08em]">
              ({group.users.length})
            </span>
          </span>
          {group.users.length > 0 ? (
            <AvatarStack users={group.users} />
          ) : (
            <span className="text-sm text-muted-foreground">None</span>
          )}
        </div>
      ))}
    </div>
  );
}
