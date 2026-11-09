import { isSupportedCountry } from "libphonenumber-js";

// Les pays sont stockes sous leur code ISO ("SN") et traduits a l'affichage. Les anciens
// contacts du site ont un pays en texte libre ("tunisie") : il est rendu tel quel.

const ISO = /^[A-Z]{2}$/;

/** Nom du pays dans la langue demandee ("SN" -> "Senegal"), le code a defaut. */
export function regionName(locale: string, code: string) {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Vide (champ facultatif) ou code pays ISO connu. */
export function isCountryCode(value: string | null | undefined) {
  return !value || (ISO.test(value) && isSupportedCountry(value));
}

/** Pays lisible : code ISO traduit, ancienne saisie libre inchangee. */
export function countryName(value: string | null | undefined, locale = "fr") {
  if (!value) return value ?? null;
  return ISO.test(value) ? regionName(locale, value) : value;
}
