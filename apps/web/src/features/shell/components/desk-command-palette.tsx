import { getBowls } from "@/features/bowls/bowls-queries";
import { CommandPalette } from "@/features/shell/components/command-palette";
import { getDictionary, type Locale } from "@/lib/i18n";

export async function DeskCommandPalette({ locale }: { locale: Locale }) {
  const bowls = await getBowls();
  const t = getDictionary(locale);

  return (
    <CommandPalette
      locale={locale}
      bowls={bowls.map((bowl) => ({
        id: bowl.id,
        name: bowl.name,
        kecamatan: bowl.kecamatan,
      }))}
      labels={{ ...t.desk, nav: t.nav }}
    />
  );
}

export function DeskCommandPaletteSkeleton() {
  return null;
}
