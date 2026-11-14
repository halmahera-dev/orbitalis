"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/ui/components/sidebar";
import {
  DashboardSquare01Icon,
  ListViewIcon,
  MapsGlobal02Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Dictionary, Locale } from "@/lib/i18n";

import { AppLogo } from "@/components/app-logo";

export function AppSidebar({
  locale,
  labels,
  userMenu,
}: {
  locale: Locale;
  labels: Dictionary["nav"];
  userMenu: React.ReactNode;
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const home = `/${locale}`;
  const items = [
    { title: labels.today, href: home, icon: DashboardSquare01Icon },
    { title: labels.bowls, href: `${home}/bowls`, icon: ListViewIcon },
    { title: labels.team, href: `${home}/team`, icon: UserMultipleIcon },
    { title: labels.map, href: `${home}/map`, icon: MapsGlobal02Icon },
  ];

  function isActive(href: string) {
    return href === home ? pathname === home : pathname.startsWith(href);
  }

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="mt-1">
            <SidebarMenuButton render={<Link href={home} />}>
              <AppLogo />
              <span className="font-heading text-sm font-semibold">ORBITALIS</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(item.href)}
                    render={
                      <Link
                        href={item.href}
                        aria-current={isActive(item.href) ? "page" : undefined}
                        onClick={() => setOpenMobile(false)}
                      />
                    }
                  >
                    <HugeiconsIcon icon={item.icon} />
                    {item.title}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>{userMenu}</SidebarFooter>
    </Sidebar>
  );
}
