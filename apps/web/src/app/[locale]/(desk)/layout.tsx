import { Suspense } from "react";

import { DeskShell, DeskShellSkeleton } from "@/features/shell/components/desk-shell";
import { toLocale } from "@/lib/i18n";

export default function DeskLayout({ children, params }: LayoutProps<"/[locale]">) {
  return params.then(({ locale }) => {
    return (
      <Suspense fallback={<DeskShellSkeleton />}>
        <DeskShell locale={toLocale(locale)}>{children}</DeskShell>
      </Suspense>
    );
  });
}
