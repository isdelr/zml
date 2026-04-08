"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts/types/component/Tooltip";
import type { DotItemDotProps } from "recharts/types/util/types";
import { Focus, TrendingUp } from "lucide-react";
import { toSvg } from "jdenticon";

import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/lib/convex/api";
import {
  buildLeagueStatsChartRows,
  getLeagueStatsField,
  getLeagueStatsSeriesColor,
  type LeagueStatsChartRow,
  type LeagueStatsSeries,
  type LeagueStatsTrajectoryData,
} from "@/lib/leagues/stats";
import { cn, formatShortDateTime } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

interface LeagueStatsPanelProps {
  leagueId: Id<"leagues">;
}

type ChartSeries = LeagueStatsSeries & {
  color: string;
  dataKey: string;
  avatarSrc: string;
  latestPoints: number;
  latestRank: number;
  latestUpvotes: number;
  latestDownvotes: number;
};

function buildAvatarDataUri(userId: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(toSvg(userId, 64))}`;
}

function formatPoints(value: number) {
  return `${value} pts`;
}

function formatRoundTick(value: string) {
  if (value.length <= 20) {
    return value;
  }

  return `${value.slice(0, 18)}...`;
}

function getLatestMetrics(
  trajectory: LeagueStatsTrajectoryData,
  userId: string,
) {
  const latestPoint = trajectory.points[trajectory.points.length - 1];
  const latestMetrics = latestPoint?.metrics.find(
    (metric) => metric.userId === userId,
  );

  return {
    points: latestMetrics?.totalPoints ?? 0,
    rank: latestMetrics?.rank ?? 0,
    upvotes: latestMetrics?.upvotesReceived ?? 0,
    downvotes: latestMetrics?.downvotesReceived ?? 0,
  };
}

function LeagueStatsTooltip({
  active,
  payload,
  seriesById,
  highlightedUserId,
}: TooltipContentProps & {
  seriesById: Map<string, ChartSeries>;
  highlightedUserId: string | null;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload as LeagueStatsChartRow | undefined;
  if (!point) {
    return null;
  }

  const items = payload
    .map((entry) => {
      const dataKey = String(entry.dataKey ?? "");
      const series = seriesById.get(dataKey);
      if (!series || typeof entry.value !== "number") {
        return null;
      }

      return {
        ...series,
        points: entry.value,
        rank: Number(point[getLeagueStatsField(dataKey, "rank")] ?? 0),
        upvotes: Number(point[getLeagueStatsField(dataKey, "upvotes")] ?? 0),
        downvotes: Number(
          point[getLeagueStatsField(dataKey, "downvotes")] ?? 0,
        ),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => {
      if (highlightedUserId) {
        if (
          left.userId === highlightedUserId &&
          right.userId !== highlightedUserId
        ) {
          return -1;
        }
        if (
          right.userId === highlightedUserId &&
          left.userId !== highlightedUserId
        ) {
          return 1;
        }
      }

      return left.rank - right.rank;
    });

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="min-w-72 max-w-80 rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur">
      <div className="border-b border-border/50 pb-2">
        <p className="text-sm font-semibold text-foreground">{point.label}</p>
        <p className="text-xs text-muted-foreground">
          {formatShortDateTime(point.timestamp)}
        </p>
      </div>
      <div className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
        {items.map((item) => (
          <div
            key={item.userId}
            className={cn(
              "flex items-center gap-3 transition-opacity",
              highlightedUserId &&
                highlightedUserId !== item.userId &&
                "opacity-35",
            )}
          >
            <div
              className="h-9 w-1 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <Avatar className="size-9 border border-border/50">
              <AvatarImage src={item.image} alt={item.name} />
              <AvatarFallback
                dangerouslySetInnerHTML={{
                  __html: toSvg(item.userId, 36),
                }}
              />
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {item.name}
              </p>
              <p className="text-xs text-muted-foreground">
                #{item.rank} · {item.points} pts · +{item.upvotes} / -
                {item.downvotes}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeagueStatsLineHead({
  cx,
  cy,
  index,
  points,
  dataKey,
  avatarSrc,
  color,
  emphasis,
}: DotItemDotProps & {
  avatarSrc: string;
  color: string;
  emphasis: number;
}) {
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    index !== points.length - 1
  ) {
    return null;
  }

  const clipPathId = `league-stats-avatar-${String(dataKey ?? index).replace(
    /[^a-zA-Z0-9_-]/g,
    "",
  )}`;

  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      className="pointer-events-none"
      opacity={emphasis}
    >
      <defs>
        <clipPath id={clipPathId}>
          <circle cx="0" cy="0" r="9.5" />
        </clipPath>
      </defs>
      <circle r="12" fill="var(--background)" stroke={color} strokeWidth="3" />
      <image
        x="-9.5"
        y="-9.5"
        width="19"
        height="19"
        href={avatarSrc}
        clipPath={`url(#${clipPathId})`}
        preserveAspectRatio="xMidYMid slice"
      />
    </g>
  );
}

function LeagueStatsLoading() {
  return (
    <section className="overflow-hidden rounded-3xl border bg-card/60">
      <div className="border-b px-5 py-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-40" />
      </div>
      <div className="p-5">
        <Skeleton className="h-[28rem] w-full rounded-2xl" />
      </div>
    </section>
  );
}

function LeagueStatsEmpty() {
  return (
    <section className="overflow-hidden rounded-3xl border bg-card/60">
      <div className="border-b px-5 py-4">
        <h2 className="text-lg font-semibold">Trajectory</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Finished rounds only.
        </p>
      </div>
      <div className="p-5">
        <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/35 px-6 text-center">
          <div className="rounded-full bg-accent p-3 text-primary">
            <TrendingUp className="size-5" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No stats yet</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            This chart unlocks once the league has at least one finished round
            with results to plot.
          </p>
        </div>
      </div>
    </section>
  );
}

export function LeagueStatsPanel({ leagueId }: LeagueStatsPanelProps) {
  const trajectory = useQuery(api.leagues.getLeagueStatsTrajectory, { leagueId });
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(
    null,
  );

  const chartModel = useMemo(() => {
    if (!trajectory || !trajectory.hasData) {
      return null;
    }

    const series = trajectory.series.map((member, index) => {
      const latest = getLatestMetrics(trajectory, member.userId);

      return {
        ...member,
        color: `var(--league-stats-series-${index})`,
        dataKey: member.userId,
        avatarSrc: member.image ?? buildAvatarDataUri(member.userId),
        latestPoints: latest.points,
        latestRank: latest.rank,
        latestUpvotes: latest.upvotes,
        latestDownvotes: latest.downvotes,
      };
    });

    const style = Object.fromEntries(
      series.map((member, index) => [
        `--league-stats-series-${index}`,
        getLeagueStatsSeriesColor(index),
      ]),
    );
    const chartConfig = Object.fromEntries(
      series.map((member) => [
        member.dataKey,
        {
          label: member.name,
          color: member.color,
        },
      ]),
    );
    const seriesById = new Map(series.map((member) => [member.dataKey, member]));
    const { rows, yDomain } = buildLeagueStatsChartRows(trajectory);

    return {
      series,
      rows,
      yDomain,
      style,
      chartConfig,
      seriesById,
    };
  }, [trajectory]);

  if (trajectory === undefined) {
    return <LeagueStatsLoading />;
  }

  if (!trajectory || !trajectory.hasData || !chartModel) {
    return <LeagueStatsEmpty />;
  }

  const effectiveHighlightedUserId =
    highlightedUserId &&
    chartModel.series.some((member) => member.userId === highlightedUserId)
      ? highlightedUserId
      : null;

  return (
    <section className="overflow-hidden rounded-3xl border bg-card/60">
      <div className="border-b px-5 py-4">
        <h2 className="text-lg font-semibold">Trajectory</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cumulative leaderboard points, with upvote and downvote totals in the
          tooltip. Finished rounds only.
        </p>
      </div>
      <div className="p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Focus className="size-4" />
            <span>Focus a player to mute the rest.</span>
          </div>
          {effectiveHighlightedUserId ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHighlightedUserId(null)}
            >
              Clear focus
            </Button>
          ) : null}
        </div>
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
          {chartModel.series.map((member) => {
            const isHighlighted = effectiveHighlightedUserId === member.userId;
            const isMuted =
              effectiveHighlightedUserId !== null && !isHighlighted;

            return (
              <button
                key={member.userId}
                type="button"
                onClick={() =>
                  setHighlightedUserId((current) =>
                    current === member.userId ? null : member.userId,
                  )
                }
                className={cn(
                  "min-w-52 rounded-2xl border bg-background/55 px-3 py-3 text-left transition-all",
                  "hover:border-primary/40 hover:bg-accent/30",
                  isHighlighted && "border-primary bg-accent/40 shadow-sm",
                  isMuted && "opacity-40",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-1.5 rounded-full"
                    style={{ backgroundColor: member.color }}
                  />
                  <Avatar className="size-10 border border-border/60">
                    <AvatarImage src={member.image} alt={member.name} />
                    <AvatarFallback
                      dangerouslySetInnerHTML={{
                        __html: toSvg(member.userId, 40),
                      }}
                    />
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {member.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      #{member.latestRank} · {member.latestPoints} pts
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  +{member.latestUpvotes} upvotes · -{member.latestDownvotes} downvotes
                </p>
              </button>
            );
          })}
        </div>
        <ChartContainer
          config={chartModel.chartConfig}
          className="h-[28rem] w-full aspect-auto"
          style={chartModel.style as React.CSSProperties}
        >
          <LineChart
            accessibilityLayer
            data={chartModel.rows}
            margin={{ top: 24, right: 38, bottom: 42, left: 4 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              type="category"
              dataKey="label"
              tickFormatter={formatRoundTick}
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              minTickGap={10}
              angle={-24}
              textAnchor="end"
              height={66}
            />
            <YAxis
              width={56}
              domain={chartModel.yDomain}
              allowDecimals={false}
              tickFormatter={formatPoints}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
              content={(props) => (
                <LeagueStatsTooltip
                  {...props}
                  seriesById={chartModel.seriesById}
                  highlightedUserId={effectiveHighlightedUserId}
                />
              )}
            />
            {chartModel.series.map((member) => {
              const isHighlighted = effectiveHighlightedUserId === member.userId;
              const isMuted =
                effectiveHighlightedUserId !== null && !isHighlighted;
              const emphasis = isMuted ? 0.18 : 1;

              return (
                <Line
                  key={member.userId}
                  type="linear"
                  dataKey={member.dataKey}
                  stroke={member.color}
                  strokeWidth={isHighlighted ? 3.5 : 2.5}
                  strokeOpacity={emphasis}
                  isAnimationActive={false}
                  activeDot={{
                    r: isHighlighted ? 5 : 4,
                    fill: member.color,
                    stroke: "var(--background)",
                    strokeWidth: 2,
                  }}
                  dot={(props) => (
                    <LeagueStatsLineHead
                      {...props}
                      avatarSrc={member.avatarSrc}
                      color={member.color}
                      emphasis={isMuted ? 0.35 : 1}
                    />
                  )}
                />
              );
            })}
          </LineChart>
        </ChartContainer>
      </div>
    </section>
  );
}
