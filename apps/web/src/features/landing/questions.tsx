import {
  ChartDownIcon,
  ClipboardIcon,
  DropletIcon,
  Edit02Icon,
  FileSearchIcon,
  GasPipeIcon,
  Home01Icon,
  InformationCircleIcon,
  KeyboardIcon,
  Layers01Icon,
  Link01Icon,
  Location01Icon,
  MapPinIcon,
  SatelliteIcon,
  Search01Icon,
  SortByDown01Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@repo/ui/lib/utils";
import { Fragment } from "react";

import type { Dictionary } from "@/lib/i18n";

import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/features/landing/components/section-heading";
import {
  AreaCheckFigure,
  ParcelFigure,
  PipesFigure,
  PumpsFigure,
  RechargeFigure,
  WaterFarmingFigure,
} from "@/features/landing/figures/question-figures";

const figures = [
  PumpsFigure,
  RechargeFigure,
  PipesFigure,
  WaterFarmingFigure,
  ParcelFigure,
  AreaCheckFigure,
] as const;

const stepIcons = [
  [SatelliteIcon, SortByDown01Icon, ClipboardIcon],
  [ChartDownIcon, Layers01Icon, Search01Icon],
  [UserMultipleIcon, DropletIcon, GasPipeIcon],
  [Location01Icon, SatelliteIcon, ChartDownIcon],
  [Edit02Icon, FileSearchIcon, Link01Icon],
  [KeyboardIcon, MapPinIcon, Home01Icon],
] as const;

export function Questions({ t }: { t: Dictionary["landing"] }) {
  return (
    <section id="questions" className="scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <SectionHeading title={t.questions.title} isSplit>
          {t.questions.lead}
        </SectionHeading>

        <ol className="relative mt-16">
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-4 w-px bg-linear-to-b from-brand via-border to-transparent lg:left-1/2"
          />
          {t.questions.items.map((item, index) => {
            const Figure = figures[index];
            const icons = stepIcons[index];
            const isFlipped = index % 2 === 1;
            return (
              <Reveal
                as="li"
                key={item.question}
                className="relative grid items-center gap-8 py-10 pl-12 lg:grid-cols-2 lg:gap-x-28 lg:py-16 lg:pl-0"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-10 left-4 grid size-9 -translate-x-1/2 place-items-center rounded-full border border-brand/50 bg-background type-label-mono text-brand lg:top-1/2 lg:left-1/2 lg:-translate-y-1/2"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className={cn("relative", isFlipped && "lg:order-last")}>
                  <Figure label={item.figure} />
                </div>
                <div className="grid content-center gap-5">
                  <p className="type-label-mono text-muted-foreground">{item.team}</p>
                  <h3 className="type-title text-balance lg:text-3xl lg:leading-tight">
                    {item.question}
                  </h3>
                  <p className="max-w-md text-muted-foreground">{item.body}</p>
                  <ol className="flex max-w-md items-start">
                    {item.steps.map((step, stepIndex) => {
                      const isLast = stepIndex === item.steps.length - 1;
                      return (
                        <Fragment key={step}>
                          {stepIndex > 0 ? (
                            <li
                              aria-hidden="true"
                              className="mt-5 h-px flex-1 border-t border-dashed border-border"
                            />
                          ) : null}
                          <li className="grid w-24 justify-items-center gap-2 text-center">
                            <span
                              className={cn(
                                "grid size-10 place-items-center rounded-full border bg-card text-muted-foreground",
                                isLast && "border-brand/50 text-brand",
                              )}
                            >
                              <HugeiconsIcon icon={icons[stepIndex]} size={18} strokeWidth={1.75} />
                            </span>
                            <span className="text-xs text-muted-foreground">{step}</span>
                          </li>
                        </Fragment>
                      );
                    })}
                  </ol>
                  <p className="flex max-w-md items-start gap-2 text-sm text-muted-foreground">
                    <HugeiconsIcon
                      icon={InformationCircleIcon}
                      size={16}
                      strokeWidth={1.75}
                      className="mt-0.5 shrink-0"
                    />
                    {item.note}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
