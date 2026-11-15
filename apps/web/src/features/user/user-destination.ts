import { defaultLocale, hasLocale } from "@/lib/i18n/locales";

export function guestDestinationPath(locale: string, destination: unknown) {
  const base = `/${hasLocale(locale) ? locale : defaultLocale}`;
  return destination === "map" ? `${base}/map` : base;
}
