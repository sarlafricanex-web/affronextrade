import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { adopt, refreshSession } from "./lib/supabase/session";

const handleI18nRouting = createMiddleware(routing);

// Confort de navigation seulement : la vraie securite est dans les regles RLS de la base.
const PROTECTED = ["/dashboard", "/onboarding", "/admin"];
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

function splitLocale(pathname: string) {
  const first = pathname.split("/")[1] ?? "";
  if ((routing.locales as readonly string[]).includes(first)) {
    return { locale: first, rest: pathname.slice(first.length + 1) || "/" };
  }
  return { locale: null, rest: pathname };
}

export default async function proxy(request: NextRequest) {
  const { claims, carrier } = await refreshSession(request);
  const { pathname, search } = request.nextUrl;

  if (/^\/(api|auth|_vercel)(\/|$)/.test(pathname)) return carrier;

  const { locale, rest } = splitLocale(pathname);
  if (locale) {
    if (!claims && PROTECTED.some((prefix) => isUnder(rest, prefix))) {
      const login = new URL(`/${locale}/login`, request.url);
      login.searchParams.set("next", pathname + search);
      return adopt(NextResponse.redirect(login), carrier);
    }
    if (claims && AUTH_PAGES.some((prefix) => isUnder(rest, prefix))) {
      return adopt(NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url)), carrier);
    }
  }

  return adopt(handleI18nRouting(request), carrier);
}

export const config = {
  // Les chemins avec un point sont des fichiers statiques ; /api et /auth passent par le proxy
  // pour que les routes serveur recoivent une session rafraichie.
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)", "/(api|auth)/:path*"],
};
