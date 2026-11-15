import { interferogramCatalog } from "@/features/nisar/nisar-catalog";
import { PageHeader } from "@/features/shell/components/page-header";
import { fill, formatDateShort, getDictionary, type Locale } from "@/lib/i18n";

const passIntervalDays = 12;

export function DeskHeader({
  locale,
  title,
  actions,
}: {
  locale: Locale;
  title: string;
  actions?: React.ReactNode;
}) {
  const t = getDictionary(locale);
  const pairs = interferogramCatalog.pairs;
  const latestPassDate = pairs[pairs.length - 1].secondaryDate;
  const nextPassDate = new Date(Date.parse(latestPassDate) + passIntervalDays * 86_400_000);

  return (
    <PageHeader
      title={title}
      meta={
        <>
          {fill(t.desk.lastPass, { date: formatDateShort(locale, latestPassDate) })}.{" "}
          {fill(t.desk.nextPass, { date: formatDateShort(locale, nextPassDate) })}
        </>
      }
      actions={actions}
    />
  );
}
