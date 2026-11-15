"use client";

import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Map, MapMarker, MarkerContent } from "@/components/ui/map";
import { fastRateMmYr, middleRateMmYr, slowRateMmYr } from "@/features/map/bowl-rates";

type MiniBowl = {
  id: string;
  name: string;
  center: [number, number];
  rateMmYr: number | null;
};

function rateTone(rate: number | null) {
  if (rate === null) {
    return "bg-muted-foreground";
  }
  if (rate >= fastRateMmYr) {
    return "bg-rate-fast";
  }
  if (rate >= middleRateMmYr) {
    return "bg-rate-middle";
  }
  if (rate >= slowRateMmYr) {
    return "bg-rate-slow";
  }
  return "bg-rate-slow";
}

export function TodayMiniMap({
  locale,
  bowls,
  title,
  openLabel,
}: {
  locale: string;
  bowls: MiniBowl[];
  title: string;
  openLabel: string;
}) {
  const router = useRouter();

  return (
    <section
      aria-labelledby="today-map"
      className="flex h-full min-h-56 min-w-0 flex-col overflow-hidden rounded-4xl bg-card shadow-card"
    >
      <div className="flex shrink-0 items-baseline justify-between gap-4 border-b px-4 py-3">
        <h2 id="today-map" className="text-sm font-medium">
          {title}
        </h2>
        <Link
          href={`/${locale}/map`}
          className="text-xs text-brand-text transition-colors duration-160 ease-out hover:text-foreground"
        >
          {openLabel}
        </Link>
      </div>
      <div className="relative min-h-0 flex-1">
        <Map
          center={[106.83, -6.22]}
          zoom={10.2}
          pitch={48}
          bearing={-18}
          className="absolute inset-0"
          attributionControl={false}
        >
          {bowls.map((bowl) => (
            <MapMarker
              key={bowl.id}
              longitude={bowl.center[0]}
              latitude={bowl.center[1]}
              onClick={() => router.push(`/${locale}/bowls/${bowl.id}`)}
            >
              <MarkerContent>
                <span
                  title={bowl.name}
                  className={cn(
                    "block size-2.5 rounded-full ring-2 ring-card",
                    rateTone(bowl.rateMmYr),
                  )}
                />
              </MarkerContent>
            </MapMarker>
          ))}
        </Map>
      </div>
    </section>
  );
}
