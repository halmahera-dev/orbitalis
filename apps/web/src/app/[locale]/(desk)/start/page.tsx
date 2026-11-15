import type { Metadata } from "next";

import { DeskHeader } from "@/features/shell/components/desk-header";
import { NeedCards } from "@/features/shell/components/need-cards";
import { getDictionary, toLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Start",
};

export default function StartPage({ params }: PageProps<"/[locale]/start">) {
  return params.then(({ locale: rawLocale }) => {
    const locale = toLocale(rawLocale);
    const t = getDictionary(locale);
    return (
      <>
        <DeskHeader locale={locale} title={t.nav.startTitle} />
        <main className="flex w-full flex-1 flex-col px-4 py-4 sm:px-6">
          <NeedCards locale={locale} items={t.landing.questions.items} />
        </main>
      </>
    );
  });
}
