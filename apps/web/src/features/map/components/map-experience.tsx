import { getPublicBowls } from "@/features/bowls/bowls-queries";
import { OrbitalisMap } from "@/features/map/components/orbitalis-map";
import { requireSession } from "@/features/user/user-queries";
import { getDictionary, type Locale } from "@/lib/i18n";

export async function MapExperience({ locale }: { locale: Locale }) {
  await requireSession(locale);
  const t = getDictionary(locale);
  return (
    <OrbitalisMap locale={locale} bowls={getPublicBowls()} labels={{ map: t.map, common: t.common }} />
  );
}
