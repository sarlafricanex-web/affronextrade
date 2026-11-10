// Listes de reference de la premiere configuration producteur (partagees navigateur et serveur).

export const LEGAL_FORMS = ["SARL", "SPA", "EURL", "SNC", "EI"] as const;
export type LegalForm = (typeof LEGAL_FORMS)[number];

// Valeurs autorisees par la contrainte de la colonne companies.sector.
export const SECTORS = ["agrifood", "agriculture", "industry", "automotive", "cosmetics", "crafts"] as const;
export type Sector = (typeof SECTORS)[number];

// Les 58 wilayas, code officiel et nom usuel.
export const WILAYAS: ReadonlyArray<readonly [string, string]> = [
  ["01", "Adrar"], ["02", "Chlef"], ["03", "Laghouat"], ["04", "Oum El Bouaghi"], ["05", "Batna"],
  ["06", "Béjaïa"], ["07", "Biskra"], ["08", "Béchar"], ["09", "Blida"], ["10", "Bouira"],
  ["11", "Tamanrasset"], ["12", "Tébessa"], ["13", "Tlemcen"], ["14", "Tiaret"], ["15", "Tizi Ouzou"],
  ["16", "Alger"], ["17", "Djelfa"], ["18", "Jijel"], ["19", "Sétif"], ["20", "Saïda"],
  ["21", "Skikda"], ["22", "Sidi Bel Abbès"], ["23", "Annaba"], ["24", "Guelma"], ["25", "Constantine"],
  ["26", "Médéa"], ["27", "Mostaganem"], ["28", "M'Sila"], ["29", "Mascara"], ["30", "Ouargla"],
  ["31", "Oran"], ["32", "El Bayadh"], ["33", "Illizi"], ["34", "Bordj Bou Arréridj"], ["35", "Boumerdès"],
  ["36", "El Tarf"], ["37", "Tindouf"], ["38", "Tissemsilt"], ["39", "El Oued"], ["40", "Khenchela"],
  ["41", "Souk Ahras"], ["42", "Tipaza"], ["43", "Mila"], ["44", "Aïn Defla"], ["45", "Naâma"],
  ["46", "Aïn Témouchent"], ["47", "Ghardaïa"], ["48", "Relizane"], ["49", "Timimoun"], ["50", "Bordj Badji Mokhtar"],
  ["51", "Ouled Djellal"], ["52", "Béni Abbès"], ["53", "In Salah"], ["54", "In Guezzam"], ["55", "Touggourt"],
  ["56", "Djanet"], ["57", "El M'Ghair"], ["58", "El Meniaa"],
];
export const WILAYA_CODES = new Set(WILAYAS.map(([code]) => code));

// NIF algerien : 15 chiffres (espaces toleres a la saisie).
export const normalizeNif = (value: string) => value.replace(/\s/g, "");
export const isValidNif = (value: string) => /^\d{15}$/.test(normalizeNif(value));

export const CURRENCIES = ["USD", "EUR", "DZD"] as const;
export const PRICE_BASES = ["FOB", "FCA", "EXW"] as const;
export const UNITS = ["kg", "t", "l", "unit", "carton", "pallet"] as const;

// Code SH : 6, 8 ou 10 chiffres, enregistre groupe "1509.20.00". Renvoie null si invalide.
export function normalizeHsCode(value: string) {
  const digits = value.replace(/[\s.]/g, "");
  if (!/^\d{6}$|^\d{8}$|^\d{10}$/.test(digits)) return null;
  return [digits.slice(0, 4), ...digits.slice(4).match(/\d{2}/g)!].join(".");
}

// Nombre saisi avec virgule ou point, espaces toleres ("9,20" ou "2 000").
export function parseAmount(value: string) {
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}
