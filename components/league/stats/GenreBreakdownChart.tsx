import { ListMusic } from "lucide-react";
import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

type GenreDatum = {
  name: string;
  value: number;
};

const CHART_COLORS = [
  "#E88A1A",
  "#2D9A5F",
  "#A855F7",
  "#D4A017",
  "#3B82C4",
  "#D4740F",
  "#50B87A",
  "#C084FC",
];

export function GenreBreakdownChart({ data }: { data: GenreDatum[] | undefined }) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-xl font-bold">
        <ListMusic className="size-5" />
        Genre Breakdown
      </h3>
      <Card className="bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardDescription>Distribution of genres across all submissions</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <ChartContainer
            config={Object.fromEntries(
              data.map((genre, index) => [
                genre.name,
                {
                  label: genre.name,
                  color: CHART_COLORS[index % CHART_COLORS.length],
                },
              ]),
            )}
            className="mx-auto aspect-square h-[300px]"
          >
            <PieChart>
              <Tooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={false}
                label={({ name, percent }: { name?: string | number; percent?: number }) =>
                  `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
