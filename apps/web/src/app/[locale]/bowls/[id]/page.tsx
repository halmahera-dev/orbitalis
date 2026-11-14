import type { Metadata } from "next";

import { Suspense } from "react";

import { BowlTwin, BowlTwinSkeleton } from "@/features/bowls/components/bowl-twin";
import { toLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Bowl",
};

async function BowlTwinForRoute({ params }: Pick<PageProps<"/[locale]/bowls/[id]">, "params">) {
  const { locale, id } = await params;
  return <BowlTwin locale={toLocale(locale)} bowlId={id} />;
}

export default function BowlPage({ params }: PageProps<"/[locale]/bowls/[id]">) {
  return (
    <Suspense fallback={<BowlTwinSkeleton />}>
      <BowlTwinForRoute params={params} />
    </Suspense>
  );
}
