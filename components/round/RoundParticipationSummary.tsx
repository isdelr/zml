"use client";

import { AvatarRoster } from "@/components/AvatarRoster";

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
    <div className="grid gap-3 lg:grid-cols-2">
      {groups.map((group) => (
        <div
          key={group.label}
          className="rounded-xl border bg-card/70 p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {group.label}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {group.users.length}
            </span>
          </div>
          {group.users.length > 0 ? (
            <AvatarRoster users={group.users} />
          ) : (
            <span className="text-sm text-muted-foreground">None</span>
          )}
        </div>
      ))}
    </div>
  );
}
