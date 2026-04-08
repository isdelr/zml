"use client";

import { useMemo } from "react";
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
import { TrendingUp } from "lucide-react";
import { toSvg } from "jdenticon";

import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/lib/convex/api";
import {
  buildLeagueStatsChartRows,
  getLeagueStatsField,
  getLeagueStatsSeriesColor,
  type LeagueStatsChartRow,
  type LeagueStatsSeries,
} from "@/lib/leagues/stats";
import { formatShortDateTime } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

interface LeagueStatsPanelProps {
  leagueId: Id<"leagues">;
}

type ChartSeries = LeagueStatsSeries & {
  color: string;
  dataKey: string;
  avatarSrc: string;
};

function buildAvatarDataUri(userId: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(toSvg(userId, 64))}`;
}

function formatDateTick(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatPoints(value: number) {
  return `${value} pts`;
}

function LeagueStatsTooltip({
  active,
  payload,
  seriesById,
}: TooltipContentProps & {
  seriesById: Map<string, ChartSeries>;
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
    .sort((left, right) => left.rank - right.rank);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="min-w-72 rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur">
      <div className="border-b border-border/50 pb-2">
        <p className="text-sm font-semibold text-foreground">{point.label}</p>
        <p className="text-xs text-muted-foreground">
          {formatShortDateTime(point.timestamp)}
        </p>
      </div>
      <div className="mt-3 space-y-2.5">
        {items.map((item) => (
          <div key={item.userId} className="flex items-center gap-3">
            <div
              className="h-9 w-1 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <Avatar className="size-9 border border-border/50">
              <AvatarImage src={item.image} alt={item.name} />
              <AvatarFallback>
                <div
                  dangerouslySetInnerHTML={{
                    __html: toSvg(item.userId, 36),
                  }}
                />
              </AvatarFallback>
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
}: DotItemDotProps & {
  avatarSrc: string;
  color: string;
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
    <g transform={`translate(${cx}, ${cy})`} className="pointer-events-none">
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

  const chartModel = useMemo(() => {
    if (!trajectory || !trajectory.hasData) {
      return null;
    }

    const series = trajectory.series.map((member, index) => ({
      ...member,
      color: `var(--league-stats-series-${index})`,
      dataKey: member.userId,
      avatarSrc: member.image ?? buildAvatarDataUri(member.userId),
    }));
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
        <ChartContainer
          config={chartModel.chartConfig}
          className="h-[28rem] w-full aspect-auto"
          style={chartModel.style as React.CSSProperties}
        >
          <LineChart
            accessibilityLayer
            data={chartModel.rows}
            margin={{ top: 24, right: 38, bottom: 8, left: 4 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="timestamp"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatDateTick}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={32}
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
                />
              )}
            />
            {chartModel.series.map((member) => (
              <Line
                key={member.userId}
                type="linear"
                dataKey={member.dataKey}
                stroke={member.color}
                strokeWidth={2.5}
                isAnimationActive={false}
                activeDot={{
                  r: 4,
                  fill: member.color,
                  stroke: "var(--background)",
                  strokeWidth: 2,
                }}
                dot={(props) => (
                  <LeagueStatsLineHead
                    {...props}
                    avatarSrc={member.avatarSrc}
                    color={member.color}
                  />
                )}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </div>
    </section>
  );
}
