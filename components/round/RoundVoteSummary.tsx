"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toSvg } from "jdenticon";

interface RoundVoteSummaryProps {
  roundId: Id<"rounds">;
}

const VoteSummarySkeleton = () => (
    <Card className="my-8">
        <CardHeader>
            <Skeleton className="h-7 w-48" />
        </CardHeader>
        <CardContent className="space-y-6">
            {[...Array(2)].map((_, i) => (
                <div key={i} className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Skeleton className="size-10 rounded-full" />
                        <Skeleton className="h-6 w-32" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-12">
                        <div>
                            <Skeleton className="h-5 w-20 mb-2" />
                            <div className="space-y-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </div>
                        <div>
                            <Skeleton className="h-5 w-24 mb-2" />
                            <div className="space-y-2">
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </CardContent>
    </Card>
);

export function RoundVoteSummary({ roundId }: RoundVoteSummaryProps) {
  const voteSummary = useQuery(api.rounds.getVoteSummary, { roundId });

  if (voteSummary === undefined) {
    return <VoteSummarySkeleton />;
  }

  if (voteSummary.length === 0) {
    return null; // Don't show the card if there's no voting data.
  }

  return (
    <Card className="my-8">
      <CardHeader>
        <CardTitle className="text-2xl">Vote Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {voteSummary.map((voterSummary) => (
          <div key={voterSummary.voterId}>
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="size-10">
                <AvatarImage src={voterSummary.voterImage ?? undefined} alt={voterSummary.voterName} />
                <AvatarFallback>
                    <div dangerouslySetInnerHTML={{ __html: toSvg(voterSummary.voterId, 40) }} />
                </AvatarFallback>
              </Avatar>
              <h3 className="text-lg font-semibold">{voterSummary.voterName}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-4 md:pl-12">
              {/* Upvotes Column */}
              <div>
                <h4 className="flex items-center gap-2 text-md font-medium text-green-500 mb-2">
                  <ThumbsUp className="size-5" />
                  Upvotes
                </h4>
                <div className="space-y-2">
                  {voterSummary.upvotes.length > 0 ? (
                    voterSummary.upvotes.map((vote) => (
                      <div key={vote.submissionId} className="bg-muted/50 p-2 rounded-md text-sm">
                        <p className="font-semibold">{vote.songTitle}</p>
                        <p className="text-xs text-muted-foreground">by {vote.artist}</p>
                        <p className="text-xs text-muted-foreground">Submitted by: {vote.submittedByName}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No upvotes cast.</p>
                  )}
                </div>
              </div>

              {/* Downvotes Column */}
              <div>
                <h4 className="flex items-center gap-2 text-md font-medium text-red-500 mb-2">
                  <ThumbsDown className="size-5" />
                  Downvotes
                </h4>
                <div className="space-y-2">
                  {voterSummary.downvotes.length > 0 ? (
                    voterSummary.downvotes.map((vote) => (
                      <div key={vote.submissionId} className="bg-muted/50 p-2 rounded-md text-sm">
                        <p className="font-semibold">{vote.songTitle}</p>
                        <p className="text-xs text-muted-foreground">by {vote.artist}</p>
                        <p className="text-xs text-muted-foreground">Submitted by: {vote.submittedByName}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No downvotes cast.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}