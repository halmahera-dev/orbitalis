"use client";

import { Button } from "@repo/ui/components/button";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  PauseIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export function usePlayback({
  value,
  min,
  max,
  unitsPerSecond,
  onFrame,
  onStop,
}: {
  value: number;
  min: number;
  max: number;
  unitsPerSecond: number;
  onFrame: (value: number) => void;
  onStop: (value: number) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const startRef = useRef({ value: min, time: 0, stepped: false });
  const showFrame = useEffectEvent(onFrame);
  const finish = useEffectEvent(onStop);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    let frameId = 0;
    function tick(now: number) {
      const start = startRef.current;
      const next = start.value + ((now - start.time) / 1000) * unitsPerSecond;
      if (next >= max) {
        setIsPlaying(false);
        finish(max);
        return;
      }
      showFrame(start.stepped ? Math.floor(next) : next);
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isPlaying, max, unitsPerSecond]);

  function play() {
    const startValue = value >= max ? min : value;
    const stepped = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    startRef.current = { value: startValue, time: performance.now(), stepped };
    onFrame(startValue);
    setIsPlaying(true);
  }

  function pause() {
    if (!isPlaying) {
      return;
    }
    setIsPlaying(false);
    onStop(value);
  }

  return { isPlaying, play, pause };
}

function PlaybackIcon({ icon, isVisible }: { icon: typeof PlayIcon; isVisible: boolean }) {
  return (
    <HugeiconsIcon
      icon={icon}
      strokeWidth={2}
      className={cn(
        "absolute transition duration-300",
        isVisible ? "opacity-100" : "opacity-0 motion-safe:scale-25 motion-safe:blur-xs",
      )}
    />
  );
}

export type TimelineBar = {
  key: string;
  label: string;
  height: number;
  dotHeight?: number;
  isProjected?: boolean;
  isUnderSea?: boolean;
  hasRadar?: boolean;
};

export type QuickPicks = {
  milestones: { index: number; label: string }[];
  previousLabel: string;
  nextLabel: string;
};

const minimumBarHeight = 0.06;

function percent(share: number) {
  return `${Math.max(share, minimumBarHeight) * 100}%`;
}

export function BarTimeline({
  label,
  bars,
  value,
  onChange,
  isPlaying,
  onTogglePlay,
  playLabel,
  pauseLabel,
  valueLabel,
  quickPicks,
  children,
  className,
  isTile = false,
}: {
  className?: string;
  isTile?: boolean;
  label: string;
  bars: TimelineBar[];
  value: number;
  onChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playLabel: string;
  pauseLabel: string;
  valueLabel: string;
  quickPicks?: QuickPicks;
  children?: ReactNode;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const lastIndex = bars.length - 1;
  const selectedIndex = Math.min(Math.max(Math.round(value), 0), lastIndex);

  function indexAt(clientX: number) {
    const rect = groupRef.current?.getBoundingClientRect();
    if (!rect) {
      return selectedIndex;
    }
    const share = (clientX - rect.left) / rect.width;
    return Math.min(Math.max(Math.floor(share * bars.length), 0), lastIndex);
  }

  function pick(index: number) {
    if (index !== selectedIndex || isPlaying) {
      onChange(index);
    }
  }

  function startScrub(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pick(indexAt(event.clientX));
  }

  function scrub(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      pick(indexAt(event.clientX));
    }
  }

  function step(event: KeyboardEvent<HTMLDivElement>) {
    const nextIndexByKey: Record<string, number> = {
      ArrowLeft: selectedIndex - 1,
      ArrowDown: selectedIndex - 1,
      ArrowRight: selectedIndex + 1,
      ArrowUp: selectedIndex + 1,
      Home: 0,
      End: lastIndex,
    };
    const nextIndex = nextIndexByKey[event.key];
    if (nextIndex === undefined) {
      return;
    }
    event.preventDefault();
    const clampedIndex = Math.min(Math.max(nextIndex, 0), lastIndex);
    pick(clampedIndex);
    const nextBar = groupRef.current?.children[clampedIndex];
    if (nextBar instanceof HTMLElement) {
      nextBar.focus();
    }
  }

  return (
    <div
      className={cn(
        isTile
          ? "flex flex-col gap-2 rounded-4xl border glass p-4"
          : "absolute inset-x-4 bottom-4 mx-auto flex max-w-xl fade-in flex-col gap-2 rounded-4xl border border-transparent glass p-3 shadow-md",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Button
          size={isTile ? "icon" : "icon-sm"}
          variant="neutral"
          aria-label={isPlaying ? pauseLabel : playLabel}
          onClick={onTogglePlay}
        >
          <PlaybackIcon icon={PlayIcon} isVisible={!isPlaying} />
          <PlaybackIcon icon={PauseIcon} isVisible={isPlaying} />
        </Button>
        <div
          ref={groupRef}
          role="radiogroup"
          aria-label={label}
          className={cn(
            "flex flex-1 cursor-pointer touch-none items-end gap-px select-none",
            quickPicks ? "h-10" : "h-12",
          )}
          onPointerDown={startScrub}
          onPointerMove={scrub}
          onKeyDown={step}
        >
          {bars.map((bar, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                key={bar.key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={bar.label}
                tabIndex={isSelected ? 0 : -1}
                className="group relative flex h-full flex-1 items-end rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <span
                  style={{ "--bar-height": percent(bar.height) } as CSSProperties}
                  className={cn(
                    "h-(--bar-height) w-full rounded-t-xs transition-colors duration-160 ease-out",
                    isSelected && "bg-brand",
                    !isSelected &&
                      bar.isProjected &&
                      "bg-muted-foreground/20 group-hover:bg-muted-foreground/40",
                    !isSelected &&
                      !bar.isProjected &&
                      "bg-muted-foreground/50 group-hover:bg-muted-foreground/70",
                  )}
                />
                {bar.hasRadar ? (
                  <span
                    style={{ "--bar-height": percent(bar.height) } as CSSProperties}
                    className="absolute inset-x-0 bottom-(--bar-height) mb-1.5 h-0.5 rounded-full bg-foreground/60"
                  />
                ) : null}
                {bar.isUnderSea ? (
                  <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-chart-2" />
                ) : null}
                {bar.dotHeight !== undefined ? (
                  <span
                    style={{ "--dot-height": percent(bar.dotHeight) } as CSSProperties}
                    className="absolute bottom-(--dot-height) left-1/2 size-1 -translate-x-1/2 translate-y-1/2 rounded-full bg-foreground"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        <span className="min-w-12 text-right type-title tabular-nums">{valueLabel}</span>
      </div>
      {quickPicks ? (
        <div className="flex items-center justify-between gap-3">
          <div className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1">
            {quickPicks.milestones.map((milestone) => (
              <Button
                key={milestone.index}
                size="xs"
                variant={milestone.index === selectedIndex ? "brand" : "ghost"}
                aria-pressed={milestone.index === selectedIndex}
                onClick={() => pick(milestone.index)}
              >
                {milestone.label}
              </Button>
            ))}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={quickPicks.previousLabel}
              disabled={selectedIndex === 0}
              onClick={() => pick(selectedIndex - 1)}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={quickPicks.nextLabel}
              disabled={selectedIndex === lastIndex}
              onClick={() => pick(selectedIndex + 1)}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
            </Button>
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}
