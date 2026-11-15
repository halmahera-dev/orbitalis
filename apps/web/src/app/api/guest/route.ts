import type { NextRequest } from "next/server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { startGuestSession } from "@/features/user/guest-session";
import { safeLocalPath } from "@/features/user/user-destination";
import { defaultLocale } from "@/lib/i18n/locales";

export async function GET(request: NextRequest) {
  await startGuestSession(await headers());
  redirect(safeLocalPath(request.nextUrl.searchParams.get("next"), `/${defaultLocale}/map`));
}
