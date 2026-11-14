"use client";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@repo/ui/components/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

type PassPoint = { label: string; mm: number };

function PassDot({
  cx,
  cy,
  index,
  lastIndex,
}: {
  cx?: number;
  cy?: number;
  index?: number;
  lastIndex: number;
}) {
  if (cx === undefined || cy === undefined) {
    return null;
  }
  const isLatest = index === lastIndex;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isLatest ? 5 : 3}
      fill={isLatest ? "var(--brand)" : "var(--card)"}
      stroke="var(--brand)"
      strokeWidth={1.5}
    />
  );
}

export function PassChart({ points, label }: { points: PassPoint[]; label: string }) {
  const config = { mm: { label, color: "var(--brand)" } } satisfies ChartConfig;
  const lastIndex = points.length - 1;
  return (
    <ChartContainer config={config} className="aspect-auto h-44 w-full">
      <AreaChart
        data={points}
        accessibilityLayer
        margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
      >
        <defs>
          <linearGradient id="pass-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-mm)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--color-mm)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} unit=" mm" width={64} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Area
          dataKey="mm"
          type="monotone"
          baseValue="dataMin"
          stroke="var(--color-mm)"
          strokeWidth={2}
          fill="url(#pass-fill)"
          dot={(props) => <PassDot key={props.index} {...props} lastIndex={lastIndex} />}
          activeDot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
