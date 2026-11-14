import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Suspense } from "react";

import { AppSidebar } from "@/features/shell/components/app-sidebar";
import {
  DeskCommandPalette,
  DeskCommandPaletteSkeleton,
} from "@/features/shell/components/desk-command-palette";
import { NavUser } from "@/features/shell/components/nav-user";
import { requireSession } from "@/features/user/user-queries";
import { getDictionary, type Locale } from "@/lib/i18n";

export async function DeskShell({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const session = await requireSession(locale);
  const t = getDictionary(locale);

  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden">
      <AppSidebar
        locale={locale}
        labels={t.nav}
        userMenu={
          <NavUser
            name={session.user.name}
            email={session.user.email}
            image={session.user.image}
            locale={locale}
            labels={t.common}
          />
        }
      />
      <SidebarInset className="overflow-x-hidden overflow-y-auto overscroll-contain">
        {children}
      </SidebarInset>
      <Suspense fallback={<DeskCommandPaletteSkeleton />}>
        <DeskCommandPalette locale={locale} />
      </Suspense>
    </SidebarProvider>
  );
}

export function DeskShellSkeleton() {
  return <Skeleton className="h-svh w-full" />;
}
