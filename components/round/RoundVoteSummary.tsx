"use client";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { toSvg } from "jdenticon";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface RoundVoteSummaryProps {
  roundId: Id<"rounds">;
}

export function RoundVoteSummary({ roundId }: RoundVoteSummaryProps) {
  const voteSummaryBySong = useQuery(api.rounds.getVoteSummary, { roundId });
  const sortedSummaries = useMemo(() => {
    if (!voteSummaryBySong) return [] as typeof voteSummaryBySong extends undefined ? never[] : NonNullable<typeof voteSummaryBySong>;
    return [...voteSummaryBySong].sort((a, b) => {
      const totalA = a.votes.reduce((sum, v) => sum + (typeof v.score === "number" ? v.score : 0), 0);
      const totalB = b.votes.reduce((sum, v) => sum + (typeof v.score === "number" ? v.score : 0), 0);
      if (totalB !== totalA) return totalB - totalA; // Descending by total score
      const titleCmp = a.songTitle.localeCompare(b.songTitle);
      if (titleCmp !== 0) return titleCmp;
      return String(a.submissionId).localeCompare(String(b.submissionId));
    });
  }, [voteSummaryBySong]);

  if (voteSummaryBySong === undefined) {
    return null;
  }

  return (
    <Card className="my-8">
      <CardHeader>
        <CardTitle className="text-2xl">Vote Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {sortedSummaries.map((songSummary) => (
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
                  className="generated-art size-20 flex-shrink-0 rounded-md bg-muted"
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

            {songSummary.votes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3 pl-4 border-l-2 ml-10">
                {songSummary.votes.map((voter) => (
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
                    <div
                      className={cn(
                        "flex items-center gap-1 font-bold",
                        voter.score > 0
                          ? "text-success"
                          : voter.score < 0
                            ? "text-destructive"
                            : "text-muted-foreground",
                      )}
                    >
                      {voter.score > 0 ? (
                        <ThumbsUp className="size-4" />
                      ) : voter.score < 0 ? (
                        <ThumbsDown className="size-4" />
                      ) : (
                        <Minus className="size-4" />
                      )}
                      <span>{voter.score > 0 ? `+${voter.score}` : voter.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="pl-4 ml-10 border-l-2 text-sm italic text-muted-foreground">
                No votes were cast for this song.
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
