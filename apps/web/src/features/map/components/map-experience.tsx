import { getPublicBowls } from "@/features/bowls/bowls-queries";
import { PriokaMap } from "@/features/map/components/prioka-map";
import { requireSession } from "@/features/user/user-queries";
import { getDictionary, type Locale } from "@/lib/i18n";

export async function MapExperience({ locale }: { locale: Locale }) {
  await requireSession(locale);
  const t = getDictionary(locale);
  return (
    <PriokaMap locale={locale} bowls={getPublicBowls()} labels={{ map: t.map, common: t.common }} />
  );
}
