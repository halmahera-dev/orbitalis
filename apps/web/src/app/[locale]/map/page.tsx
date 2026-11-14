import type { Metadata } from "next";
import { Suspense } from "react";

import { OrbitalisMapSkeleton } from "@/features/map/components/orbitalis-map";
import { MapExperience } from "@/features/map/components/map-experience";
import { toLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Map",
};

export default function MapPage({ params }: PageProps<"/[locale]/map">) {
  return params.then(({ locale }) => {
    return (
      <Suspense fallback={<OrbitalisMapSkeleton />}>
        <MapExperience locale={toLocale(locale)} />
      </Suspense>
    );
  });
}
