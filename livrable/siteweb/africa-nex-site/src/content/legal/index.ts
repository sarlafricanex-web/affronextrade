import { ar } from "./ar";
import { en } from "./en";
import { fr } from "./fr";
import type { LegalDocKey, LegalSet } from "./types";

export type { LegalDocKey } from "./types";

const SETS: Record<string, LegalSet> = { fr, en, ar };
export const getLegalSet = (locale: string): LegalSet => SETS[locale] ?? fr;

// Ordre et adresse des documents legaux (liens du pied de page et onglets).
export const LEGAL_DOCS: { key: LegalDocKey; path: string }[] = [
  { key: "legal", path: "/legal" },
  { key: "privacy", path: "/privacy" },
  { key: "terms", path: "/terms" },
  { key: "sales", path: "/sales" },
];
