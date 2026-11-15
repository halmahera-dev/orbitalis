"use client";

import { ChartContainer, type ChartConfig } from "@repo/ui/components/chart";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import type { BowlSeriesPoint } from "@/features/bowls/bowls-queries";

function toChartPoints(points: BowlSeriesPoint[]) {
  return points.map((point) => {
    const verticalMm = -point.mm;
    return {
      time: Date.parse(point.date),
      mm: verticalMm,
      band: [verticalMm - point.bandMm, verticalMm + point.bandMm],
    };
  });
}

export function NisarSeriesChart({
  points,
  labels,
}: {
  points: BowlSeriesPoint[] | null;
  labels: { title: string; note: string; empty: string };
}) {
  const config = { mm: { label: labels.title, color: "var(--brand)" } } satisfies ChartConfig;
  const dayFormat = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return (
    <section className="flex flex-col gap-2" aria-label={labels.title}>
      <h3 className="text-sm font-medium">{labels.title}</h3>
      {points ? (
        <ChartContainer config={config} className="aspect-auto h-36 w-full">
          <ComposedChart
            data={toChartPoints(points)}
            margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(time: number) => dayFormat.format(time)}
              tickLine={false}
              axisLine={false}
              tickCount={5}
            />
            <YAxis tickLine={false} axisLine={false} unit=" mm" width={64} tickCount={5} />
            <Area
              dataKey="band"
              stroke="none"
              fill="var(--color-mm)"
              fillOpacity={0.14}
              isAnimationActive={false}
            />
            <Line
              dataKey="mm"
              type="linear"
              stroke="var(--color-mm)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
      ) : (
        <p className="rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground">
          {labels.empty}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{labels.note}</p>
    </section>
  );
}
