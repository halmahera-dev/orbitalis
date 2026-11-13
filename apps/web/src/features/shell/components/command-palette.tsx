"use client";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@repo/ui/components/command";
import {
  DashboardSquare01Icon,
  ListViewIcon,
  MapsGlobal02Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Dictionary, Locale } from "@/lib/i18n";

type PaletteBowl = { id: string; name: string; kecamatan: string };

export function CommandPalette({
  locale,
  bowls,
  labels,
}: {
  locale: Locale;
  bowls: PaletteBowl[];
  labels: Dictionary["desk"] & { nav: Dictionary["nav"] };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const home = `/${locale}`;
  const pages = [
    { title: labels.nav.today, href: home, icon: DashboardSquare01Icon },
    { title: labels.nav.bowls, href: `${home}/bowls`, icon: ListViewIcon },
    { title: labels.nav.team, href: `${home}/team`, icon: UserMultipleIcon },
    { title: labels.nav.map, href: `${home}/map`, icon: MapsGlobal02Icon },
  ];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={labels.commandTitle}
      description={labels.commandPlaceholder}
    >
      <Command>
        <CommandInput placeholder={labels.commandPlaceholder} />
        <CommandList>
          <CommandEmpty>{labels.commandEmpty}</CommandEmpty>
          <CommandGroup heading={labels.commandPages}>
            {pages.map((page) => (
              <CommandItem key={page.href} value={page.title} onSelect={() => go(page.href)}>
                <HugeiconsIcon icon={page.icon} strokeWidth={2} />
                <span>{page.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading={labels.commandBowls}>
            {bowls.map((bowl) => (
              <CommandItem
                key={bowl.id}
                value={`${bowl.name} ${bowl.kecamatan}`}
                onSelect={() => go(`${home}/bowls/${bowl.id}`)}
              >
                <span>{bowl.name}</span>
                <CommandShortcut>{bowl.kecamatan}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
