import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale, safeNextPath } from "@/lib/auth/next-path";

// Retour de Google et des liens envoyes par email (reinitialisation du mot de passe).
// Hors de [locale] : l'adresse declaree chez Google et Supabase reste fixe.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const role = url.searchParams.get("role");
  const nextParam = url.searchParams.get("next");
  const locale = resolveLocale(nextParam?.split("/")[1]);
  const next = safeNextPath(nextParam, locale);

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if ((role === "producer" || role === "buyer") && data.user) {
        // Le role choisi avant "Continuer avec Google" ne vaut que pour un compte pas encore configure.
        await supabase.from("profiles").update({ role }).eq("id", data.user.id).eq("onboarding_completed", false);
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL(`/${locale}/login?error=link`, url.origin));
}
