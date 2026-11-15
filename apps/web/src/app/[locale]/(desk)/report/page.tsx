import type { Metadata } from "next";

import { Suspense } from "react";

import { SiteReport, SiteReportSkeleton } from "@/features/reports/components/site-report";
import { DeskHeader } from "@/features/shell/components/desk-header";
import { getDictionary, toLocale, type Locale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Site report",
};

function parsePoint(value: string | string[] | undefined): [number, number] | null {
  const parts = (Array.isArray(value) ? value[0] : value)?.split(",").map(Number);
  if (parts?.length === 2 && parts.every(Number.isFinite)) {
    return [parts[0], parts[1]];
  }
  return null;
}

function SiteReportForQuery({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams: PageProps<"/[locale]/report">["searchParams"];
}) {
  return searchParams.then((query) => <SiteReport locale={locale} point={parsePoint(query.at)} />);
}

export default function ReportPage({ params, searchParams }: PageProps<"/[locale]/report">) {
  return params.then(({ locale: rawLocale }) => {
    const locale = toLocale(rawLocale);
    const t = getDictionary(locale);
    return (
      <>
        <DeskHeader locale={locale} title={t.report.title} />
        <main className="flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
          <Suspense fallback={<SiteReportSkeleton />}>
            <SiteReportForQuery locale={locale} searchParams={searchParams} />
          </Suspense>
        </main>
      </>
    );
  });
}
