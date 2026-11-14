"use client";

import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Switch } from "@repo/ui/components/switch";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { PublicBowl } from "@/features/bowls/bowls-queries";

import { AppLogo } from "@/components/app-logo";
import { Map, useMap } from "@/components/ui/map";
import { dropMeters, fastRateMmYr, slowRateMmYr } from "@/features/map/bowl-rates";
import { BarTimeline, usePlayback } from "@/features/map/components/bar-timeline";
import { BowlLayer } from "@/features/map/components/bowl-layer";
import { MapBowlList } from "@/features/map/components/map-bowl-list";
import { BuildingsLayer, InterferogramLayer } from "@/features/nisar/components/nisar-layers";
import { interferogramCatalog } from "@/features/nisar/nisar-catalog";
import { LanguageSwitch } from "@/features/shell/components/language-switch";
import { fill, formatDate, type Dictionary, type Locale } from "@/lib/i18n";

const globe = { type: "globe" } as const;
const currentYear = 2026;
const defaultYear = 2035;
const passesPerSecond = 1.25;
const maxPitch = 75;
const positionWriteDelayMs = 300;

type Option = { value: string; label: string };
type Position = { center: [number, number]; zoom: number };

const overviewCamera = {
  center: [106.81, -6.13] as [number, number],
  zoom: 12,
  pitch: 58,
  bearing: -20,
};

function parsePosition(value: string | null): Position | null {
  const parts = value?.split(",").map(Number);
  if (parts?.length === 3 && parts.every(Number.isFinite)) {
    return { center: [parts[0], parts[1]], zoom: parts[2] };
  }
  return null;
}

function formatPosition({ center, zoom }: Position) {
  return `${center[0].toFixed(4)},${center[1].toFixed(4)},${zoom.toFixed(2)}`;
}

function MapCamera({ is2d, hasStartPosition }: { is2d: boolean; hasStartPosition: boolean }) {
  const { map, isLoaded } = useMap();
  const hasFlownRef = useRef(false);
  const isFirstPitchRef = useRef(true);

  useEffect(() => {
    if (!map || !isLoaded || hasFlownRef.current) {
      return;
    }
    hasFlownRef.current = true;
    if (hasStartPosition) {
      return;
    }
    const nextCamera = { ...overviewCamera, pitch: is2d ? 0 : overviewCamera.pitch };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      map.jumpTo(nextCamera);
      return;
    }
    map.flyTo({ ...nextCamera, duration: 7000, essential: true });
  }, [map, isLoaded, is2d, hasStartPosition]);

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    map.setMaxPitch(is2d ? 0 : maxPitch);
    const isFirstRun = isFirstPitchRef.current;
    isFirstPitchRef.current = false;
    if (isFirstRun && !is2d) {
      return;
    }
    const pitch = is2d ? 0 : overviewCamera.pitch;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      map.jumpTo({ pitch });
      return;
    }
    map.easeTo({ pitch, duration: 600 });
  }, [map, isLoaded, is2d]);

  return null;
}

function parsePassIndex(value: string | null, passCount: number) {
  const index = Number(value);
  if (value !== null && Number.isInteger(index) && index >= 0 && index < passCount) {
    return index;
  }
  return passCount - 1;
}

function HeaderSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="hidden lg:inline">{label}</span>
      <Select items={options} value={value} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger size="sm" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function OrbitalisMap({
  locale,
  bowls,
  labels,
}: {
  locale: Locale;
  bowls: PublicBowl[];
  labels: { map: Dictionary["map"]; common: Dictionary["common"] };
}) {
  const t = labels.map;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pairs = interferogramCatalog.pairs;
  const positionTimerRef = useRef(0);

  const isBowls = searchParams.get("show") !== "radar";
  const is2d = searchParams.get("view") === "2d";
  const [startPosition] = useState(() => parsePosition(searchParams.get("at")));
  const [passIndex, setPassIndex] = useState(() =>
    parsePassIndex(searchParams.get("pass"), pairs.length),
  );
  const pair = pairs[passIndex];

  function setParam(name: string, value: string | null) {
    const nextParams = new URLSearchParams(window.location.search);
    if (value === null) {
      nextParams.delete(name);
    } else {
      nextParams.set(name, value);
    }
    window.history.replaceState(null, "", `${pathname}?${nextParams}`);
  }

  function rememberPosition(position: Position) {
    window.clearTimeout(positionTimerRef.current);
    positionTimerRef.current = window.setTimeout(() => {
      setParam("at", formatPosition(position));
    }, positionWriteDelayMs);
  }

  function openBowl(bowlId: string) {
    router.push(`/${locale}/bowls/${bowlId}`);
  }

  function showPass(value: number) {
    setPassIndex(Math.floor(value));
  }

  function commitPass(value: number) {
    const nextIndex = Math.floor(value);
    setPassIndex(nextIndex);
    setParam("pass", String(nextIndex));
  }

  const playback = usePlayback({
    value: passIndex,
    min: 0,
    max: pairs.length - 1,
    unitsPerSecond: passesPerSecond,
    onFrame: showPass,
    onStop: commitPass,
  });

  function changeShow(value: string) {
    playback.pause();
    setParam("show", value === "radar" ? "radar" : null);
  }

  function scrub(value: number) {
    playback.pause();
    commitPass(value);
  }

  function togglePlay() {
    if (playback.isPlaying) {
      playback.pause();
    } else {
      playback.play();
    }
  }

  const baselineYears = defaultYear - currentYear;
  const fastestBowl = bowls.toSorted((a, b) => b.rateAfterBanMmYr - a.rateAfterBanMmYr)[0];

  function describeView() {
    if (!isBowls) {
      return fill(t.radarSummary, {
        start: formatDate(locale, pair.referenceDate),
        end: formatDate(locale, pair.secondaryDate),
        days: Math.round(
          (Date.parse(pair.secondaryDate) - Date.parse(pair.referenceDate)) / 86_400_000,
        ),
      });
    }
    return fill(t.bowlSummary, {
      name: fastestBowl.name,
      meters: dropMeters(fastestBowl, baselineYears, true).toFixed(2),
      year: defaultYear,
    });
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
        <Link href={`/${locale}/landing`} className="flex items-center gap-2 text-sm font-medium">
          <AppLogo />
          ORBITALIS
        </Link>
        <HeaderSelect
          label={t.show}
          value={isBowls ? "bowls" : "radar"}
          options={[
            { value: "bowls", label: t.showBowls },
            { value: "radar", label: t.showRadar },
          ]}
          onChange={changeShow}
        />
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              size="sm"
              checked={is2d}
              onCheckedChange={(checked) => setParam("view", checked ? "2d" : null)}
            />
            {t.view2d}
          </label>
          <LanguageSwitch locale={locale} label={labels.common.switchLanguage} />
          <Button size="sm" nativeButton={false} render={<Link href={`/${locale}`} />}>
            {labels.common.openDesk}
          </Button>
        </div>
        <p
          className="w-full text-sm text-muted-foreground"
          aria-live={playback.isPlaying ? "off" : "polite"}
        >
          {describeView()}
        </p>
      </header>

      <div className="relative min-h-0 flex-1">
        <Map
          center={startPosition?.center ?? [112, -2]}
          zoom={startPosition?.zoom ?? 2.6}
          pitch={startPosition && !is2d ? overviewCamera.pitch : 0}
          bearing={startPosition ? overviewCamera.bearing : 0}
          projection={globe}
          maxPitch={maxPitch}
          onViewportChange={rememberPosition}
        >
          <BuildingsLayer />
          {isBowls ? (
            <BowlLayer
              bowls={bowls}
              years={baselineYears}
              withBan
              baselineYears={baselineYears}
              selectedBowlId={null}
              onSelect={openBowl}
              onDeselect={() => {}}
            />
          ) : (
            <InterferogramLayer pair={pair} />
          )}
          <MapCamera is2d={is2d} hasStartPosition={startPosition !== null} />
        </Map>
        <div className="absolute top-4 left-4 flex max-w-64 flex-col gap-2 rounded-4xl border border-transparent glass p-3 text-xs text-muted-foreground shadow-md">
          {isBowls ? (
            <>
              <div className="h-2 rounded-full bg-linear-to-r from-rate-slow via-rate-middle to-rate-fast" />
              <div className="flex justify-between tabular-nums">
                <span>{slowRateMmYr} mm/yr</span>
                <span>{fastRateMmYr} mm/yr</span>
              </div>
              <p>{fill(t.rateLegend, { year: defaultYear })}</p>
            </>
          ) : (
            <>
              <div className="phase-cycle-legend h-2 rounded-full" />
              <p>{t.phaseLegend}</p>
            </>
          )}
        </div>
        {isBowls && (
          <MapBowlList
            locale={locale}
            bowls={bowls}
            baselineYears={baselineYears}
            title={t.listTitle}
            rankTemplate={t.rankLabel}
            showLabel={t.showList}
            hideLabel={t.hideList}
          />
        )}
        {!isBowls && (
          <BarTimeline
            label={t.pass}
            bars={pairs.map((passPair) => ({
              key: passPair.id,
              label: fill(t.passBar, {
                start: formatDate(locale, passPair.referenceDate),
                end: formatDate(locale, passPair.secondaryDate),
                share: Math.round(passPair.cleanSignalShare * 100),
              }),
              height: passPair.cleanSignalShare,
            }))}
            value={passIndex}
            onChange={scrub}
            isPlaying={playback.isPlaying}
            onTogglePlay={togglePlay}
            playLabel={t.play}
            pauseLabel={t.pause}
            valueLabel={`${passIndex + 1}/${pairs.length}`}
          >
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatDate(locale, pair.referenceDate)} – {formatDate(locale, pair.secondaryDate)}.{" "}
              {fill(t.passHeight, { share: Math.round(pair.cleanSignalShare * 100) })}
            </p>
          </BarTimeline>
        )}
      </div>
    </div>
  );
}

export function OrbitalisMapSkeleton() {
  return (
    <div className="flex h-svh flex-col">
      <div className="flex items-center gap-4 border-b px-4 py-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-28" />
      </div>
      <Skeleton className="flex-1" />
    </div>
  );
}
