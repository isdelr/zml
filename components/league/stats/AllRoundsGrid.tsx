import Link from "next/link";
import NextImage from "next/image";
import { ListMusic } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RoundSummary = {
  roundId: string;
  title: string;
  imageUrl: string | null;
  status: string;
  submissionCount: number;
  totalVotes: number;
};

function getStatusDotClass(status: string) {
  if (status === "finished") return "bg-success";
  if (status === "voting") return "bg-warning";
  if (status === "submissions") return "bg-info";
  return "bg-muted-foreground";
}

export function AllRoundsGrid({
  rounds,
  leagueId,
}: {
  rounds: RoundSummary[] | undefined;
  leagueId: string;
}) {
  if (!rounds || rounds.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-xl font-bold">
        <ListMusic className="size-5 text-primary" />
        All Rounds & Playlists
      </h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rounds.map((round) => (
          <Link key={round.roundId} href={`/leagues/${leagueId}/round/${round.roundId}`}>
            <Card className="group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  {round.imageUrl ? (
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-lg">
                      <NextImage src={round.imageUrl} alt={round.title} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <ListMusic className="size-10 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h4 className="mb-1 truncate font-semibold">{round.title}</h4>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className={cn("inline-block size-2 rounded-full", getStatusDotClass(round.status))} />
                        <span className="capitalize">{round.status}</span>
                      </div>
                      <div>{round.submissionCount} submissions</div>
                      <div>{round.totalVotes} votes cast</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
