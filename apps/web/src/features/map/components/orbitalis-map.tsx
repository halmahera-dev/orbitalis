"use client";

import {
  DropletsIcon,
  Flag01Icon,
  PipelineIcon,
  Radar01Icon,
  Target01Icon,
  WaterfallDown01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Switch } from "@repo/ui/components/switch";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { Bowl, Cell } from "@/features/bowls/bowls-queries";
import type { PlanEntry } from "@/features/plans/plan-scores";

import { AppLogo } from "@/components/app-logo";
import { Map, useMap } from "@/components/ui/map";
import { BowlActions, type BowlActionLabels } from "@/features/bowls/components/bowl-actions";
import { isFarmingSite } from "@/features/bowls/visit";
import { slowRateMmYr } from "@/features/map/bowl-rates";
import { BarTimeline, usePlayback } from "@/features/map/components/bar-timeline";
import { BowlLayer } from "@/features/map/components/bowl-layer";
import { CellLayer, type CellScale } from "@/features/map/components/cell-layer";
import { CellRankPanel } from "@/features/map/components/cell-rank-panel";
import { BowlPanel, CellPanel } from "@/features/map/components/map-panels";
import { SiteLayer } from "@/features/map/components/site-layer";
import {
  TriagePanel,
  triageStatuses,
  type TriageStatus,
} from "@/features/map/components/triage-panel";
import { WaterEffectChart } from "@/features/map/components/water-effect-chart";
import {
  mapLayers,
  parseMapLayer,
  parseTriageSort,
  type MapLayer,
} from "@/features/map/map-layers";
import { waterEffect } from "@/features/map/water-effect";
import { BuildingsLayer, InterferogramLayer } from "@/features/nisar/components/nisar-layers";
import { interferogramCatalog } from "@/features/nisar/nisar-catalog";
import { LanguageSwitch } from "@/features/shell/components/language-switch";
import { fill, formatDate, formatNumber, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const globe = { type: "globe" } as const;
const passesPerSecond = 1.25;
const maxPitch = 75;
const positionWriteDelayMs = 300;
const metersPerDegree = 111_320;

const layerIcons: Record<MapLayer, typeof Target01Icon> = {
  leads: Target01Icon,
  sinking: WaterfallDown01Icon,
  people: PipelineIcon,
  farming: DropletsIcon,
  radar: Radar01Icon,
};

const siteSorts = ["rate", "people"] as const;

const cellScales: Record<"sinking" | "people", CellScale> = {
  sinking: { kind: "sinking", stops: [0, 30, 60] },
  people: { kind: "people", stops: [0, 20_000, 40_000] },
};

type Position = { center: [number, number]; zoom: number };

const overviewCamera = {
  center: [106.82, -6.22] as [number, number],
  zoom: 10.6,
  pitch: 45,
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

function parseTriageStatus(value: string | null): TriageStatus {
  return triageStatuses.find((status) => status === value) ?? "lead";
}

function parsePassIndex(value: string | null, passCount: number) {
  const index = Number(value);
  if (value !== null && Number.isInteger(index) && index >= 0 && index < passCount) {
    return index;
  }
  return passCount - 1;
}

function distanceKm([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]) {
  const east = (lon2 - lon1) * metersPerDegree * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const north = (lat2 - lat1) * metersPerDegree;
  return Math.hypot(east, north) / 1000;
}

function MapCamera({
  is2d,
  hasStartPosition,
  focus,
}: {
  is2d: boolean;
  hasStartPosition: boolean;
  focus: [number, number] | null;
}) {
  const { map, isLoaded } = useMap();
  const hasFlownRef = useRef(false);
  const isFirstPitchRef = useRef(true);
  const focusLongitude = focus?.[0];
  const focusLatitude = focus?.[1];

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

  useEffect(() => {
    if (!map || !isLoaded || focusLongitude === undefined || focusLatitude === undefined) {
      return;
    }
    const camera = {
      center: [focusLongitude, focusLatitude] as [number, number],
      zoom: Math.max(map.getZoom(), 13.5),
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      map.jumpTo(camera);
      return;
    }
    map.easeTo({ ...camera, duration: 800 });
  }, [map, isLoaded, focusLongitude, focusLatitude]);

  return null;
}

function GradientLegend({
  className,
  low,
  high,
  unit,
}: {
  className: string;
  low: string;
  high: string;
  unit: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("h-2 rounded-full", className)} />
      <div className="flex justify-between tabular-nums">
        <span>{low}</span>
        <span>{unit}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function MapLegend({
  layer,
  locale,
  labels,
  children,
}: {
  layer: MapLayer;
  locale: Locale;
  labels: { map: Dictionary["map"]; common: Dictionary["common"] };
  children?: ReactNode;
}) {
  const t = labels.map;
  return (
    <div className="absolute top-4 left-4 flex w-56 flex-col gap-2 rounded-3xl border border-transparent glass p-3 text-xs text-muted-foreground shadow-md max-md:hidden">
      {layer === "leads" || layer === "sinking" ? (
        <GradientLegend
          className="bg-linear-to-r from-rate-slow via-rate-middle to-rate-fast"
          low={layer === "leads" ? "20" : "0"}
          high={layer === "leads" ? "100+" : "60+"}
          unit={labels.common.mmPerYear}
        />
      ) : null}
      {layer === "people" ? (
        <GradientLegend
          className="bg-linear-to-r from-chart-5/20 to-chart-2"
          low="0"
          high={formatNumber(locale, 40_000)}
          unit={t.unitPeople}
        />
      ) : null}
      {layer === "radar" ? (
        <GradientLegend className="phase-cycle-legend" low="0" high="12 cm" unit={t.legend.cycle} />
      ) : null}
      {layer === "leads" ? (
        <ul className="flex flex-col gap-1">
          <li className="flex items-center gap-2">
            <span className="w-4 text-center">1×</span>
            {t.legend.oneTrack}
          </li>
          <li className="flex items-center gap-2">
            <HugeiconsIcon icon={Flag01Icon} strokeWidth={2} className="size-4" />
            {t.legend.manual}
          </li>
        </ul>
      ) : null}
      {layer === "farming" ? (
        <ul className="flex flex-col gap-1">
          <li className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-chart-5" />
            {t.farming.legendSite}
          </li>
          <li className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-rate-fast" />
            {t.farming.legendNeedsVisit}
          </li>
        </ul>
      ) : null}
      {layer === "sinking" ? <p>{t.relativeNote}</p> : null}
      {children}
    </div>
  );
}

export function OrbitalisMap({
  locale,
  bowls,
  cells,
  cellSizeM,
  planEntries,
  inspectors,
  labels,
}: {
  locale: Locale;
  bowls: Bowl[];
  cells: Cell[];
  cellSizeM: number;
  planEntries: PlanEntry[];
  inspectors: string[];
  labels: {
    map: Dictionary["map"];
    common: Dictionary["common"];
    statuses: Dictionary["bowls"]["statuses"];
    actions: BowlActionLabels;
  };
}) {
  const t = labels.map;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pairs = interferogramCatalog.pairs;
  const positionTimerRef = useRef(0);

  const layer = parseMapLayer(searchParams.get("show"));
  const isLeads = layer === "leads";
  const isFarming = layer === "farming";
  const isRadar = layer === "radar";
  const cellLayer = layer === "sinking" || layer === "people" ? layer : null;
  const is2d = searchParams.get("view") === "2d";
  const triageStatus = parseTriageStatus(searchParams.get("status"));
  const triageSort = parseTriageSort(searchParams.get("sort"));
  const [startPosition] = useState(() => parsePosition(searchParams.get("at")));
  const [passIndex, setPassIndex] = useState(() =>
    parsePassIndex(searchParams.get("pass"), pairs.length),
  );
  const pair = pairs[passIndex];

  const leads = bowls.filter((bowl) => !isFarmingSite(bowl));
  const sites = bowls.filter(isFarmingSite);
  const layerBowls = isLeads ? leads : isFarming ? sites : [];
  const selectedBowl = layerBowls.find((bowl) => bowl.id === searchParams.get("lead")) ?? null;
  const selectedCell = cellLayer
    ? (cells.find((cell) => cell.id === searchParams.get("cell")) ?? null)
    : null;
  const planKind = layer === "people" ? "pipe" : "recharge";
  const selectedPlan = selectedCell
    ? (planEntries.find((entry) => entry.cellId === selectedCell.id && entry.kind === planKind) ??
      null)
    : null;
  const nearestLead = selectedCell
    ? (leads
        .map((bowl) => ({ bowl, distanceKm: distanceKm(bowl.center, selectedCell.center) }))
        .toSorted((a, b) => a.distanceKm - b.distanceKm)[0] ?? null)
    : null;
  const visibleLeads = leads.filter((bowl) => bowl.status !== "dismissed");
  const mapSites = sites
    .filter((site) => site.status !== "dismissed")
    .map((site) => ({
      ...site,
      needsVisit:
        site.outcome === "measures_failing" ||
        (site.status === "lead" && (site.rateMmYr ?? 0) >= slowRateMmYr),
    }));
  const effect = useMemo(() => waterEffect(cells, bowls.filter(isFarmingSite)), [cells, bowls]);
  const selectedSite = isFarming ? selectedBowl : null;
  const hasPanel = selectedSite !== null || selectedCell !== null;

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

  function openBowl(bowlId: string) {
    router.push(`/${locale}/bowls/${bowlId}`);
  }

  function rememberPosition(position: Position) {
    window.clearTimeout(positionTimerRef.current);
    positionTimerRef.current = window.setTimeout(() => {
      setParam("at", formatPosition(position));
    }, positionWriteDelayMs);
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

  function changeLayer(value: string) {
    playback.pause();
    const nextLayer = parseMapLayer(value);
    setParams({ show: nextLayer === "leads" ? null : nextLayer, cell: null, lead: null });
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

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
        <Link href={`/${locale}/landing`} className="flex items-center gap-2 text-sm font-medium">
          <AppLogo />
          ORBITALIS
        </Link>
        <ToggleGroup
          aria-label={t.show}
          size="sm"
          spacing={1}
          value={[layer]}
          onValueChange={(next) => next[0] && changeLayer(next[0])}
        >
          {mapLayers.map((option) => (
            <Tooltip key={option}>
              <TooltipTrigger
                render={<ToggleGroupItem value={option} aria-label={t.layers[option]} />}
              >
                <HugeiconsIcon icon={layerIcons[option]} strokeWidth={2} />
                <span className="hidden lg:inline">{t.layers[option]}</span>
              </TooltipTrigger>
              <TooltipContent className="lg:hidden">{t.layers[option]}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
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
          {isLeads && (
            <BowlLayer
              bowls={visibleLeads}
              selectedBowlId={selectedBowl?.id ?? null}
              onSelect={openBowl}
              onDeselect={() => setParam("lead", null)}
            />
          )}
          {cellLayer && (
            <CellLayer
              cells={cells}
              cellSizeM={cellSizeM}
              scale={cellScales[cellLayer]}
              selectedCellId={selectedCell?.id ?? null}
              onSelect={(cellId) => setParam("cell", cellId)}
            />
          )}
          {isFarming && (
            <SiteLayer
              sites={mapSites}
              selectedId={selectedBowl?.id ?? null}
              onSelect={(siteId) => setParam("lead", siteId)}
            />
          )}
          {isRadar && <InterferogramLayer pair={pair} />}
          <MapCamera
            is2d={is2d}
            hasStartPosition={startPosition !== null}
            focus={selectedBowl?.center ?? null}
          />
        </Map>

        <MapLegend layer={layer} locale={locale} labels={labels}>
          {isFarming && effect ? (
            <WaterEffectChart
              effect={effect}
              locale={locale}
              labels={t.farming.effect}
              unit={labels.common.mmPerYear}
            />
          ) : null}
        </MapLegend>

        {isLeads && !hasPanel && (
          <TriagePanel
            locale={locale}
            bowls={leads}
            status={triageStatus}
            sort={triageSort}
            selectedId={selectedBowl?.id ?? null}
            onStatusChange={(status) => setParam("status", status === "lead" ? null : status)}
            onSortChange={(sort) => setParam("sort", sort === "signal" ? null : sort)}
            onSelect={openBowl}
            labels={labels}
          />
        )}
        {isFarming && !hasPanel && (
          <TriagePanel
            locale={locale}
            bowls={sites}
            status={triageStatus}
            sort={triageSort}
            sorts={siteSorts}
            selectedId={null}
            onStatusChange={(status) => setParam("status", status === "lead" ? null : status)}
            onSortChange={(sort) => setParam("sort", sort)}
            onSelect={(siteId) => setParam("lead", siteId)}
            labels={{ map: t, statuses: t.farming.statuses }}
          />
        )}
        {cellLayer && !hasPanel && (
          <CellRankPanel
            locale={locale}
            kind={planKind}
            cells={cells}
            entries={planEntries}
            onSelect={(cellId) => setParam("cell", cellId)}
            labels={labels}
          />
        )}
        {selectedSite && (
          <BowlPanel
            key={selectedSite.id}
            locale={locale}
            bowl={selectedSite}
            labels={labels}
            onClose={() => setParam("lead", null)}
            actions={
              <BowlActions
                bowl={selectedSite}
                status={selectedSite.status}
                labels={labels.actions}
                inspectors={inspectors}
              />
            }
          />
        )}
        {selectedCell && (
          <CellPanel
            key={selectedCell.id}
            locale={locale}
            cell={selectedCell}
            cellSizeM={cellSizeM}
            nearestLead={nearestLead}
            labels={labels}
            onClose={() => setParam("cell", null)}
            onSelectBowl={openBowl}
            planKind={planKind}
            planStatus={selectedPlan?.status ?? null}
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
              {formatDate(locale, pair.referenceDate)} – {formatDate(locale, pair.secondaryDate)}
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
