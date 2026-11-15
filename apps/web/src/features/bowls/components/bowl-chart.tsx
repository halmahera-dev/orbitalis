"use client";

import { ChartContainer, type ChartConfig } from "@repo/ui/components/chart";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import type { BowlSeries } from "@/features/bowls/bowls-queries";

function toPoints(series: { date: string; mm: number }[]) {
  return series.map((point) => ({ time: Date.parse(point.date), mm: point.mm }));
}

export function BowlChart({
  series,
  banDate,
  labels,
}: {
  series: BowlSeries;
  banDate: string;
  labels: { sentinel: string; banLine: string; caption: string };
}) {
  const config = {
    sentinel: { label: labels.sentinel, color: "var(--chart-2)" },
  } satisfies ChartConfig;
  const yearFormat = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer config={config} className="aspect-auto h-44 w-full">
        <LineChart margin={{ top: 12, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(time: number) => yearFormat.format(time)}
            tickLine={false}
            axisLine={false}
          />
          <YAxis dataKey="mm" tickLine={false} axisLine={false} unit=" mm" width={64} />
          <ReferenceLine
            x={Date.parse(banDate)}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{
              value: labels.banLine,
              position: "insideTopRight",
              fill: "var(--muted-foreground)",
              fontSize: 11,
            }}
          />
          <Line
            data={toPoints(series.sentinel1)}
            dataKey="mm"
            name={labels.sentinel}
            stroke="var(--color-sentinel)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      <p className="text-xs text-muted-foreground">{labels.caption}</p>
    </div>
  );
}
