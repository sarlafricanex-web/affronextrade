// Documents legaux (audit legal du 19 novembre 2026, correction 2) : mentions legales, politique de
// confidentialite, CGU et CGV, en francais, anglais et arabe. Un bloc est un paragraphe (texte) ou
// une liste a puces (tableau de textes).
export type LegalBlock = string | string[];
export type LegalSection = { title: string; blocks: LegalBlock[] };
export type LegalDoc = { title: string; intro?: string; sections: LegalSection[] };
export type LegalDocKey = "legal" | "privacy" | "terms" | "sales";
export type LegalSet = { updated: string; docs: Record<LegalDocKey, LegalDoc> };

// Faits communs aux trois langues.
export const COMPANY = {
  name: "SARL AFRICA NEX",
  capital: "3 000 000 DA",
  rc: "19/00-0096919 B 26",
  nif: "002619009691970",
  email: "sarlafricanex@gmail.com",
  phone: "+213 770 96 02 70",
  director: "Adlene ZEMOULI",
} as const;
