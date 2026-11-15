"use client";

import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Location01Icon,
  Navigation03Icon,
  Share08Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import type { Cell } from "@/features/bowls/bowls-queries";

import { Map, useMap } from "@/components/ui/map";
import { findAddress } from "@/features/check/check-actions";
import { GroundDropFigure } from "@/features/check/components/ground-drop-figure";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("cell"));
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [isSearching, startSearching] = useTransition();
  const selected = cells.find((cell) => cell.id === selectedId) ?? null;
  const rate = selected?.sinkingMmYr ?? null;
  const tone = rate === null ? null : rateClass(rate);
  const sortedRates = useMemo(
    () => cells.flatMap((cell) => cell.sinkingMmYr ?? []).toSorted((a, b) => a - b),
    [cells],
  );
  const slowerShare =
    rate === null
      ? 0
      : Math.round(
          (sortedRates.filter((other) => other < rate).length / Math.max(sortedRates.length, 1)) *
            100,
        );
  const dropCm =
    rate === null ? 0 : Math.max(Math.round((rate * (checkYear - currentYear)) / 10), 0);

  function select(cellId: string | null) {
    setSelectedId(cellId);
    window.history.replaceState(null, "", cellId ? `${pathname}?cell=${cellId}` : pathname);
  }

  function showPoint(point: [number, number]) {
    const cell = cellNear(point, cells, cellSizeM);
    if (!cell) {
      toast.error(t.outside);
      return;
    }
    setFocus(point);
    select(cell.id);
  }

  function locate() {
    navigator.geolocation.getCurrentPosition(
      (position) => showPoint([position.coords.longitude, position.coords.latitude]),
      () => toast.error(t.locationDenied),
    );
  }

  function search(formData: FormData) {
    startSearching(async () => {
      const result = await findAddress(String(formData.get("address") ?? ""));
      if (!result.ok) {
        toast.error(t.addressNotFound);
        return;
      }
      showPoint(result.point);
    });
  }

  function share() {
    const url = window.location.href;
    if (navigator.share) {
      void navigator.share({ title: t.title, url });
      return;
    }
    void navigator.clipboard.writeText(url).then(() => toast.success(t.linkCopied));
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-4xl border">
      <Map center={[106.83, -6.22]} zoom={10.4} maxPitch={0} className="absolute inset-0">
        <CellLayer
          cells={cells}
          cellSizeM={cellSizeM}
          scale={scale}
          selectedCellId={selectedId}
          onSelect={select}
        />
        <FlyTo point={focus} />
      </Map>

      <form
        action={search}
        className="absolute top-3 right-3 left-3 flex items-center gap-2 rounded-full border border-transparent glass p-1 pl-3 text-sm shadow-md md:right-auto md:w-96"
      >
        <HugeiconsIcon icon={Location01Icon} strokeWidth={2} className="size-4 shrink-0" />
        <input
          name="address"
          type="search"
          maxLength={120}
          aria-label={t.addressLabel}
          placeholder={t.addressPlaceholder}
          disabled={isSearching}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={t.useLocation}
                onClick={locate}
              />
            }
          >
            <HugeiconsIcon icon={Navigation03Icon} strokeWidth={2} />
          </TooltipTrigger>
          <TooltipContent>{t.useLocation}</TooltipContent>
        </Tooltip>
      </form>

      {selected ? (
        <section
          aria-live="polite"
          className="absolute right-3 bottom-3 left-3 flex fade-in flex-col gap-3 rounded-4xl border border-transparent glass p-4 text-sm shadow-md md:left-auto md:w-96"
        >
          <div className="flex items-start gap-2">
            <h2 className="flex-1 type-title">{fill(t.areaTitle, { size: cellSizeM })}</h2>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button size="icon-sm" variant="ghost" aria-label={t.share} onClick={share} />
                }
              >
                <HugeiconsIcon icon={Share08Icon} strokeWidth={2} />
              </TooltipTrigger>
              <TooltipContent>{t.share}</TooltipContent>
            </Tooltip>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={labels.common.close}
              onClick={() => select(null)}
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
              <p className="type-title text-balance">
                {fill(t.percentile, { share: slowerShare })}
              </p>
              <GroundDropFigure
                dropCm={dropCm}
                label={fill(t.figure, { cm: dropCm, year: checkYear })}
              />
              <p>
                {fill(t.plainRate, {
                  cm: Math.max(Math.round(rate / 10), 0),
                  year: checkYear,
                  total: dropCm,
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
