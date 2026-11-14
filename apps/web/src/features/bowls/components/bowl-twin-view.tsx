"use client";

import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Kbd, KbdGroup } from "@repo/ui/components/kbd";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { Toggle } from "@repo/ui/components/toggle";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Building03Icon,
  Calendar03Icon,
  ChartLineData01Icon,
  ClipboardIcon,
  CompassIcon,
  CubeIcon,
  CursorPointer01Icon,
  DrillIcon,
  FileSearchIcon,
  Grid02Icon,
  GridViewIcon,
  House01Icon,
  Layers01Icon,
  Layers02Icon,
  ListViewIcon,
  Location01Icon,
  Move01Icon,
  Navigation03Icon,
  Radar01Icon,
  RoadIcon,
  Rotate360Icon,
  RulerIcon,
  Scissor01Icon,
  ShieldCheckIcon,
  ShieldOffIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  Leaf01Icon,
  PaletteIcon,
  Tag01Icon,
  Target01Icon,
  WavesIcon,
  ZoomInAreaIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

import type { Bowl, BowlSeries } from "@/features/bowls/bowls-queries";
import type { SceneLayers } from "@/features/bowls/components/bowl-scene";

import {
  banYearOf,
  blockHalfSize,
  depthShareAt,
  firstYearBelow,
  sinkingBetweenMeters,
  soilLayers,
} from "@/features/bowls/bowl-shape";
import { BowlPlan } from "@/features/bowls/components/bowl-plan";
import { dropMeters, fastRateMmYr, middleRateMmYr, slowRateMmYr } from "@/features/map/bowl-rates";
import { BarTimeline, usePlayback } from "@/features/map/components/bar-timeline";
import { BowlDepthView } from "@/features/map/components/bowl-depth-view";
import { interferogramCatalog } from "@/features/nisar/nisar-catalog";
import { LanguageSwitch } from "@/features/shell/components/language-switch";
import { fill, formatDate, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const BowlScene = dynamic(
  () => import("@/features/bowls/components/bowl-scene").then((module) => module.BowlScene),
  { ssr: false, loading: () => <Skeleton className="size-full" /> },
);

const BowlChart = dynamic(
  () => import("@/features/bowls/components/bowl-chart").then((module) => module.BowlChart),
  { loading: () => <Skeleton className="h-44 w-full" /> },
);

const firstYear = 2015;
const currentYear = 2026;
const lastYear = 2050;
const radarPairs = interferogramCatalog.pairs;
const radarYear = Number(radarPairs[0].referenceDate.slice(0, 4));
const defaultYear = 2035;
const milestoneYears = [currentYear, 2030, 2035, 2040, 2050];
const yearsPerSecond = 3;
const exaggerations = [1, 100, 250];
const defaultExaggeration = 100;
const views = ["overview", "cutaway", "street", "plan"] as const;
const defaultView = "cutaway";
const parts = ["center", "edge", "house", "clay", "well", "sea", "radar", "block"] as const;
const insideParts: readonly string[] = ["clay", "well", "sea"];
const personHeightMeters = 1.7;
const layerToggles = [
  { id: "buildings", icon: Building03Icon },
  { id: "scenery", icon: Leaf01Icon },
  { id: "contours", icon: ChartLineData01Icon },
  { id: "banGrid", icon: Grid02Icon },
  { id: "rate", icon: PaletteIcon },
  { id: "sea", icon: WavesIcon },
  { id: "labels", icon: Tag01Icon },
] as const;
const guideSteps = [
  { id: "orbit", icon: Rotate360Icon, needs3d: true },
  { id: "zoom", icon: ZoomInAreaIcon, needs3d: true },
  { id: "pan", icon: Move01Icon, needs3d: true },
  { id: "pick", icon: CursorPointer01Icon, needs3d: false },
  { id: "year", icon: Calendar03Icon, needs3d: false },
] as const;

type Icon = typeof CubeIcon;
type View = (typeof views)[number];
type Part = (typeof parts)[number];

const viewIcons: Record<View, Icon> = {
  overview: CubeIcon,
  cutaway: Scissor01Icon,
  street: RoadIcon,
  plan: GridViewIcon,
};

const partIcons: Record<Part, Icon> = {
  center: Target01Icon,
  edge: Location01Icon,
  house: House01Icon,
  clay: Layers02Icon,
  well: DrillIcon,
  sea: WavesIcon,
  radar: Radar01Icon,
  block: CompassIcon,
};

function rateToken(rateMmYr: number) {
  if (rateMmYr >= (middleRateMmYr + fastRateMmYr) / 2) {
    return "--rate-fast";
  }
  return rateMmYr >= (slowRateMmYr + middleRateMmYr) / 2 ? "--rate-middle" : "--rate-slow";
}

function parsePart(value: string | null): Part {
  return parts.find((part) => part === value) ?? "center";
}

let webgl2Support: boolean | null = null;

function supportsWebgl2() {
  if (webgl2Support === null) {
    webgl2Support = Boolean(document.createElement("canvas").getContext("webgl2"));
  }
  return webgl2Support;
}

function subscribeToNothing() {
  return () => {};
}

function parseYear(value: string | null) {
  const year = Number(value);
  if (Number.isInteger(year) && year >= firstYear && year <= lastYear) {
    return year;
  }
  return defaultYear;
}

function parseView(value: string | null): View {
  return views.find((view) => view === value) ?? defaultView;
}

function parseExaggeration(value: string | null) {
  return (
    exaggerations.find((exaggeration) => String(exaggeration) === value) ?? defaultExaggeration
  );
}

function IconTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function IconSegmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; content: ReactNode; isDisabled?: boolean }[];
  onChange: (value: string) => void;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      size="sm"
      spacing={1}
      value={[value]}
      onValueChange={(next) => next[0] && onChange(next[0])}
    >
      {options.map((option) => (
        <Tooltip key={option.value}>
          <TooltipTrigger
            render={
              <ToggleGroupItem
                value={option.value}
                disabled={option.isDisabled}
                aria-label={option.label}
              />
            }
          >
            {option.content}
          </TooltipTrigger>
          <TooltipContent>{option.label}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}

function Tile({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-4xl border glass p-4", className)} {...props} />;
}

function StatTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <Tile className="flex flex-col justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="type-title text-2xl tabular-nums">
        {value}
        {unit ? (
          <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
        ) : null}
      </span>
    </Tile>
  );
}

function Row({
  label,
  value,
  isStrong = false,
}: {
  label: string;
  value: ReactNode;
  isStrong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={isStrong ? "font-medium tabular-nums" : "tabular-nums"}>{value}</dd>
    </div>
  );
}

export function BowlTwinView({
  locale,
  bowl,
  series,
  banDate,
  highTideM,
  bowlOptions,
  labels,
  actions,
  inspection,
}: {
  highTideM: number;
  bowlOptions: { id: string; name: string; rank: number }[];
  locale: Locale;
  bowl: Bowl;
  series: BowlSeries;
  banDate: string;
  labels: { map: Dictionary["map"]; bowls: Dictionary["bowls"]; common: Dictionary["common"] };
  actions: ReactNode;
  inspection: ReactNode;
}) {
  const t = labels.map;
  const twin = labels.bowls.twin;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canShow3d = useSyncExternalStore(subscribeToNothing, supportsWebgl2, () => true);
  const withBan = searchParams.get("ban") !== "off";
  const chosenView = parseView(searchParams.get("view"));
  const view = canShow3d ? chosenView : "plan";
  const exaggeration = parseExaggeration(searchParams.get("height"));
  const part = parsePart(searchParams.get("part"));
  const [year, setYear] = useState(() => parseYear(searchParams.get("year")));
  const [tab, setTab] = useState("parts");
  const tabsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [layers, setLayers] = useState<SceneLayers>({
    buildings: true,
    scenery: true,
    contours: true,
    banGrid: true,
    rate: true,
    sea: true,
    labels: true,
  });
  const otherBowls = bowlOptions
    .filter((option) => option.id !== bowl.id)
    .map((option) => ({ value: option.id, label: `${option.rank}. ${option.name}` }));

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    if (window.history.length > 1) {
      event.preventDefault();
      router.back();
    }
  }

  function showEvidence() {
    setTab("evidence");
    tabsRef.current?.scrollIntoView({ block: "nearest" });
  }
  const layerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [insets, setInsets] = useState({ top: 0, bottom: 0, left: 0, right: 0 });

  useEffect(() => {
    const layer = layerRef.current;
    const stage = stageRef.current;
    if (!layer || !stage) {
      return;
    }
    function measure() {
      if (!layer || !stage) {
        return;
      }
      const layerRect = layer.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const next = {
        top: Math.round(stageRect.top - layerRect.top),
        bottom: Math.round(layerRect.bottom - stageRect.bottom),
        left: Math.round(stageRect.left - layerRect.left),
        right: Math.round(layerRect.right - stageRect.right),
      };
      setInsets((previous) =>
        previous.top === next.top &&
        previous.bottom === next.bottom &&
        previous.left === next.left &&
        previous.right === next.right
          ? previous
          : next,
      );
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(layer);
    observer.observe(stage);
    return () => {
      observer.disconnect();
    };
  }, []);

  function setParam(name: string, value: string | null) {
    const nextParams = new URLSearchParams(window.location.search);
    if (value === null) {
      nextParams.delete(name);
    } else {
      nextParams.set(name, value);
    }
    window.history.replaceState(null, "", `${pathname}?${nextParams}`);
  }

  function commitYear(nextYear: number) {
    const wholeYear = Math.round(nextYear);
    setYear(wholeYear);
    setParam("year", String(wholeYear));
  }

  const playback = usePlayback({
    value: year,
    min: firstYear,
    max: lastYear,
    unitsPerSecond: yearsPerSecond,
    onFrame: setYear,
    onStop: commitYear,
  });

  function pickYear(index: number) {
    playback.pause();
    commitYear(firstYear + index);
  }

  function togglePlay() {
    if (playback.isPlaying) {
      playback.pause();
    } else {
      playback.play();
    }
  }

  const todayMeters = bowl.depthCm / 100;
  const banYear = banYearOf(banDate);

  function depthAt(atYear: number, isWithBan: boolean) {
    if (atYear >= currentYear) {
      return todayMeters + dropMeters(bowl, atYear - currentYear, isWithBan);
    }
    const rates = { beforeBanMmYr: bowl.rateBeforeBanMmYr, afterBanMmYr: bowl.rateAfterBanMmYr };
    const sinkingSoFar = sinkingBetweenMeters(rates, banYear, firstYear, atYear);
    const sinkingTotal = sinkingBetweenMeters(rates, banYear, firstYear, currentYear);
    return todayMeters * (sinkingSoFar / sinkingTotal);
  }

  const shownYear = Math.round(year);
  const isMeasuredYear = year < currentYear;
  const projectedMeters = depthAt(year, withBan);
  const drop = projectedMeters - todayMeters;
  const futureDrop = Math.max(drop, 0);
  const dropWithBan = Math.max(depthAt(year, true) - todayMeters, 0);
  const dropWithoutBan = Math.max(depthAt(year, false) - todayMeters, 0);
  const ghostDepthMeters = depthAt(year, !withBan);
  const hasGhost = Math.abs(ghostDepthMeters - projectedMeters) > 0.005;
  const rate = isMeasuredYear
    ? year < banYear
      ? bowl.rateBeforeBanMmYr
      : bowl.rateAfterBanMmYr
    : withBan
      ? bowl.rateAfterBanMmYr
      : bowl.rateBeforeBanMmYr;
  const rateChangePercent = Math.round((1 - bowl.rateAfterBanMmYr / bowl.rateBeforeBanMmYr) * 100);
  const centimeters = (meters: number) => Math.round(meters * 100);
  const hasMovedRank = bowl.previousRank !== null && bowl.previousRank !== bowl.rank;
  const mapReturn = `/${locale}/map?at=${bowl.center[0].toFixed(4)},${bowl.center[1].toFixed(4)},13.00`;
  const deepestMeters = depthAt(lastYear, false);
  const blockWidthMeters = blockHalfSize(bowl.radiusM) * 2;

  function floorAt(atYear: number, isWithBan: boolean) {
    return bowl.groundHeightM - (depthAt(atYear, isWithBan) - todayMeters);
  }

  const seaDepthMeters = Math.max(bowl.groundHeightM + todayMeters - highTideM, 0);
  const belowSeaWithBan = firstYearBelow(
    highTideM,
    (atYear) => floorAt(atYear, true),
    firstYear,
    lastYear,
  );
  const belowSeaWithoutBan = firstYearBelow(
    highTideM,
    (atYear) => floorAt(atYear, false),
    firstYear,
    lastYear,
  );
  const belowSea = withBan ? belowSeaWithBan : belowSeaWithoutBan;
  const sea = twin.sea;

  function belowSeaText(atYear: number | null) {
    if (atYear === null) {
      return fill(sea.never, { year: lastYear });
    }
    return atYear === firstYear ? sea.already : String(atYear);
  }

  function belowSeaSentence() {
    if (belowSea === null) {
      return fill(sea.neverSentence, { year: lastYear });
    }
    if (belowSea === firstYear) {
      return sea.alreadySentence;
    }
    return fill(belowSea < currentYear ? sea.pastSentence : sea.yearSentence, { year: belowSea });
  }

  const yearBars = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
    const barYear = firstYear + index;
    const withoutBan = depthAt(barYear, false);
    const withTheBan = depthAt(barYear, true);
    const isUnderSea = floorAt(barYear, withBan) <= highTideM;
    const hasRadar = barYear === radarYear;
    const yearLabel = fill(barYear < currentYear ? twin.yearBarMeasured : twin.yearBar, {
      year: barYear,
      without: withoutBan.toFixed(2),
      with: withTheBan.toFixed(2),
    });
    return {
      key: String(barYear),
      label: [yearLabel, hasRadar ? twin.radar.bar : "", isUnderSea ? sea.underSea : ""]
        .filter(Boolean)
        .join(". "),
      height: withoutBan / deepestMeters,
      dotHeight: withTheBan / deepestMeters,
      isProjected: barYear > currentYear,
      isUnderSea,
      hasRadar,
    };
  });

  function pickPart(nextPart: Part) {
    if (insideParts.includes(nextPart) && canShow3d && view !== "plan") {
      setParam("view", null);
    }
    setTab("parts");
    setParam("part", nextPart === "center" ? null : nextPart);
  }

  const softClaySqueeze = soilLayers.find((layer) => layer.id === "softClay")?.squeeze ?? 0;
  const clayChangeCm = -centimeters(drop * softClaySqueeze);

  function signed(text: string, value: number) {
    if (value > 0) {
      return `+${text}`;
    }
    return value < 0 ? `−${text.replace("-", "")}` : text;
  }

  function signedCm(meters: number) {
    const cm = centimeters(meters);
    return `${signed(String(Math.abs(cm)), cm)} cm`;
  }

  const radarStart = radarPairs[0].referenceDate;
  const radarEnd = radarPairs[radarPairs.length - 1].secondaryDate;
  const radarCleanShare = Math.round(
    (radarPairs.reduce((sum, pair) => sum + pair.cleanSignalShare, 0) / radarPairs.length) * 100,
  );

  const projectedCm = centimeters(projectedMeters);
  const edgeShare = depthShareAt(bowl.radiusM, bowl.radiusM);
  const edgeCm = centimeters(projectedMeters * edgeShare);
  const facts = twin.facts;
  const partCards: Record<
    Part,
    { key: string; body: string; facts: { label: string; value: string }[] }
  > = {
    center: {
      key: `${projectedCm} cm`,
      body: fill(twin.parts.center.body, { cm: projectedCm, year: shownYear }),
      facts: [
        { label: fill(facts.depthIn, { year: shownYear }), value: `${projectedCm} cm` },
        { label: facts.depthChange, value: `${signed(drop.toFixed(2), drop)} m` },
        { label: t.statRate, value: `${rate} mm/yr` },
      ],
    },
    edge: {
      key: `${edgeCm} cm`,
      body: fill(twin.parts.edge.body, {
        radius: bowl.radiusM,
        share: Math.round(edgeShare * 100),
      }),
      facts: [
        { label: facts.distance, value: `${bowl.radiusM} m` },
        { label: fill(facts.edgeDepth, { year: shownYear }), value: `${edgeCm} cm` },
        { label: facts.share, value: `${Math.round(edgeShare * 100)}%` },
      ],
    },
    house: {
      key: signedCm(-drop),
      body: fill(twin.parts.house.body, { change: signedCm(-drop), year: shownYear }),
      facts: [
        { label: facts.heightChange, value: signedCm(-drop) },
        { label: fill(facts.depthIn, { year: shownYear }), value: `${projectedCm} cm` },
        {
          label: facts.personHeights,
          value: (projectedMeters / personHeightMeters).toFixed(1),
        },
      ],
    },
    clay: {
      key: signedCm(clayChangeCm / 100),
      body: fill(twin.parts.clay.body, { share: Math.round(softClaySqueeze * 100) }),
      facts: [
        { label: facts.clayChange, value: signedCm(clayChangeCm / 100) },
        { label: facts.sinkingShare, value: `${Math.round(softClaySqueeze * 100)}%` },
        { label: facts.profile, value: twin.illustration },
      ],
    },
    well: {
      key: labels.bowls.statuses[bowl.status],
      body: twin.parts.well.body,
      facts: [
        { label: labels.bowls.status, value: labels.bowls.statuses[bowl.status] },
        { label: labels.bowls.nisar, value: `${bowl.rateAfterBanMmYr} mm/yr` },
        { label: t.rateChange, value: `−${rateChangePercent}%` },
      ],
    },
    radar: {
      key: String(radarPairs.length),
      body: fill(twin.parts.radar.body, { count: radarPairs.length, year: radarYear }),
      facts: [
        { label: facts.passes, value: String(radarPairs.length) },
        {
          label: facts.period,
          value: `${formatDate(locale, radarStart)} – ${formatDate(locale, radarEnd)}`,
        },
        { label: facts.cleanSignal, value: `${radarCleanShare}%` },
      ],
    },
    sea: {
      key: belowSeaText(belowSea),
      body: fill(twin.parts.sea.body, { tide: highTideM.toFixed(2) }),
      facts: [
        {
          label: fill(facts.floorHeight, { year: shownYear }),
          value: `${floorAt(year, withBan).toFixed(2)} m`,
        },
        { label: facts.highTide, value: `${highTideM.toFixed(2)} m` },
        { label: facts.belowSeaWithBan, value: belowSeaText(belowSeaWithBan) },
        { label: facts.belowSeaWithoutBan, value: belowSeaText(belowSeaWithoutBan) },
      ],
    },
    block: {
      key: `${Math.round(blockWidthMeters)} m`,
      body: fill(twin.parts.block.body, { exaggeration, cm: projectedCm }),
      facts: [
        { label: facts.width, value: `${Math.round(blockWidthMeters)} m` },
        { label: facts.radius, value: `${bowl.radiusM} m` },
        { label: twin.heightLabel, value: `×${exaggeration}` },
      ],
    },
  };
  const partCard = partCards[part];

  const summaryValues = { name: bowl.name, meters: futureDrop.toFixed(2), year: shownYear };
  let dropSummary = fill(twin.measuredSummary, {
    name: bowl.name,
    cm: projectedCm,
    year: shownYear,
  });
  if (!isMeasuredYear) {
    dropSummary = withBan
      ? fill(t.bowlSummary, summaryValues)
      : fill(t.noBanSummary, {
          ...summaryValues,
          extra: (dropWithoutBan - dropWithBan).toFixed(2),
        });
  }
  const radarSummary =
    shownYear === radarYear
      ? ` ${fill(twin.radar.summary, {
          count: radarPairs.length,
          start: formatDate(locale, radarStart),
          end: formatDate(locale, radarEnd),
        })}`
      : "";
  const summary = `${dropSummary} ${belowSeaSentence()}${radarSummary}`;

  const sceneLabel = fill(twin.sceneDescription, {
    name: bowl.name,
    width: Math.round(blockWidthMeters),
    exaggeration,
    cm: centimeters(projectedMeters),
    year: shownYear,
  });

  const evidence = [
    {
      summary: fill(t.evidenceDepth, { cm: bowl.depthCm }),
      body: fill(t.evidenceDepthBody, { radius: bowl.radiusM }),
    },
    {
      summary: fill(t.evidenceRate, {
        before: bowl.rateBeforeBanMmYr,
        after: bowl.rateAfterBanMmYr,
      }),
      body: fill(t.evidenceRateBody, { uncertainty: bowl.uncertaintyMmYr }),
    },
    {
      summary: fill(t.evidenceProjection, { year: shownYear, meters: futureDrop.toFixed(2) }),
      body: t.evidenceProjectionBody,
    },
  ];

  const viewSelector = (
    <IconSegmented
      label={twin.viewLabel}
      value={view}
      options={views.map((option) => ({
        value: option,
        label: twin.views[option],
        content: <HugeiconsIcon icon={viewIcons[option]} strokeWidth={2} />,
        isDisabled: !canShow3d && option !== "plan",
      }))}
      onChange={(next) => setParam("view", next === defaultView ? null : next)}
    />
  );
  const heightSelector = (
    <IconSegmented
      label={twin.heightLabel}
      value={String(exaggeration)}
      options={exaggerations.map((option) => ({
        value: String(option),
        label: `${twin.heightLabel} ×${option}`,
        content: `×${option}`,
      }))}
      onChange={(next) => setParam("height", next === String(defaultExaggeration) ? null : next)}
    />
  );
  const overlay = "pointer-events-auto rounded-4xl border border-transparent glass p-1";

  return (
    <TooltipProvider>
      <div
        style={{ "--scene-glow": `var(${rateToken(bowl.rateAfterBanMmYr)})` } as CSSProperties}
        className="scene-backdrop bento-grid isolate min-h-svh gap-4 p-4"
      >
        <div className="pointer-events-none relative order-2 flex min-h-0 flex-col gap-4 xl:order-none xl:col-start-1 xl:row-start-1">
          <div className="pointer-events-auto relative flex items-stretch gap-4">
            <Link
              href={mapReturn}
              onClick={goBack}
              className="flex shrink-0 pressable flex-col items-center justify-center gap-1.5 rounded-4xl border glass px-5 text-xs whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-5" />
              {t.back}
            </Link>
            <BarTimeline
              isTile
              className="min-w-0 flex-1"
              label={t.year}
              bars={yearBars}
              value={year - firstYear}
              onChange={pickYear}
              isPlaying={playback.isPlaying}
              onTogglePlay={togglePlay}
              playLabel={t.play}
              pauseLabel={t.pause}
              valueLabel={String(shownYear)}
              quickPicks={{
                milestones: milestoneYears.map((milestoneYear) => ({
                  index: milestoneYear - firstYear,
                  label: milestoneYear === currentYear ? t.today : String(milestoneYear),
                })),
                previousLabel: t.previousYear,
                nextLabel: t.nextYear,
              }}
            />
          </div>

          <div
            ref={stageRef}
            className="pointer-events-none relative h-96 min-h-0 xl:h-auto xl:flex-1"
          >
            <div
              ref={layerRef}
              className="pointer-events-auto absolute inset-0 -z-10 overflow-hidden rounded-4xl border bg-card xl:fixed xl:rounded-none xl:border-0 xl:bg-transparent"
            >
              {view === "plan" ? (
                <BowlPlan
                  radiusM={bowl.radiusM}
                  depthMeters={projectedMeters}
                  label={fill(twin.planDescription, {
                    name: bowl.name,
                    count: Math.floor(projectedMeters / 0.1),
                    year: shownYear,
                  })}
                  scaleLabel={twin.scaleBar}
                  part={part}
                  seaDepthMeters={seaDepthMeters}
                  insets={insets}
                />
              ) : (
                <BowlScene
                  bowl={bowl}
                  depthMeters={projectedMeters}
                  exaggeration={exaggeration}
                  view={view}
                  part={part}
                  onPick={pickPart}
                  deepestDepthMeters={deepestMeters}
                  seaDepthMeters={seaDepthMeters}
                  ghostDepthMeters={hasGhost ? ghostDepthMeters : null}
                  isRadarYear={shownYear === radarYear}
                  label={sceneLabel}
                  insets={insets}
                  layers={layers}
                  labels={{
                    layers: twin.layers,
                    well: twin.wellLabel,
                    pressure: twin.pressureLabel,
                    highTide: sea.highTideLabel,
                  }}
                />
              )}
            </div>
            <div className={cn(overlay, "absolute top-3 right-3 flex items-center gap-1 xl:top-0 xl:right-0")}>
              <IconSegmented
                label={t.banScenario}
                value={withBan ? "with" : "without"}
                options={[
                  {
                    value: "with",
                    label: twin.withBan,
                    content: <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} />,
                  },
                  {
                    value: "without",
                    label: twin.withoutBan,
                    content: <HugeiconsIcon icon={ShieldOffIcon} strokeWidth={2} />,
                  },
                ]}
                onChange={(next) => setParam("ban", next === "with" ? null : "off")}
              />
            </div>
          </div>

          <Tile className="pointer-events-auto relative flex flex-col gap-3">
            <p className="sr-only" aria-live={playback.isPlaying ? "off" : "polite"}>
              {summary} {view !== "plan" ? fill(twin.heightNote, { exaggeration }) : null}
            </p>
            <Tabs defaultValue="controls">
              <TabsList>
                <TabsTrigger value="controls">
                  <HugeiconsIcon icon={SlidersHorizontalIcon} strokeWidth={2} />
                  {twin.guide.controlsTab}
                </TabsTrigger>
                <TabsTrigger value="navigate">
                  <HugeiconsIcon icon={Navigation03Icon} strokeWidth={2} />
                  {twin.guide.navigateTab}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="controls">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3 pt-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">{twin.viewLabel}</span>
                    {viewSelector}
                  </div>
                  {view !== "plan" ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-muted-foreground">{twin.heightLabel}</span>
                      {heightSelector}
                    </div>
                  ) : null}
                  {view !== "plan" ? (
                    <div className="flex max-w-full flex-col gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        {twin.layerToggles.title}
                      </span>
                      <div
                        role="group"
                        aria-label={twin.layerToggles.title}
                        className="flex flex-wrap gap-1"
                      >
                        {layerToggles.map((layer) => (
                          <IconTip key={layer.id} label={twin.layerToggles[layer.id]}>
                            <Toggle
                              variant="outline"
                              size="sm"
                              aria-label={twin.layerToggles[layer.id]}
                              pressed={layers[layer.id]}
                              onPressedChange={(pressed) =>
                                setLayers((current) => ({ ...current, [layer.id]: pressed }))
                              }
                            >
                              <HugeiconsIcon icon={layer.icon} strokeWidth={2} />
                            </Toggle>
                          </IconTip>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </TabsContent>
              <TabsContent value="navigate">
                <ol className="grid grid-cols-2 gap-3 pt-2 md:grid-cols-3 xl:grid-cols-5">
                  {guideSteps
                    .filter((step) => !step.needs3d || view !== "plan")
                    .map((step) => (
                      <li key={step.id} className="flex items-start gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <HugeiconsIcon icon={step.icon} strokeWidth={2} className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-col text-xs text-muted-foreground">
                          <span className="text-sm font-medium text-foreground">
                            {twin.guide[step.id].title}
                          </span>
                          {twin.guide[step.id].body}
                          {step.id === "year" ? (
                            <KbdGroup className="mt-1">
                              <Kbd>
                                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                              </Kbd>
                              <Kbd>
                                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                              </Kbd>
                            </KbdGroup>
                          ) : null}
                        </span>
                      </li>
                    ))}
                </ol>
              </TabsContent>
            </Tabs>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <HugeiconsIcon
                  icon={ShieldCheckIcon}
                  strokeWidth={2}
                  className="size-4 text-brand"
                />
                {twin.legend.ban}
              </li>
              <li className="flex items-center gap-1.5">
                <HugeiconsIcon icon={WavesIcon} strokeWidth={2} className="size-4 text-chart-2" />
                {twin.legend.sea}
              </li>
              <li className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Radar01Icon} strokeWidth={2} className="size-4" />
                {twin.legend.radar}
              </li>
              {view !== "plan" ? (
                <li className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={RulerIcon} strokeWidth={2} className="size-4" />
                  {fill(twin.heightNote, { exaggeration })}
                </li>
              ) : null}
            </ul>
          </Tile>
        </div>

        <div className="contents xl:col-start-2 xl:row-start-1 xl:-my-4 xl:-mr-4 xl:flex xl:min-h-0 xl:flex-col xl:gap-4 xl:overflow-y-auto xl:overscroll-contain xl:py-4 xl:pr-4">
          <header className="order-1 flex flex-col gap-2 rounded-4xl border glass p-4 xl:order-none">
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="type-title">{bowl.name}</h1>
                  <Badge variant="secondary">{labels.bowls.statuses[bowl.status]}</Badge>
                </div>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <span className="truncate">
                    {bowl.kecamatan}, {fill(t.rankLabel, { rank: bowl.rank }).toLowerCase()}
                  </span>
                  {hasMovedRank ? (
                    <IconTip label={fill(t.rankWas, { rank: bowl.previousRank ?? "" })}>
                      <HugeiconsIcon
                        icon={
                          bowl.rank < (bowl.previousRank ?? bowl.rank)
                            ? ArrowUp01Icon
                            : ArrowDown01Icon
                        }
                        strokeWidth={2}
                        className="size-4"
                      />
                      <span className="sr-only">
                        {fill(t.rankWas, { rank: bowl.previousRank ?? "" })}
                      </span>
                    </IconTip>
                  ) : null}
                </p>
              </div>
              <LanguageSwitch locale={locale} label={labels.common.switchLanguage} />
              <DropdownMenu>
                <IconTip label={twin.jumpToBowl}>
                  <DropdownMenuTrigger
                    render={<Button variant="outline" size="icon" aria-label={twin.jumpToBowl} />}
                  >
                    <HugeiconsIcon icon={ListViewIcon} strokeWidth={2} />
                  </DropdownMenuTrigger>
                </IconTip>
                <DropdownMenuContent align="end">
                  {otherBowls.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      render={
                        <Link replace prefetch={false} href={`/${locale}/bowls/${option.value}`} />
                      }
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {bowl.status === "scheduled" && bowl.assignee && bowl.visitDate ? (
              <p className="text-sm text-muted-foreground">
                {fill(labels.bowls.assignedTo, {
                  assignee: bowl.assignee,
                  date: formatDate(locale, bowl.visitDate),
                })}
              </p>
            ) : null}
            {actions}
            <Alert>
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
              <AlertDescription>{labels.common.leadLabel}</AlertDescription>
            </Alert>
          </header>

          <div className="order-3 flex flex-col gap-4 xl:order-none">
            <div className="grid auto-rows-fr grid-cols-2 gap-4">
              <StatTile
                label={fill(facts.depthIn, { year: shownYear })}
                value={String(projectedCm)}
                unit="cm"
              />
              <StatTile
                label={facts.depthChange}
                value={`${signed(drop.toFixed(2), drop)}`}
                unit="m"
              />
              <StatTile label={t.statRate} value={String(rate)} unit="mm/yr" />
              <StatTile label={sea.tile} value={belowSeaText(belowSea)} />
            </div>

            <div className="flex flex-col gap-3 insight-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} className="size-4" />
                <span className="flex-1">{twin.insightTitle}</span>
                <IconTip label={twin.insightEvidence}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={twin.insightEvidence}
                    onClick={showEvidence}
                  >
                    <HugeiconsIcon icon={FileSearchIcon} strokeWidth={2} />
                  </Button>
                </IconTip>
              </div>
              <p className="type-title text-xl text-muted-foreground">
                {fill(twin.insight, {
                  saved: (dropWithoutBan - dropWithBan).toFixed(2),
                  year: shownYear,
                  rate,
                  drop: drop.toFixed(2),
                })
                  .split("**")
                  .map((part, index) =>
                    index % 2 === 1 ? (
                      <strong key={part} className="font-semibold text-foreground">
                        {part}
                      </strong>
                    ) : (
                      part
                    ),
                  )}
              </p>
            </div>

            <Tile className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <IconTip label={t.compareSaved}>
                  <span className="flex size-8 items-center justify-center rounded-full bg-brand/12 text-brand-text">
                    <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} className="size-4" />
                    <span className="sr-only">{t.compareSaved}</span>
                  </span>
                </IconTip>
                <span className="type-title text-2xl tabular-nums">
                  {(dropWithoutBan - dropWithBan).toFixed(2)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">m</span>
                </span>
              </div>
              <dl className="flex flex-col divide-y">
                <Row label={t.compareWith} value={`${dropWithBan.toFixed(2)} m`} />
                <Row label={t.compareWithout} value={`${dropWithoutBan.toFixed(2)} m`} />
              </dl>
              <p className="text-xs text-muted-foreground">{t.predictionNote}</p>
            </Tile>

            <Tile ref={tabsRef}>
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="w-full">
                  {[
                    { value: "parts", label: twin.partsTitle, icon: Layers01Icon },
                    {
                      value: "inspection",
                      label: labels.bowls.inspectionTitle,
                      icon: ClipboardIcon,
                    },
                    { value: "evidence", label: t.evidenceTitle, icon: FileSearchIcon },
                  ].map((item) => (
                    <Tooltip key={item.value}>
                      <TooltipTrigger
                        render={<TabsTrigger value={item.value} aria-label={item.label} />}
                      >
                        <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                      </TooltipTrigger>
                      <TooltipContent>{item.label}</TooltipContent>
                    </Tooltip>
                  ))}
                </TabsList>

                <TabsContent value="parts">
                  <div className="flex flex-col gap-3 pt-2">
                    <ul className="-mx-2 flex flex-col">
                      {parts.map((option) => {
                        const isPicked = option === part;
                        return (
                          <li key={option}>
                            <button
                              type="button"
                              aria-pressed={isPicked}
                              className={cn(
                                "flex w-full pressable items-center gap-3 rounded-3xl px-2 py-1.5 text-left text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40",
                                isPicked && "bg-brand/12 text-brand-text hover:bg-brand/12",
                              )}
                              onClick={() => pickPart(option)}
                            >
                              <HugeiconsIcon
                                icon={partIcons[option]}
                                strokeWidth={2}
                                className="size-4 shrink-0"
                              />
                              <span className="flex-1">{twin.parts[option].name}</span>
                              <span className="text-muted-foreground tabular-nums">
                                {partCards[option].key}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <section
                      key={part}
                      className="flex swap-in flex-col gap-1 rounded-2xl bg-muted p-3"
                    >
                      <p className="text-sm text-muted-foreground">{partCard.body}</p>
                      <dl className="flex flex-col divide-y">
                        {partCard.facts.map((fact) => (
                          <Row key={fact.label} label={fact.label} value={fact.value} />
                        ))}
                      </dl>
                    </section>
                  </div>
                </TabsContent>

                <TabsContent value="inspection">
                  <div className="flex flex-col gap-3 pt-2">{inspection}</div>
                </TabsContent>

                <TabsContent value="evidence">
                  <div className="flex flex-col gap-2 pt-2">
                    <p className="text-sm text-muted-foreground">{t.evidenceExample}</p>
                    {evidence.map((item) => (
                      <details
                        key={item.summary}
                        className="group details-reveal border-t py-2 text-sm first:border-t-0"
                      >
                        <summary className="cursor-pointer list-none text-muted-foreground tabular-nums transition-colors group-open:text-foreground hover:text-foreground">
                          {item.summary}
                        </summary>
                        <p className="pt-2 text-muted-foreground">{item.body}</p>
                      </details>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </Tile>

            <Tile className="flex flex-col gap-2">
              <BowlDepthView
                todayMeters={todayMeters}
                projectedMeters={projectedMeters}
                description={fill(t.depthDescription, {
                  name: bowl.name,
                  today: centimeters(todayMeters),
                  projected: centimeters(projectedMeters),
                  year: shownYear,
                })}
                todayLabel={fill(t.depthToday, { cm: centimeters(todayMeters) })}
                projectedLabel={fill(t.depthProjected, {
                  year: shownYear,
                  cm: centimeters(projectedMeters),
                })}
                depthLabel={`${centimeters(projectedMeters)} cm`}
              />
            </Tile>

            <Tile className="flex flex-col gap-2">
              <BowlChart
                series={series}
                banDate={banDate}
                labels={{
                  sentinel: labels.bowls.sentinel,
                  nisar: labels.bowls.nisar,
                  banLine: labels.bowls.banLine,
                }}
              />
              <dl className="flex flex-col divide-y">
                <Row label={labels.bowls.sentinel} value={`${bowl.rateBeforeBanMmYr} mm/yr`} />
                <Row
                  label={labels.bowls.nisar}
                  value={`${bowl.rateAfterBanMmYr} ± ${bowl.uncertaintyMmYr} mm/yr`}
                />
                <Row label={t.rateChange} value={`−${rateChangePercent}%`} isStrong />
              </dl>
            </Tile>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
