import { Suspense } from "react";

import { DeskHeader } from "@/features/shell/components/desk-header";
import { TeamAddButton } from "@/features/team/components/team-add-button";
import { TeamBoard, TeamBoardSkeleton } from "@/features/team/components/team-board";
import { getDictionary, toLocale, type Locale } from "@/lib/i18n";

function firstValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

function TeamBoardForQuery({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams: PageProps<"/[locale]/team">["searchParams"];
}) {
  return searchParams.then((query) => (
    <TeamBoard
      locale={locale}
      filters={{
        search: (firstValue(query.q) ?? "").trim().slice(0, 100),
        status: firstValue(query.status),
      }}
    />
  ));
}

export default function TeamPage({ params, searchParams }: PageProps<"/[locale]/team">) {
  return params.then(({ locale: rawLocale }) => {
    const locale = toLocale(rawLocale);
    const t = getDictionary(locale);

    return (
      <>
        <DeskHeader
          locale={locale}
          title={t.team.title}
          actions={
            <TeamAddButton
              labels={{
                add: t.team.add,
                dialogs: t.team.dialogs,
                cancel: t.common.cancel,
                save: t.common.save,
              }}
            />
          }
        />
        <main className="flex w-full flex-1 flex-col">
          <Suspense fallback={<TeamBoardSkeleton />}>
            <TeamBoardForQuery locale={locale} searchParams={searchParams} />
          </Suspense>
        </main>
      </>
    );
  });
}
