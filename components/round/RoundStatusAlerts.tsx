"use client";

import { Ban, Headphones } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  getVotingRestrictionCopy,
  type VotingEligibilityReason,
} from "@/lib/rounds/voting-participation";

interface RoundStatusAlertsProps {
  isSpectator: boolean;
  roundStatus: "scheduled" | "submissions" | "voting" | "finished";
  userVoteStatus:
    | {
        hasVoted: boolean;
        canVote: boolean;
        eligibilityReason?: VotingEligibilityReason;
      }
    | undefined;
  enforceListenPercentage: boolean;
  songsLeftToListenCount: number;
}

export function RoundStatusAlerts({
  isSpectator,
  roundStatus,
  userVoteStatus,
  enforceListenPercentage,
  songsLeftToListenCount,
}: RoundStatusAlertsProps) {
  const restrictionCopy = getVotingRestrictionCopy(
    userVoteStatus?.eligibilityReason,
  );

  return (
    <>
      {isSpectator ? (
        <Alert className="mb-8 border-info/50 bg-info/10 text-info">
          <Ban className="size-4" />
          <AlertTitle className="font-bold">Spectator Mode</AlertTitle>
          <AlertDescription className="text-info/80">
            You are viewing this league as a spectator. You can listen to all
            submissions but cannot submit songs or vote.
          </AlertDescription>
        </Alert>
      ) : null}

      {roundStatus === "voting" &&
      userVoteStatus &&
      !userVoteStatus.hasVoted &&
      !userVoteStatus.canVote &&
      !isSpectator &&
      restrictionCopy ? (
        <Alert className="mb-8 border-warning/50 bg-warning/10 text-warning">
          <Ban className="size-4" />
          <AlertTitle className="font-bold">{restrictionCopy.title}</AlertTitle>
          <AlertDescription className="text-warning/80">
            {restrictionCopy.description}
          </AlertDescription>
        </Alert>
      ) : null}

      {roundStatus === "voting" &&
      userVoteStatus?.canVote &&
      enforceListenPercentage &&
      songsLeftToListenCount > 0 ? (
        <Alert className="mb-8 border-info/50 bg-info/10 text-info">
          <AlertTitle className="mb-2 text-xl font-bold">
            Listening Requirement
          </AlertTitle>
          <AlertDescription className="text-info/80">
            <div className="flex items-center gap-2">
              <span>
                You have: <span className="font-bold">{songsLeftToListenCount} </span>
                <span className="font-bold">
                  {songsLeftToListenCount > 1 ? "songs" : "song"}
                </span>{" "}
                left to listen to before you can submit your final vote. You
                can keep saving votes on completed songs in the meantime.
                Unlistened file submissions are marked with a
              </span>
              <Headphones className="inline-block size-4" />
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {roundStatus === "scheduled" ? (
        <Alert className="mb-8 border-muted bg-muted/40 text-foreground">
          <AlertTitle className="font-bold">Round Not Open Yet</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            This round is scheduled, but you can already lock in your
            submission now and keep editing it until voting begins.
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
