import { routing } from "@/i18n/routing";

export function resolveLocale(candidate: string | null | undefined) {
  return candidate && (routing.locales as readonly string[]).includes(candidate) ? candidate : routing.defaultLocale;
}

// Page de destination apres connexion : un chemin du site uniquement, jamais une autre adresse.
export function safeNextPath(next: string | null | undefined, locale: string) {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) return next;
  return `/${resolveLocale(locale)}/dashboard`;
}
