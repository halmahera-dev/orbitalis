import type { Metadata } from "next";

import Link from "next/link";
import { Suspense } from "react";

import { AppLogo } from "@/components/app-logo";
import { AreaCheck, AreaCheckSkeleton } from "@/features/check/components/area-check";
import { LanguageSwitch } from "@/features/shell/components/language-switch";
import { getDictionary, toLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Area check",
};

export default function CheckPage({ params }: PageProps<"/[locale]/check">) {
  return params.then(({ locale: rawLocale }) => {
    const locale = toLocale(rawLocale);
    const t = getDictionary(locale);
    return (
      <div className="flex h-svh flex-col gap-3 bg-background p-3 sm:p-4">
        <header className="flex flex-wrap items-center gap-3">
          <Link href={`/${locale}/landing`} className="flex items-center gap-2 text-sm font-medium">
            <AppLogo />
            ORBITALIS
          </Link>
          <h1 className="type-title">{t.check.title}</h1>
          <div className="ml-auto flex items-center gap-3">
            <a
              href="https://pamjaya.co.id"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-brand-text transition-colors duration-160 ease-out hover:text-foreground"
            >
              {t.check.pipeLink}
            </a>
            <Suspense fallback={null}>
              <LanguageSwitch locale={locale} label={t.common.switchLanguage} />
            </Suspense>
          </div>
        </header>
        <Suspense fallback={<AreaCheckSkeleton />}>
          <AreaCheck locale={locale} />
        </Suspense>
      </div>
    );
  });
}
