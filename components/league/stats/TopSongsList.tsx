import NextImage from "next/image";
import { Star, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TopSong = {
  songTitle: string;
  artist: string;
  submittedBy: string;
  score: number;
  albumArtUrl: string | null;
};

const rankStyles = [
  "bg-warning text-foreground",
  "bg-muted text-muted-foreground",
  "bg-primary text-primary-foreground",
];

export function TopSongsList({ songs }: { songs: TopSong[] | undefined }) {
  if (!songs || songs.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-xl font-bold">
        <Trophy className="size-5 text-primary" />
        Top 10 Most Voted Songs
      </h3>
      <div className="grid gap-4">
        {songs.map((song, index) => (
          <Card
            key={`${song.songTitle}-${song.submittedBy}-${index}`}
            className={cn(
              "group transition-all duration-300 hover:scale-[1.01] hover:shadow-lg",
              index === 0 && "border-primary/50 bg-gradient-to-br from-primary/5 to-transparent",
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex size-12 items-center justify-center rounded-lg text-xl font-bold",
                    rankStyles[index] ?? "bg-muted text-muted-foreground",
                  )}
                >
                  {index + 1}
                </div>
                {song.albumArtUrl ? (
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg">
                    <NextImage src={song.albumArtUrl} alt={song.songTitle} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Star className="size-8 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-semibold">{song.songTitle}</h4>
                  <p className="truncate text-sm text-muted-foreground">{song.artist}</p>
                  <p className="text-xs text-muted-foreground">by {song.submittedBy}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{song.score}</div>
                  <div className="text-xs text-muted-foreground">points</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
