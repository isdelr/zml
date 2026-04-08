export type LeagueStatsSeries = {
  userId: string;
  name: string;
  image?: string;
};

export type LeagueStatsMetric = {
  userId: string;
  totalPoints: number;
  rank: number;
  upvotesReceived: number;
  downvotesReceived: number;
  pointsDelta: number;
  upvotesDelta: number;
  downvotesDelta: number;
};

export type LeagueStatsPoint = {
  key: string;
  label: string;
  shortLabel: string;
  timestamp: number;
  kind: "league_start" | "finished_round" | "league_end";
  roundId?: string;
  roundTitle?: string;
  metrics: LeagueStatsMetric[];
};

export type LeagueStatsTrajectoryData = {
  hasData: boolean;
  leagueStartAt: number;
  rangeEndAt: number;
  series: LeagueStatsSeries[];
  points: LeagueStatsPoint[];
};

export type LeagueStatsChartRow = {
  key: string;
  label: string;
  shortLabel: string;
  timestamp: number;
  kind: LeagueStatsPoint["kind"];
  roundId?: string;
  roundTitle?: string;
  [key: string]: number | string | undefined;
};

const SERIES_COLOR_TOKENS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

type MetricField =
  | "points"
  | "rank"
  | "upvotes"
  | "downvotes"
  | "pointsDelta"
  | "upvotesDelta"
  | "downvotesDelta";

export function getLeagueStatsField(userId: string, field: MetricField) {
  return field === "points" ? userId : `${userId}__${field}`;
}

export function getLeagueStatsSeriesColor(index: number) {
  const primary = SERIES_COLOR_TOKENS[index % SERIES_COLOR_TOKENS.length];
  const secondary =
    SERIES_COLOR_TOKENS[(index + 2) % SERIES_COLOR_TOKENS.length];
  const tertiary =
    SERIES_COLOR_TOKENS[(index + 4) % SERIES_COLOR_TOKENS.length];
  const blendDepth = Math.floor(index / SERIES_COLOR_TOKENS.length);

  if (blendDepth === 0) {
    return primary;
  }

  if (blendDepth === 1) {
    return `color-mix(in oklch, ${primary} 58%, ${secondary})`;
  }

  if (blendDepth === 2) {
    return `color-mix(in oklch, ${primary} 42%, ${secondary})`;
  }

  return `color-mix(in oklch, color-mix(in oklch, ${primary} 52%, ${secondary}) 70%, ${tertiary})`;
}

export function buildLeagueStatsChartRows(
  trajectory: LeagueStatsTrajectoryData,
): {
  rows: LeagueStatsChartRow[];
  yDomain: [number, number];
} {
  const rows = trajectory.points.map((point) => {
    const row: LeagueStatsChartRow = {
      key: point.key,
      label: point.label,
      shortLabel: point.shortLabel,
      timestamp: point.timestamp,
      kind: point.kind,
      roundId: point.roundId,
      roundTitle: point.roundTitle,
    };

    for (const metric of point.metrics) {
      row[getLeagueStatsField(metric.userId, "points")] = metric.totalPoints;
      row[getLeagueStatsField(metric.userId, "rank")] = metric.rank;
      row[getLeagueStatsField(metric.userId, "upvotes")] =
        metric.upvotesReceived;
      row[getLeagueStatsField(metric.userId, "downvotes")] =
        metric.downvotesReceived;
      row[getLeagueStatsField(metric.userId, "pointsDelta")] =
        metric.pointsDelta;
      row[getLeagueStatsField(metric.userId, "upvotesDelta")] =
        metric.upvotesDelta;
      row[getLeagueStatsField(metric.userId, "downvotesDelta")] =
        metric.downvotesDelta;
    }

    return row;
  });

  const values = rows.flatMap((row) =>
    trajectory.series.map((series) => {
      const value = row[getLeagueStatsField(series.userId, "points")];
      return typeof value === "number" ? value : 0;
    }),
  );
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const spread = maxValue - minValue;
  const padding = spread === 0 ? 2 : Math.max(2, Math.ceil(spread * 0.12));

  return {
    rows,
    yDomain: [minValue - padding, maxValue + padding],
  };
}
