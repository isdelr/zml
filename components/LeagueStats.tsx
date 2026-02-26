"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Bookmark,
  Crown,
  Gauge,
  Medal,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
  Target,
  Scale,
  Download,
  Sparkles,
} from "lucide-react";
import { Button } from "./ui/button";
import { Podium, RoundRow, SongRow, UserRow } from "@/components/league/stats/AwardCards";
import { TopSongsList } from "@/components/league/stats/TopSongsList";
import { AllRoundsGrid } from "@/components/league/stats/AllRoundsGrid";
import { GenreBreakdownChart } from "@/components/league/stats/GenreBreakdownChart";
import { useLeagueStatsExport } from "@/hooks/useLeagueStatsExport";
export function LeagueStats({ leagueId }: { leagueId: Id<"leagues"> }) {
  const stats = useQuery(api.leagues.getLeagueStats, { leagueId });
  const standings = useQuery(api.leagues.getLeagueStandings, { leagueId });
  const { exportRef, isExporting, onExport } = useLeagueStatsExport({
    enabled: !!stats,
  });

  if (stats === undefined) {
    return null;
  }

  if (stats === null) {
    return (
      <div className="py-20 text-center">
        <h3 className="text-xl font-semibold">Stats are brewing…</h3>
        <p className="mt-2 text-muted-foreground">Finish a round to unlock the award ceremony.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with export button */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Sparkles className="size-8 text-primary" />
            League Awards
          </h2>
          <p className="text-muted-foreground">Celebrating the best performances and memorable moments</p>
        </div>
        <Button 
          variant="outline" 
          size="lg" 
          onClick={onExport} 
          disabled={isExporting}
          className="gap-2"
        >
          <Download className="size-4" />
          {isExporting ? "Exporting..." : "Export PNG"}
        </Button>
      </div>

      <div ref={exportRef} className="space-y-8 bg-background p-4 rounded-lg">
        {/* Hero Section - Podium and Top Song */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Podium standings={standings} />
          
          <SongRow
            icon={<Trophy className="text-info" />}
            title="Top Voted Song"
            desc="Highest scoring submission in the league"
            song={stats.topSong ? { ...stats.topSong, count: stats.topSong.score } : null}
            highlight={true}
          />
        </div>

        {/* Spotlight Awards - Key User Achievements */}
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Crown className="size-5 text-warning" />
            Hall of Fame
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <UserRow
              icon={<Crown className="text-warning" />}
              title="Overlord"
              desc="Most round wins"
              user={stats.overlord}
              valueLabel={(u) => `${u.count} wins`}
              highlight={true}
            />
            <UserRow
              icon={<ThumbsUp className="text-success" />}
              title="People's Champion"
              desc="Most upvotes received"
              user={stats.peopleChampion}
              valueLabel={(u) => `${u.count} upvotes`}
              highlight={true}
            />
            <UserRow
              icon={<Medal className="text-info" />}
              title="Prolific Voter"
              desc="Most votes cast"
              user={stats.prolificVoter}
              valueLabel={(u) => `${u.count} votes`}
            />
            <UserRow
              icon={<ThumbsDown className="text-destructive" />}
              title="Lightning Rod"
              desc="Most downvotes received"
              user={stats.mostControversial}
              valueLabel={(u) => `${u.count} downvotes`}
            />
          </div>
        </div>

        {/* Song Awards */}
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Star className="size-5 text-warning" />
            Song Awards
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <SongRow
              icon={<ThumbsUp className="text-success" />}
              title="Most Upvoted Song"
              desc="Highest total upvotes"
              song={stats.mostUpvotedSong}
              valueSuffix=""
            />
            <SongRow
              icon={<Bookmark className="text-primary" />}
              title="Fan Favorite"
              desc="Most bookmarked"
              song={stats.fanFavoriteSong}
              valueSuffix=""
            />
            <SongRow
              icon={<ThumbsDown className="text-destructive" />}
              title="Most Downvoted Song"
              desc="Highest total downvotes"
              song={stats.mostDownvotedSong}
              valueSuffix=""
            />
          </div>
        </div>

        <TopSongsList songs={stats.top10Songs} />

        {/* Performance Awards */}
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Target className="size-5 text-highlight" />
            Performance Awards
          </h3>
          <div className="grid gap-6 md:grid-cols-2">
            <UserRow
              icon={<Star className="text-warning" />}
              title="Golden Ears"
              desc="Highest average points per submission"
              user={stats.goldenEars}
              valueLabel={(u) => `${u.count} avg (${u.meta?.rounds ?? 0} rounds)`}
            />
            <UserRow
              icon={<Target className="text-highlight" />}
              title="Consistency King"
              desc="Lowest score variability (σ)"
              user={stats.consistencyKing}
              valueLabel={(u) => `σ ${u.count} (avg ${u.meta?.average ?? "?"})`}
            />
          </div>
        </div>

        {/* Round Awards */}
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Zap className="size-5 text-warning" />
            Notable Rounds
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <RoundRow
              icon={<Zap className="text-warning" />}
              title="Blowout Round"
              desc="Largest gap between 1st and 2nd"
              round={stats.blowoutRound}
              metricSuffix=" pts"
            />
            <RoundRow
              icon={<Scale className="text-success" />}
              title="Closest Round"
              desc="Smallest gap between 1st and 2nd"
              round={stats.closestRound}
              metricSuffix=" pts"
            />
            <RoundRow
              icon={<Gauge className="text-primary" />}
              title="Most Competitive"
              desc="Most top-heavy upvotes (top-2 share)"
              round={stats.worstRound}
              metricFormatter={(x) => `${Math.round(x * 100)}%`}
            />
          </div>
        </div>

        <AllRoundsGrid rounds={stats.allRounds} leagueId={leagueId} />
        <GenreBreakdownChart data={stats.genreBreakdown} />
      </div>
    </div>
  );
}
