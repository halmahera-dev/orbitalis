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
import { useEffect, useMemo, useRef, useState } from "react";

import type { PriorityAreaSet } from "@/features/areas/areas-queries";
import type { PublicBowl } from "@/features/bowls/bowls-queries";

import { AppLogo } from "@/components/app-logo";
import { Map, useMap } from "@/components/ui/map";
import {
  parsePriorityFilter,
  priorityFilterParams,
  rankAreas,
  rankLeads,
  type PriorityFilter as Filter,
  type PriorityLayer,
  type RankedArea,
} from "@/features/areas/areas-priority";
import { dropMeters, fastRateMmYr, slowRateMmYr } from "@/features/map/bowl-rates";
import { AreaLayer } from "@/features/map/components/area-layer";
import { AreaPanel } from "@/features/map/components/area-panel";
import { BarTimeline, usePlayback } from "@/features/map/components/bar-timeline";
import { BowlLayer } from "@/features/map/components/bowl-layer";
import { MapRankedList, type RankedListItem } from "@/features/map/components/map-ranked-list";
import {
  NisarCandidateLayer,
  type CandidateRing,
} from "@/features/map/components/nisar-candidate-layer";
import { PriorityFilter } from "@/features/map/components/priority-filter";
import { isPriorityLayer, mapLayers, parseMapLayer } from "@/features/map/map-layers";
import { BuildingsLayer, InterferogramLayer } from "@/features/nisar/components/nisar-layers";
import { interferogramCatalog } from "@/features/nisar/nisar-catalog";
import { LanguageSwitch } from "@/features/shell/components/language-switch";
import { fill, formatDate, formatNumber, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const globe = { type: "globe" } as const;
const currentYear = 2026;
const defaultYear = 2035;
const passesPerSecond = 1.25;
const maxPitch = 75;
const positionWriteDelayMs = 300;
const areaListLimit = 50;

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

function areaListValue(
  ranked: RankedArea,
  layer: PriorityLayer,
  filter: Filter,
  locale: Locale,
  t: Dictionary["map"]["priority"],
) {
  const { area } = ranked;
  switch (filter.rankBy) {
    case "combined":
      return fill(t.scoreValue, { score: ranked.score });
    case "sinking":
      return fill(t.sinkingValue, { value: area.sinkingMmYr });
    case "population":
      return layer === "pipe"
        ? fill(t.unservedValue, { value: formatNumber(locale, area.unservedPeople) })
        : fill(t.populationValue, { value: formatNumber(locale, area.populationPerKm2) });
    case "economy":
      return t.economyLevel[area.economy];
  }
}

function priorityColorValues(ranked: RankedArea[], filter: Filter) {
  const rankBy = filter.rankBy;
  if (rankBy !== "combined") {
    return ranked.map((item) => item.factors[rankBy]);
  }
  const topScore = Math.max(1, ...ranked.map((item) => item.score));
  return ranked.map((item) => item.score / topScore);
}

export function OrbitalisMap({
  locale,
  bowls,
  areaSet,
  nisarCandidates,
  labels,
}: {
  locale: Locale;
  bowls: PublicBowl[];
  areaSet: PriorityAreaSet;
  nisarCandidates: (CandidateRing & { rateMmYr: number; uncertaintyMmYr: number })[];
  labels: { map: Dictionary["map"]; common: Dictionary["common"] };
}) {
  const t = labels.map;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pairs = interferogramCatalog.pairs;
  const positionTimerRef = useRef(0);

  const layer = parseMapLayer(searchParams.get("show"));
  const isLeads = layer === "leads";
  const isRadar = layer === "radar";
  const priorityLayer = isPriorityLayer(layer) ? layer : null;
  const is2d = searchParams.get("view") === "2d";
  const rateParam = searchParams.get("rate");
  const populationParam = searchParams.get("pop");
  const economyParam = searchParams.get("econ");
  const rankParam = searchParams.get("rank");
  const filter = useMemo(
    () =>
      parsePriorityFilter(
        new URLSearchParams({
          rate: rateParam ?? "",
          pop: populationParam ?? "",
          econ: economyParam ?? "",
          rank: rankParam ?? "",
        }),
      ),
    [rateParam, populationParam, economyParam, rankParam],
  );
  const selectedAreaId = priorityLayer ? searchParams.get("area") : null;
  const [startPosition] = useState(() => parsePosition(searchParams.get("at")));
  const [passIndex, setPassIndex] = useState(() =>
    parsePassIndex(searchParams.get("pass"), pairs.length),
  );
  const pair = pairs[passIndex];

  const rankedLeads = useMemo(
    () => rankLeads(bowls, areaSet.areas, filter),
    [bowls, areaSet.areas, filter],
  );
  const visibleBowls = useMemo(
    () => rankedLeads.filter((ranked) => ranked.matches).map((ranked) => ranked.lead),
    [rankedLeads],
  );
  const rankedAreas = useMemo(
    () => (priorityLayer ? rankAreas(areaSet.areas, priorityLayer, filter) : []),
    [areaSet.areas, priorityLayer, filter],
  );
  const areaCells = useMemo(() => {
    const values = priorityColorValues(rankedAreas, filter);
    return rankedAreas.map((ranked, index) => ({
      area: ranked.area,
      value: values[index],
      matches: ranked.matches,
    }));
  }, [rankedAreas, filter]);
  const selectedArea = rankedAreas.find((ranked) => ranked.area.id === selectedAreaId) ?? null;

  function setParams(updates: Record<string, string | null>) {
    const nextParams = new URLSearchParams(window.location.search);
    for (const [name, value] of Object.entries(updates)) {
      if (value === null) {
        nextParams.delete(name);
      } else {
        nextParams.set(name, value);
      }
    }
    window.history.replaceState(null, "", `${pathname}?${nextParams}`);
  }

  function setParam(name: string, value: string | null) {
    setParams({ [name]: value });
  }

  function changeFilter(nextFilter: Filter) {
    setParams(priorityFilterParams(nextFilter));
  }

  function selectArea(areaId: string | null) {
    setParam("area", areaId);
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
    const nextLayer = parseMapLayer(value);
    setParams({ show: nextLayer === "leads" ? null : nextLayer, area: null });
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
  const matchingAreas = rankedAreas.filter((ranked) => ranked.matches);
  const matchingLeads = rankedLeads.filter((ranked) => ranked.matches);
  const layerLabels = {
    leads: t.showLeads,
    recharge: t.showRecharge,
    pipe: t.showPipe,
    farming: t.showFarming,
    radar: t.showRadar,
  };

  function leadListValue(ranked: (typeof rankedLeads)[number]) {
    switch (filter.rankBy) {
      case "combined":
        return `−${dropMeters(ranked.lead, baselineYears, true).toFixed(2)} m`;
      case "sinking":
        return fill(t.priority.sinkingValue, { value: ranked.lead.rateAfterBanMmYr });
      case "population":
        return fill(t.priority.populationValue, {
          value: formatNumber(locale, ranked.area?.populationPerKm2 ?? 0),
        });
      case "economy":
        return t.priority.economyLevel[ranked.area?.economy ?? "low"];
    }
  }

  function listItems(): RankedListItem[] {
    if (priorityLayer) {
      return matchingAreas.slice(0, areaListLimit).map((ranked) => ({
        id: ranked.area.id,
        rank: ranked.rank ?? 0,
        name: ranked.area.kecamatan,
        detail: fill(t.priority.areaTitle, { id: ranked.area.id }),
        value: areaListValue(ranked, priorityLayer, filter, locale, t.priority),
      }));
    }
    return matchingLeads.map((ranked) => ({
      id: ranked.lead.id,
      rank: ranked.rank ?? 0,
      name: ranked.lead.name,
      detail: ranked.lead.kecamatan,
      value: leadListValue(ranked),
      href: `/${locale}/bowls/${ranked.lead.id}`,
    }));
  }

  function describeView() {
    if (priorityLayer) {
      const topArea = matchingAreas[0]?.area;
      return topArea
        ? fill(t.priority.summary, {
            kecamatan: topArea.kecamatan,
            id: topArea.id,
            count: matchingAreas.length,
          })
        : t.priority.noMatch;
    }
    if (isRadar) {
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
          value={layer}
          options={mapLayers.map((mapLayer) => ({ value: mapLayer, label: layerLabels[mapLayer] }))}
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
          {isLeads && <NisarCandidateLayer candidates={nisarCandidates} />}
          {isLeads && (
            <BowlLayer
              bowls={visibleBowls}
              years={baselineYears}
              withBan
              baselineYears={baselineYears}
              selectedBowlId={null}
              onSelect={openBowl}
              onDeselect={() => {}}
            />
          )}
          {priorityLayer && (
            <AreaLayer
              cells={areaCells}
              cellSizeM={areaSet.cellSizeM}
              selectedAreaId={selectedArea?.area.id ?? null}
              onSelect={selectArea}
            />
          )}
          {isRadar && <InterferogramLayer pair={pair} />}
          <MapCamera is2d={is2d} hasStartPosition={startPosition !== null} />
        </Map>
        <div
          className={cn(
            "absolute top-4 bottom-4 left-4 flex h-fit max-w-64 flex-col gap-2 overflow-y-auto rounded-4xl border border-transparent glass p-3 text-xs text-muted-foreground shadow-md",
            selectedArea && "max-md:hidden",
          )}
        >
          {isLeads && (
            <>
              <div className="h-2 rounded-full bg-linear-to-r from-rate-slow via-rate-middle to-rate-fast" />
              <div className="flex justify-between tabular-nums">
                <span>{slowRateMmYr} mm/yr</span>
                <span>{fastRateMmYr} mm/yr</span>
              </div>
              <p>{fill(t.rateLegend, { year: defaultYear })}</p>
              {nisarCandidates.length > 0 && (
                <p>
                  {fill(t.candidateLegend, {
                    count: nisarCandidates.length,
                    rate: Math.round(nisarCandidates[0].rateMmYr),
                    uncertainty: Math.round(nisarCandidates[0].uncertaintyMmYr),
                  })}
                </p>
              )}
            </>
          )}
          {priorityLayer && (
            <>
              <div className="h-2 rounded-full bg-linear-to-r from-rate-fast/10 to-rate-fast" />
              <div className="flex justify-between">
                <span>{t.priority.legendLow}</span>
                <span>{t.priority.legendHigh}</span>
              </div>
              <p>{t.priority.layerLegend[priorityLayer]}</p>
            </>
          )}
          {isRadar && (
            <>
              <div className="phase-cycle-legend h-2 rounded-full" />
              <p>{t.phaseLegend}</p>
            </>
          )}
          {!isRadar && (
            <PriorityFilter
              locale={locale}
              layer={priorityLayer}
              filter={filter}
              onChange={changeFilter}
              labels={t.priority}
            />
          )}
        </div>
        {!isRadar && !selectedArea && (
          <MapRankedList
            items={listItems()}
            title={priorityLayer ? t.priority.areaListTitle : t.listTitle}
            summary={fill(t.priority.matchCount, {
              count: priorityLayer ? matchingAreas.length : matchingLeads.length,
              total: priorityLayer ? rankedAreas.length : rankedLeads.length,
            })}
            emptyText={t.priority.noMatch}
            rankTemplate={t.rankLabel}
            showLabel={priorityLayer ? t.priority.showAreaList : t.showList}
            hideLabel={priorityLayer ? t.priority.hideAreaList : t.hideList}
            onSelect={selectArea}
          />
        )}
        {priorityLayer && selectedArea && (
          <AreaPanel
            key={selectedArea.area.id}
            locale={locale}
            layer={priorityLayer}
            rankedArea={selectedArea}
            cellSizeM={areaSet.cellSizeM}
            evidence={areaSet.evidence}
            isSynthetic={areaSet.synthetic}
            labels={labels}
            onClose={() => selectArea(null)}
          />
        )}
        {isRadar && (
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
