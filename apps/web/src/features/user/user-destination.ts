import { defaultLocale, hasLocale } from "@/lib/i18n/locales";

export function safeLocalPath(value: string | null, fallback: string) {
  return value && /^\/(?![/\\])/.test(value) ? value : fallback;
}

export function guestDestinationPath(locale: string, destination: unknown) {
  const base = `/${hasLocale(locale) ? locale : defaultLocale}`;
  return destination === "map" ? `${base}/map` : base;
}
