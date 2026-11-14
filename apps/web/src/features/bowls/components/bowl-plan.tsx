import type { CSSProperties } from "react";

import type { SceneInsets, ScenePart } from "@/features/bowls/components/bowl-scene";

import { blockHalfSize, bowlSpread, contourRings, wellOffsetM } from "@/features/bowls/bowl-shape";
import { cn } from "@/lib/utils";

const scaleBarMeters = 500;

export function BowlPlan({
  radiusM,
  depthMeters,
  label,
  scaleLabel,
  part,
  seaDepthMeters,
  insets,
}: {
  insets: SceneInsets;
  radiusM: number;
  depthMeters: number;
  seaDepthMeters: number;
  label: string;
  scaleLabel: string;
  part: ScenePart;
}) {
  const halfSize = blockHalfSize(radiusM);
  const rings = contourRings(depthMeters, radiusM);
  const margin = halfSize * 0.08;
  const markerSize = halfSize * 0.02;
  const waterRadius =
    depthMeters > seaDepthMeters && seaDepthMeters > 0
      ? bowlSpread(radiusM) * Math.sqrt(Math.log(depthMeters / seaDepthMeters))
      : 0;

  return (
    <div
      style={
        {
          "--inset-top": `${insets.top}px`,
          "--inset-bottom": `${insets.bottom}px`,
          "--inset-left": `${insets.left}px`,
          "--inset-right": `${insets.right}px`,
        } as CSSProperties
      }
      className="size-full pt-(--inset-top) pr-(--inset-right) pb-(--inset-bottom) pl-(--inset-left)"
    >
      <div className="flex size-full items-center justify-center p-6">
        <svg
          viewBox={`${-halfSize} ${-halfSize} ${halfSize * 2} ${halfSize * 2}`}
          className="aspect-square max-h-full w-full max-w-xl rounded-4xl bg-muted/50"
          role="img"
          aria-label={label}
        >
          {rings.map((ring) => (
            <circle
              key={ring.depth}
              r={ring.radius}
              vectorEffect="non-scaling-stroke"
              strokeWidth="1"
              className="fill-rate-fast/10 stroke-foreground/25"
            />
          ))}
          {waterRadius > 0 ? (
            <circle
              r={waterRadius}
              vectorEffect="non-scaling-stroke"
              strokeWidth={part === "sea" ? 2 : 0}
              className={cn("fill-chart-2/40", part === "sea" && "stroke-brand")}
            />
          ) : null}
          {part === "center" ? <circle r={markerSize} className="fill-brand" /> : null}
          {part === "house" ? (
            <circle
              r={radiusM * 0.22}
              vectorEffect="non-scaling-stroke"
              strokeWidth="2"
              fill="none"
              className="stroke-brand"
            />
          ) : null}
          {part === "well" ? (
            <circle cx={wellOffsetM(radiusM)} r={markerSize} className="fill-brand" />
          ) : null}
          {part === "clay" ? (
            <circle
              r={radiusM * 1.2}
              vectorEffect="non-scaling-stroke"
              strokeWidth="2"
              strokeDasharray="6 4"
              fill="none"
              className="stroke-brand"
            />
          ) : null}
          {part === "edge" ? (
            <circle
              r={radiusM}
              vectorEffect="non-scaling-stroke"
              strokeWidth="2"
              fill="none"
              className="stroke-brand"
            />
          ) : null}
          {part === "block" ? (
            <rect
              x={-halfSize}
              y={-halfSize}
              width={halfSize * 2}
              height={halfSize * 2}
              vectorEffect="non-scaling-stroke"
              strokeWidth="4"
              fill="none"
              className="stroke-brand"
            />
          ) : null}
          <line
            x1={-halfSize + margin}
            x2={-halfSize + margin + scaleBarMeters}
            y1={halfSize - margin}
            y2={halfSize - margin}
            vectorEffect="non-scaling-stroke"
            strokeWidth="2"
            className="stroke-foreground/60"
          />
          <text
            x={-halfSize + margin}
            y={halfSize - margin * 1.4}
            fontSize={halfSize * 0.045}
            className="fill-muted-foreground tabular-nums"
          >
            {scaleLabel}
          </text>
        </svg>
      </div>
    </div>
  );
}
