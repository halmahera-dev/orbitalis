import type { Metadata } from "next";

import { Suspense } from "react";

import { BowlTwin, BowlTwinSkeleton } from "@/features/bowls/components/bowl-twin";
import { toLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Bowl",
};

export default function BowlPage({ params }: PageProps<"/[locale]/bowls/[id]">) {
  return params.then(({ locale, id }) => {
    return (
      <Suspense fallback={<BowlTwinSkeleton />}>
        <BowlTwin locale={toLocale(locale)} bowlId={id} />
      </Suspense>
    );
  });
}
