"use client";

import { AvatarStack } from "@/components/AvatarStack";

interface RoundVotingProgressCardProps {
  voters: { name?: string | null; image?: string | null }[];
}

export function RoundVotingProgressCard({ voters }: RoundVotingProgressCardProps) {
  if (voters.length === 0) {
    return null;
  }

  return (
    <div className="my-8 rounded-lg border bg-card p-6 text-center">
      <h3 className="font-semibold">Who&apos;s Voted So Far?</h3>
      <div className="mt-4 flex flex-col items-center justify-center gap-2">
        <AvatarStack users={voters} />
        <p className="text-sm text-muted-foreground">
          {voters.length} member{voters.length !== 1 ? "s" : ""} have cast
          their votes.
        </p>
      </div>
    </div>
  );
}
