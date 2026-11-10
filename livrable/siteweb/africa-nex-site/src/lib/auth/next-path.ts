import { routing } from "@/i18n/routing";

export function resolveLocale(candidate: string | null | undefined) {
  return candidate && (routing.locales as readonly string[]).includes(candidate) ? candidate : routing.defaultLocale;
}

// Base fictive : sert uniquement a verifier qu'un chemin ne change pas de site une fois interprete.
const SAME_SITE = "https://africanex.invalid";

// Le navigateur efface tabulations et retours a la ligne avant de lire une adresse :
// "/<tabulation>/autre-site" deviendrait "//autre-site". Tout caractere de controle est refuse,
// ainsi que la barre inversee (que les navigateurs lisent comme "/").
const hasUnsafeChar = (value: string) => [...value].some((c) => c <= "\u001F" || c === "\u007F" || c === "\\");

// Page de destination apres connexion : un chemin du site commencant par une langue, jamais une
// autre adresse. Le chemin est verifie apres interpretation, exactement comme le fera le navigateur.
export function safeNextPath(next: string | null | undefined, locale: string) {
  const fallback = `/${resolveLocale(locale)}/dashboard`;
  if (!next || hasUnsafeChar(next) || !next.startsWith("/") || next.startsWith("//")) return fallback;

  let url: URL;
  try {
    url = new URL(next, SAME_SITE);
  } catch {
    return fallback;
  }
  const firstSegment = url.pathname.split("/")[1];
  const sameSite = url.origin === SAME_SITE && !url.pathname.startsWith("//");
  if (!sameSite || !(routing.locales as readonly string[]).includes(firstSegment)) return fallback;
  return url.pathname + url.search + url.hash;
}
