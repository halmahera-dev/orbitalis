import Link from "next/link";

import type { Dictionary, Locale } from "@/lib/i18n";

import {
  AreaCheckFigure,
  ParcelFigure,
  PipesFigure,
  PumpsFigure,
  RechargeFigure,
  WaterFarmingFigure,
} from "@/features/landing/figures/question-figures";

const needs = [
  { Figure: PumpsFigure, path: "/map" },
  { Figure: RechargeFigure, path: "/map?show=sinking" },
  { Figure: PipesFigure, path: "/map?show=people" },
  { Figure: WaterFarmingFigure, path: "/map?show=farming" },
  { Figure: ParcelFigure, path: "/map?show=sinking" },
  { Figure: AreaCheckFigure, path: "/check" },
] as const;

export function NeedCards({
  locale,
  items,
}: {
  locale: Locale;
  items: Dictionary["landing"]["questions"]["items"];
}) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {needs.map(({ Figure, path }, index) => {
        const item = items[index];
        return (
          <li key={item.question}>
            <Link
              href={`/${locale}${path}`}
              className="flex h-full pressable flex-col gap-3 rounded-4xl bg-card p-4 shadow-card transition-colors duration-160 ease-out outline-none hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <Figure label={item.figure} />
              <p className="type-label-mono text-muted-foreground">{item.team}</p>
              <h2 className="type-title text-balance">{item.question}</h2>
              <ol className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                {item.steps.map((step) => (
                  <li key={step} className="rounded-full bg-muted px-2.5 py-1">
                    {step}
                  </li>
                ))}
              </ol>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
