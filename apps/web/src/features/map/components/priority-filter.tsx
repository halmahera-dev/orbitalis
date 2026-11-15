"use client";

import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Slider } from "@repo/ui/components/slider";
import { useId, useState } from "react";

import {
  defaultPriorityFilter,
  economyLevels,
  layerWeights,
  rankByOptions,
  type PriorityFilter as Filter,
  type PriorityLayer,
} from "@/features/areas/areas-priority";
import { fill, formatNumber, type Dictionary, type Locale } from "@/lib/i18n";

const sinkingMax = 100;
const sinkingStep = 5;
const populationMax = 40_000;
const populationStep = 1_000;

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span>{label}</span>
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

function FilterSlider({
  label,
  valueText,
  value,
  max,
  step,
  onChange,
}: {
  label: string;
  valueText: string;
  value: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span id={labelId}>{label}</span>
        <span className="tabular-nums">{valueText}</span>
      </div>
      <Slider
        aria-labelledby={labelId}
        value={value}
        min={0}
        max={max}
        step={step}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
      />
    </div>
  );
}

function weightsText(layer: PriorityLayer | null, t: Dictionary["map"]["priority"]) {
  if (layer === null) {
    return t.leadWeights;
  }
  const weights = layerWeights[layer];
  return fill(t.weights, {
    sinking: Math.round(weights.sinking * 100),
    population: Math.round(weights.population * 100),
    economy: Math.round(weights.economy * 100),
  });
}

export function PriorityFilter({
  locale,
  layer,
  filter,
  onChange,
  labels,
}: {
  locale: Locale;
  layer: PriorityLayer | null;
  filter: Filter;
  onChange: (filter: Filter) => void;
  labels: Dictionary["map"]["priority"];
}) {
  const t = labels;
  const [isOpen, setIsOpen] = useState(true);
  const bodyId = useId();
  const isDefault = Object.entries(defaultPriorityFilter).every(
    ([key, value]) => filter[key as keyof Filter] === value,
  );

  return (
    <section className="flex flex-col gap-3 border-t pt-3" aria-label={t.filterTitle}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm text-foreground">{t.filterTitle}</h2>
        <div className="flex items-center gap-1">
          {!isDefault && isOpen && (
            <Button size="sm" variant="ghost" onClick={() => onChange(defaultPriorityFilter)}>
              {t.reset}
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-expanded={isOpen}
            aria-controls={bodyId}
            aria-label={t.filterTitle}
            onClick={() => setIsOpen(!isOpen)}
          >
            <HugeiconsIcon icon={isOpen ? ArrowUp01Icon : ArrowDown01Icon} strokeWidth={2} />
          </Button>
        </div>
      </div>
      {isOpen && (
        <div id={bodyId} className="flex flex-col gap-3">
          <FilterSlider
            label={t.sinking}
            valueText={fill(t.sinkingMin, { value: filter.minSinkingMmYr })}
            value={filter.minSinkingMmYr}
            max={sinkingMax}
            step={sinkingStep}
            onChange={(value) => onChange({ ...filter, minSinkingMmYr: value })}
          />
          <FilterSlider
            label={t.population}
            valueText={fill(t.populationMin, {
              value: formatNumber(locale, filter.minPopulationPerKm2),
            })}
            value={filter.minPopulationPerKm2}
            max={populationMax}
            step={populationStep}
            onChange={(value) => onChange({ ...filter, minPopulationPerKm2: value })}
          />
          <FilterSelect
            label={t.economy}
            value={filter.minEconomy}
            options={economyLevels.map((level) => ({ value: level, label: t.economyFrom[level] }))}
            onChange={(value) =>
              onChange({
                ...filter,
                minEconomy: economyLevels.find((level) => level === value) ?? "low",
              })
            }
          />
          <FilterSelect
            label={t.rankBy}
            value={filter.rankBy}
            options={rankByOptions.map((option) => ({
              value: option,
              label: t.rankByOption[option],
            }))}
            onChange={(value) =>
              onChange({
                ...filter,
                rankBy: rankByOptions.find((option) => option === value) ?? "combined",
              })
            }
          />
          <p>{weightsText(layer, t)}</p>
          {layer === "pipe" && <p>{t.pipePopulation}</p>}
        </div>
      )}
    </section>
  );
}
