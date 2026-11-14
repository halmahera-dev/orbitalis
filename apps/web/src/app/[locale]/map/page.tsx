import type { Metadata } from "next";
import { Suspense } from "react";

import { PriokaMapSkeleton } from "@/features/map/components/prioka-map";
import { MapExperience } from "@/features/map/components/map-experience";
import { toLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Map",
};

export default function MapPage({ params }: PageProps<"/[locale]/map">) {
  return params.then(({ locale }) => {
    return (
      <Suspense fallback={<PriokaMapSkeleton />}>
        <MapExperience locale={toLocale(locale)} />
      </Suspense>
    );
  });
}
