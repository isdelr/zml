"use client";

import { Ban, Headphones } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface RoundStatusAlertsProps {
  isSpectator: boolean;
  roundStatus: "submissions" | "voting" | "finished";
  userVoteStatus:
    | {
        hasVoted: boolean;
        canVote: boolean;
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
      !isSpectator ? (
        <Alert className="mb-8 border-warning/50 bg-warning/10 text-warning">
          <Ban className="size-4" />
          <AlertTitle className="font-bold">Voting Restricted</AlertTitle>
          <AlertDescription className="text-warning/80">
            You must submit a song to a round to be eligible to vote.
          </AlertDescription>
        </Alert>
      ) : null}

      {roundStatus === "voting" &&
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
                left to listen to, before you can vote. Unlistened file
                submissions are marked with a
              </span>
              <Headphones className="inline-block size-4" />
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
