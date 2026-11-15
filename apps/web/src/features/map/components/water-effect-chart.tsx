import type { CSSProperties } from "react";

import type { GroupStats, WaterEffect } from "@/features/map/water-effect";

import { formatNumber, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Domain = { low: number; high: number };

function position(value: number, { low, high }: Domain) {
  return `${((value - low) / (high - low)) * 100}%`;
}

function GroupBar({
  label,
  group,
  domain,
  tone,
  locale,
  unit,
}: {
  label: string;
  group: GroupStats;
  domain: Domain;
  tone: string;
  locale: Locale;
  unit: string;
}) {
  const from = Math.min(group.meanMmYr, 0);
  const to = Math.max(group.meanMmYr, 0);
  return (
    <li className="flex flex-col gap-1">
      <span className="flex justify-between gap-2">
        <span>{label}</span>
        <span className="text-foreground tabular-nums">
          {group.meanMmYr.toFixed(1)} ±{group.errorMmYr.toFixed(1)} {unit}
        </span>
      </span>
      <span className="relative h-2 rounded-full bg-muted-foreground/15">
        <span
          className={cn("absolute inset-y-0 left-(--from) w-(--width) rounded-full", tone)}
          style={
            {
              "--from": position(from, domain),
              "--width": `calc(${position(to, domain)} - ${position(from, domain)})`,
            } as CSSProperties
          }
        />
        <span
          className="absolute top-1/2 left-(--from) h-px w-(--width) bg-foreground"
          style={
            {
              "--from": position(group.meanMmYr - group.errorMmYr, domain),
              "--width": `calc(${position(group.meanMmYr + group.errorMmYr, domain)} - ${position(group.meanMmYr - group.errorMmYr, domain)})`,
            } as CSSProperties
          }
        />
        <span
          className="absolute inset-y-0 left-(--zero) w-px bg-muted-foreground"
          style={{ "--zero": position(0, domain) } as CSSProperties}
        />
      </span>
      <span className="tabular-nums">{formatNumber(locale, group.count)}</span>
    </li>
  );
}

export function WaterEffectChart({
  effect,
  locale,
  labels,
  unit,
}: {
  effect: WaterEffect;
  locale: Locale;
  labels: Dictionary["map"]["farming"]["effect"];
  unit: string;
}) {
  const groups = [effect.near, effect.far];
  const domain = {
    low: Math.min(0, ...groups.map((group) => group.meanMmYr - group.errorMmYr)) - 0.5,
    high: Math.max(0, ...groups.map((group) => group.meanMmYr + group.errorMmYr)) + 0.5,
  };
  const verdict = !effect.isClear
    ? labels.noDifference
    : effect.near.meanMmYr < effect.far.meanMmYr
      ? labels.slower
      : labels.faster;
  return (
    <section aria-label={labels.title} className="flex flex-col gap-2 border-t pt-2">
      <h3 className="text-foreground">{labels.title}</h3>
      <ul className="flex flex-col gap-2">
        <GroupBar
          label={labels.near}
          group={effect.near}
          domain={domain}
          tone="bg-chart-5"
          locale={locale}
          unit={unit}
        />
        <GroupBar
          label={labels.far}
          group={effect.far}
          domain={domain}
          tone="bg-muted-foreground/50"
          locale={locale}
          unit={unit}
        />
      </ul>
      <p className="text-foreground">{verdict}</p>
      <p>{labels.note}</p>
    </section>
  );
}
