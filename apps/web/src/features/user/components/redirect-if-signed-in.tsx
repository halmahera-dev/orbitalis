import type { Locale } from "@/lib/i18n";

import { redirectIfAuthenticated } from "@/features/user/user-queries";

export async function RedirectIfSignedIn({ locale }: { locale: Locale }) {
  await redirectIfAuthenticated(locale);
  return null;
}
