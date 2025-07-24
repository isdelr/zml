"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { toSvg } from "jdenticon";
import Image from "next/image";
import { useMemo } from "react";

interface RoundVoteSummaryProps {
  roundId: Id<"rounds">;
}

const VoteSummaryBySongSkeleton = () => (
    <Card className="my-8">
        <CardHeader>
            <Skeleton className="h-7 w-48" />
        </CardHeader>
        <CardContent className="space-y-8">
            {[...Array(2)].map((_, i) => (
                <div key={i} className="space-y-4">
                    <div className="flex items-start gap-4">
                        <Skeleton className="size-20 flex-shrink-0 rounded-md" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-5 w-1/2" />
                            <Skeleton className="h-5 w-1/3 mt-2" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pl-4">
                        {[...Array(3)].map((_, j) => (
                           <div key={j} className="flex items-center gap-2">
                                <Skeleton className="size-8 rounded-full" />
                                <div className="space-y-1 flex-1">
                                    <Skeleton className="h-4 w-full" />
                                </div>
                                <Skeleton className="h-5 w-8" />
                           </div>
                        ))}
                    </div>
                </div>
            ))}
        </CardContent>
    </Card>
);


export function RoundVoteSummary({ roundId }: RoundVoteSummaryProps) {
  const voteSummaryBySong = useQuery(api.rounds.getVoteSummary, { roundId });

  const processedSummary = useMemo(() => {
    if (!voteSummaryBySong) return undefined;

    return voteSummaryBySong.map(song => {
      const votesByUser = new Map<string, { voterName: string; voterImage: string | null; voterId: Id<"users">; score: number }>();
      
      for (const vote of song.votes) {
        const existing = votesByUser.get(vote.voterId);
        if (existing) {
          existing.score += vote.vote;
        } else {
          votesByUser.set(vote.voterId, {
            voterId: vote.voterId,
            voterName: vote.voterName,
            voterImage: vote.voterImage,
            score: vote.vote,
          });
        }
      }
      
      const aggregatedVotes = Array.from(votesByUser.values());
      aggregatedVotes.sort((a, b) => b.score - a.score);

      return {
        ...song,
        aggregatedVotes,
      };
    });

  }, [voteSummaryBySong]);

  if (processedSummary === undefined) {
    return <VoteSummaryBySongSkeleton />;
  }

  if (processedSummary.length === 0) {
    return null;
  }

  return (
    <Card className="my-8">
      <CardHeader>
        <CardTitle className="text-2xl">Vote Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {processedSummary.map((songSummary) => (
          <div key={songSummary.submissionId}>
             <div className="flex items-start gap-4 mb-4">
                {songSummary.albumArtUrl ? (
                    <Image
                        src={songSummary.albumArtUrl}
                        alt={songSummary.songTitle}
                        width={80}
                        height={80}
                        className="rounded-md object-cover flex-shrink-0"
                    />
                ) : (
                    <div
                        className="size-20 flex-shrink-0 rounded-md bg-muted"
                        dangerouslySetInnerHTML={{ __html: toSvg(songSummary.submissionId, 80) }}
                    />
                )}
              <div className="flex-1">
                <p className="text-lg font-bold">{songSummary.songTitle}</p>
                <p className="text-muted-foreground">{songSummary.artist}</p>
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <span>Submitted by</span>
                  <Avatar className="size-6">
                    <AvatarImage src={songSummary.submittedByImage ?? undefined} />
                    <AvatarFallback>
                      <div dangerouslySetInnerHTML={{ __html: toSvg(songSummary.submittedById, 24) }} />
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-foreground">{songSummary.submittedByName}</span>
                </div>
              </div>
            </div>

            {songSummary.aggregatedVotes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3 pl-4 border-l-2 ml-10">
                {songSummary.aggregatedVotes.map(voter => (
                  <div key={voter.voterId} className="flex items-center gap-2">
                    <Avatar className="size-8">
                      <AvatarImage src={voter.voterImage ?? undefined} />
                      <AvatarFallback>
                         <div dangerouslySetInnerHTML={{ __html: toSvg(voter.voterId, 32) }} />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 truncate">
                        <p className="font-semibold truncate">{voter.voterName}</p>
                    </div>
                    <div className={`flex items-center gap-1 font-bold ${voter.score > 0 ? 'text-green-500' : voter.score < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {voter.score > 0 ? <ThumbsUp className="size-4" /> : voter.score < 0 ? <ThumbsDown className="size-4" /> : <Minus className="size-4" />}
                        <span>{voter.score > 0 ? `+${voter.score}` : voter.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="pl-4 ml-10 border-l-2 text-sm italic text-muted-foreground">No votes were cast for this song.</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}