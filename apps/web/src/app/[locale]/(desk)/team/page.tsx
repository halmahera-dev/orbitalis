import { Suspense } from "react";

import { DeskHeader } from "@/features/shell/components/desk-header";
import { TeamAddButton } from "@/features/team/components/team-add-button";
import { TeamBoard, TeamBoardSkeleton } from "@/features/team/components/team-board";
import { getDictionary, toLocale } from "@/lib/i18n";

function firstValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

export default function TeamPage({ params, searchParams }: PageProps<"/[locale]/team">) {
  return Promise.all([params, searchParams]).then(([{ locale: rawLocale }, query]) => {
    const locale = toLocale(rawLocale);
    const t = getDictionary(locale);
    const filters = {
      search: (firstValue(query.q) ?? "").trim().slice(0, 100),
      status: firstValue(query.status),
    };

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
            <TeamBoard locale={locale} filters={filters} />
          </Suspense>
        </main>
      </>
    );
  });
}
