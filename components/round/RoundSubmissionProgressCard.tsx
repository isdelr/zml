"use client";

import { AvatarStack } from "@/components/AvatarStack";

interface RoundSubmissionProgressCardProps {
  completedSubmitters: { name?: string | null; image?: string | null }[];
  missingSubmitters: { name?: string | null; image?: string | null }[];
  totalMembers: number;
}

export function RoundSubmissionProgressCard({
  completedSubmitters,
  missingSubmitters,
  totalMembers,
}: RoundSubmissionProgressCardProps) {
  return (
    <div className="mt-8 rounded-lg border bg-card p-6 text-center">
      <h3 className="font-semibold">Who&apos;s Submitted So Far?</h3>
      {completedSubmitters.length > 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-2">
          <AvatarStack users={completedSubmitters} />
          <p className="text-sm text-muted-foreground">
            {completedSubmitters.length}/{totalMembers} members completed
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No one has submitted yet. Be the first!
        </p>
      )}
      <div className="mt-4">
        <h4 className="text-sm font-semibold">Who&apos;s still missing?</h4>
        {missingSubmitters.length > 0 ? (
          <div className="mt-2 flex flex-col items-center justify-center gap-2">
            <AvatarStack users={missingSubmitters} />
            <p className="text-xs text-muted-foreground">
              {missingSubmitters.length} member
              {missingSubmitters.length !== 1 ? "s" : ""} remaining
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            All members have completed their submissions.
          </p>
        )}
      </div>
    </div>
  );
}
