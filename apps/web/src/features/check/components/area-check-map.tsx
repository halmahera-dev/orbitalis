"use client";

import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Location01Icon,
  Navigation03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { Cell } from "@/features/bowls/bowls-queries";

import { Map, useMap } from "@/components/ui/map";
import { rateClass } from "@/features/map/bowl-rates";
import { CellLayer, type CellScale } from "@/features/map/components/cell-layer";
import { fill, type Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const scale: CellScale = { kind: "sinking", stops: [0, 30, 60] };
const metersPerDegree = 111_320;
const checkYear = 2035;
const currentYear = 2026;

const classTones = {
  slow: "bg-rate-slow",
  middle: "bg-rate-middle",
  fast: "bg-rate-fast",
} as const;

function cellNear(point: [number, number], cells: Cell[], cellSizeM: number) {
  const half = cellSizeM / 2;
  return (
    cells.find((cell) => {
      const east =
        (point[0] - cell.center[0]) * metersPerDegree * Math.cos((point[1] * Math.PI) / 180);
      const north = (point[1] - cell.center[1]) * metersPerDegree;
      return Math.abs(east) <= half && Math.abs(north) <= half;
    }) ?? null
  );
}

function FlyTo({ point }: { point: [number, number] | null }) {
  const { map, isLoaded } = useMap();
  const longitude = point?.[0];
  const latitude = point?.[1];
  useEffect(() => {
    if (!map || !isLoaded || longitude === undefined || latitude === undefined) {
      return;
    }
    const camera = { center: [longitude, latitude] as [number, number], zoom: 13.5 };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      map.jumpTo(camera);
      return;
    }
    map.easeTo({ ...camera, duration: 800 });
  }, [map, isLoaded, longitude, latitude]);
  return null;
}

export function AreaCheckMap({
  cells,
  cellSizeM,
  labels,
}: {
  cells: Cell[];
  cellSizeM: number;
  labels: { check: Dictionary["check"]; common: Dictionary["common"] };
}) {
  const t = labels.check;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const selected = cells.find((cell) => cell.id === selectedId) ?? null;
  const rate = selected?.sinkingMmYr ?? null;
  const tone = rate === null ? null : rateClass(rate);

  function locate() {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point: [number, number] = [position.coords.longitude, position.coords.latitude];
        const cell = cellNear(point, cells, cellSizeM);
        if (!cell) {
          toast.error(t.outside);
          return;
        }
        setFocus(point);
        setSelectedId(cell.id);
      },
      () => toast.error(t.locationDenied),
    );
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-4xl border">
      <Map center={[106.83, -6.22]} zoom={10.4} maxPitch={0} className="absolute inset-0">
        <CellLayer
          cells={cells}
          cellSizeM={cellSizeM}
          scale={scale}
          selectedCellId={selectedId}
          onSelect={setSelectedId}
        />
        <FlyTo point={focus} />
      </Map>

      <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full border border-transparent glass p-1 pl-3 text-sm shadow-md">
        <HugeiconsIcon icon={Location01Icon} strokeWidth={2} className="size-4" />
        {t.tapHint}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button size="icon-sm" variant="ghost" aria-label={t.useLocation} onClick={locate} />
            }
          >
            <HugeiconsIcon icon={Navigation03Icon} strokeWidth={2} />
          </TooltipTrigger>
          <TooltipContent>{t.useLocation}</TooltipContent>
        </Tooltip>
      </div>

      {selected ? (
        <section
          aria-live="polite"
          className="absolute right-3 bottom-3 left-3 flex fade-in flex-col gap-3 rounded-4xl border border-transparent glass p-4 text-sm shadow-md md:left-auto md:w-96"
        >
          <div className="flex items-start gap-2">
            <h2 className="flex-1 type-title">{fill(t.areaTitle, { size: cellSizeM })}</h2>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={labels.common.close}
              onClick={() => setSelectedId(null)}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
          </div>
          {rate === null || tone === null ? (
            <p className="text-muted-foreground">{t.noData}</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className={cn("size-4 shrink-0 rounded-full", classTones[tone])} />
                <span className="type-title text-xl">{t.classes[tone]}</span>
              </div>
              <ol className="flex gap-1" aria-hidden="true">
                {(["slow", "middle", "fast"] as const).map((step) => (
                  <li
                    key={step}
                    className={cn(
                      "h-1.5 flex-1 rounded-full",
                      step === tone ? classTones[step] : "bg-muted-foreground/15",
                    )}
                  />
                ))}
              </ol>
              <p>
                {fill(t.plainRate, {
                  cm: Math.max(Math.round(rate / 10), 0),
                  year: checkYear,
                  total: Math.max(Math.round((rate * (checkYear - currentYear)) / 10), 0),
                })}
              </p>
            </>
          )}
          <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                strokeWidth={2}
                className="size-4 shrink-0 text-brand-text"
              />
              {t.means}
            </li>
            <li className="flex items-start gap-2">
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4 shrink-0" />
              {t.notMeans}
            </li>
          </ul>
        </section>
      ) : null}
    </div>
  );
}
