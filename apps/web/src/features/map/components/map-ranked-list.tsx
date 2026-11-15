"use client";

import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/button";
import Link from "next/link";
import { useState } from "react";

import { fill } from "@/lib/i18n";

export type RankedListItem = {
  id: string;
  rank: number;
  name: string;
  detail: string;
  value: string;
  href?: string;
  group?: string;
};

const rowClassName =
  "flex w-full pressable items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40";

function RowContent({ item }: { item: RankedListItem }) {
  return (
    <>
      <span className="w-6 text-muted-foreground tabular-nums">{item.rank}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{item.name}</span>
        <span className="truncate text-xs text-muted-foreground">{item.detail}</span>
      </span>
      <span className="text-right text-muted-foreground tabular-nums">{item.value}</span>
    </>
  );
}

export function MapRankedList({
  items,
  title,
  summary,
  emptyText,
  rankTemplate,
  showLabel,
  hideLabel,
  onSelect,
}: {
  items: RankedListItem[];
  title: string;
  summary: string;
  emptyText: string;
  rankTemplate: string;
  showLabel: string;
  hideLabel: string;
  onSelect?: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <nav
      aria-label={title}
      className="absolute top-4 right-4 hidden max-h-112 w-80 fade-in flex-col gap-1 overflow-y-auto rounded-3xl border border-transparent glass p-2 shadow-md md:flex"
    >
      <div className="flex items-center justify-between gap-2 pl-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {summary}
          </p>
        </div>
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
      {isOpen && items.length === 0 && (
        <p className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</p>
      )}
      {isOpen && items.length > 0 && (
        <ol className="flex flex-col">
          {items.map((item, index) => {
            const label = `${item.name}, ${fill(rankTemplate, { rank: item.rank })}`;
            const startsGroup = item.group !== undefined && item.group !== items[index - 1]?.group;
            return (
              <li key={item.id}>
                {startsGroup && (
                  <h3 className="px-3 pt-2 pb-1 text-xs text-muted-foreground">{item.group}</h3>
                )}
                {item.href ? (
                  <Link
                    href={item.href}
                    prefetch={false}
                    aria-label={label}
                    className={rowClassName}
                  >
                    <RowContent item={item} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-label={label}
                    className={rowClassName}
                    onClick={() => onSelect?.(item.id)}
                  >
                    <RowContent item={item} />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
