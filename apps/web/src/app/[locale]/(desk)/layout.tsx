import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";

import { getBowls } from "@/features/bowls/bowls-queries";
import { AppSidebar } from "@/features/shell/components/app-sidebar";
import { CommandPalette } from "@/features/shell/components/command-palette";
import { NavUser } from "@/features/shell/components/nav-user";
import { requireSession } from "@/features/user/user-queries";
import { getDictionary, toLocale } from "@/lib/i18n";

export default function DeskLayout({ children, params }: LayoutProps<"/[locale]">) {
  return params.then(async ({ locale: rawLocale }) => {
    const locale = toLocale(rawLocale);
    const [session, bowls] = await Promise.all([requireSession(locale), getBowls()]);
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
        <CommandPalette
          locale={locale}
          bowls={bowls.map((bowl) => ({
            id: bowl.id,
            name: bowl.name,
            kecamatan: bowl.kecamatan,
          }))}
          labels={{ ...t.desk, nav: t.nav }}
        />
      </SidebarProvider>
    );
  });
}
