import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { defaultLocale, hasLocale } from "@/lib/i18n/locales";

const publicPages = ["landing", "sign-in", "sign-up", "design-system"];

function preferredLocale(request: NextRequest) {
  const firstLanguage = request.headers.get("accept-language")?.split(",")[0] ?? "";
  return firstLanguage.toLowerCase().startsWith("en") ? "en" : defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, locale, page = ""] = pathname.split("/");
  const url = request.nextUrl.clone();

  if (!hasLocale(locale)) {
    url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  if (pathname === `/${locale}/inspections`) {
    url.pathname = `/${locale}/bowls`;
    url.searchParams.set("status", "lead");
    return NextResponse.redirect(url, 308);
  }

  // A fast cookie check only. requireSession does the real session check.
  if (!publicPages.includes(page) && !getSessionCookie(request)) {
    url.pathname = page === "" ? `/${locale}/landing` : `/${locale}/sign-in`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
