import { MapsGlobal02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/button";
import Link from "next/link";
import { Suspense } from "react";

import { BowlQueue, BowlQueueSkeleton } from "@/features/bowls/components/bowl-queue";
import { DeskHeader } from "@/features/shell/components/desk-header";
import { getDictionary, toLocale, type Locale } from "@/lib/i18n";

function firstValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

function BowlQueueForQuery({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams: PageProps<"/[locale]/bowls">["searchParams"];
}) {
  return searchParams.then((query) => (
    <BowlQueue
      locale={locale}
      filters={{
        type: firstValue(query.type),
        search: (firstValue(query.q) ?? "").trim().slice(0, 100),
        kecamatan: firstValue(query.kecamatan),
        status: firstValue(query.status),
        assignee: firstValue(query.assignee),
        overdue: firstValue(query.overdue) === "1",
      }}
    />
  ));
}

export default function BowlsPage({ params, searchParams }: PageProps<"/[locale]/bowls">) {
  return params.then(({ locale: rawLocale }) => {
    const locale = toLocale(rawLocale);
    const t = getDictionary(locale);

    return (
      <>
        <DeskHeader
          locale={locale}
          title={t.bowls.title}
          actions={
            <Button size="sm" nativeButton={false} render={<Link href={`/${locale}/map`} />}>
              <HugeiconsIcon icon={MapsGlobal02Icon} strokeWidth={2} data-icon="inline-start" />
              {t.common.openMap}
            </Button>
          }
        />
        <main className="flex w-full flex-1 flex-col">
          <Suspense fallback={<BowlQueueSkeleton />}>
            <BowlQueueForQuery locale={locale} searchParams={searchParams} />
          </Suspense>
        </main>
      </>
    );
  });
}
