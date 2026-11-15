import type { CSSProperties } from "react";

import { fastRateMmYr, middleRateMmYr } from "@/features/map/bowl-rates";
import { cn } from "@/lib/utils";

function share(value: number, max: number) {
  return `${(Math.min(Math.max(value, 0), max) / max) * 100}%`;
}

export function rateTone(rateMmYr: number) {
  if (rateMmYr >= fastRateMmYr) {
    return "bg-rate-fast";
  }
  return rateMmYr >= middleRateMmYr ? "bg-rate-middle" : "bg-rate-slow";
}

export function RateRange({
  rateMmYr,
  uncertaintyMmYr,
  maxMmYr,
  label,
  className,
}: {
  rateMmYr: number;
  uncertaintyMmYr: number | null;
  maxMmYr: number;
  label: string;
  className?: string;
}) {
  const spread = uncertaintyMmYr ?? 0;
  const from = Math.max(rateMmYr - spread, 0);
  const to = rateMmYr + spread;
  return (
    <div role="img" aria-label={label} className={cn("relative h-3 min-w-16 flex-1", className)}>
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      <div
        className="absolute top-1/2 left-(--from) h-1.5 w-(--width) -translate-y-1/2 rounded-full bg-muted-foreground/20"
        style={
          {
            "--from": share(from, maxMmYr),
            "--width": `calc(${share(to, maxMmYr)} - ${share(from, maxMmYr)})`,
          } as CSSProperties
        }
      />
      <span
        className={cn(
          "absolute top-1/2 left-(--at) size-2.5 -translate-1/2 rounded-full ring-2 ring-card",
          rateTone(rateMmYr),
        )}
        style={{ "--at": share(rateMmYr, maxMmYr) } as CSSProperties}
      />
    </div>
  );
}
