import { parsePhoneNumberFromString } from "libphonenumber-js";

// Regles communes au navigateur (PhoneField) et au serveur (API) : un numero est stocke au
// format international sans espaces (+213555123456), celui de WhatsApp et des SMS.

/** Vide (champ facultatif) ou numero international valide pour son pays. */
export function isValidPhone(value: string | null | undefined) {
  return !value || Boolean(parsePhoneNumberFromString(value)?.isValid());
}

/** "+213555123456" devient "+213 555 12 34 56" ; une saisie illisible est rendue telle quelle. */
export function formatPhone(value: string | null | undefined) {
  if (!value) return value ?? null;
  return parsePhoneNumberFromString(value)?.formatInternational() ?? value;
}
