"use client";

import { Button } from "@repo/ui/components/button";
import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useState } from "react";

import type { PublicBowl } from "@/features/bowls/bowls-queries";

import { dropMeters } from "@/features/map/bowl-rates";
import { fill, type Locale } from "@/lib/i18n";

export function MapBowlList({
  locale,
  bowls,
  baselineYears,
  title,
  rankTemplate,
  showLabel,
  hideLabel,
}: {
  locale: Locale;
  bowls: PublicBowl[];
  baselineYears: number;
  title: string;
  rankTemplate: string;
  showLabel: string;
  hideLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <nav
      aria-label={title}
      className="absolute top-4 right-4 hidden max-h-112 w-64 fade-in flex-col gap-1 overflow-y-auto rounded-3xl border border-transparent glass p-2 shadow-md md:flex"
    >
      <div className="flex items-center justify-between gap-2 pl-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-expanded={isOpen}
          aria-label={isOpen ? hideLabel : showLabel}
          onClick={() => setIsOpen(!isOpen)}
        >
          <HugeiconsIcon icon={isOpen ? ArrowUp01Icon : ArrowDown01Icon} strokeWidth={2} />
        </Button>
      </div>
      {isOpen && (
        <ol className="flex flex-col">
          {bowls
            .toSorted((a, b) => a.rank - b.rank)
            .map((bowl) => (
              <li key={bowl.id}>
                <Link
                  href={`/${locale}/bowls/${bowl.id}`}
                  aria-label={`${bowl.name}, ${fill(rankTemplate, { rank: bowl.rank })}`}
                  className="flex w-full pressable items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <span className="w-5 text-muted-foreground tabular-nums">{bowl.rank}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{bowl.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{bowl.kecamatan}</span>
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    −{dropMeters(bowl, baselineYears, true).toFixed(2)} m
                  </span>
                </Link>
              </li>
            ))}
        </ol>
      )}
    </nav>
  );
}
