// Regles de la liste de prix fournisseur, communes a l'editeur de produit et a l'import Excel.
// Un seul modele pour tous les fournisseurs (21 novembre 2026) : un prix HT dans l'incoterm de son
// choix (les 11 d'Incoterms 2020), plus de prix construit en FCA (cout produit + emballage).
import { parseAmount } from "@/lib/onboarding/reference";
import { isCountryCode } from "@/lib/countries";
import { INCOTERMS } from "@/lib/incoterms";

export const PRICE_BASES = INCOTERMS;

// Conditionnement en 4 niveaux (structure de l'annexe "brief conditionnement").
export const PACK_LEVELS = [1, 2, 3, 4] as const;
export const PACK_TYPES = ["bag", "box", "carton", "carton_case", "wood_case", "plastic_bin", "drum", "jerrycan", "big_bag", "sack", "bulk", "pallet_euro", "pallet_us", "wire_container", "other"] as const;
export const PACK_LABELS = ["supplier", "customer", "neutral", "none"] as const;
export const PACK_PROTECTIONS = ["stretch", "strapping", "stretch_strapping", "film", "none"] as const;
export const PACK_WEDGING = ["yes", "no"] as const;

export type PackLevel = { qty: number | null; type: string | null; weight_kg: number | null; length_mm: number | null; width_mm: number | null; height_mm: number | null };
export type PackagingSpec = { levels: PackLevel[]; label: string | null; wedging: string | null; protection: string | null; notes: string | null };

// Deux prix par produit : prix en dinars HT (confidentiel, AFRICA NEX seule) et prix export dans
// UNE devise (EUR ou USD). Un devis n'a jamais deux devises.
export const EXPORT_CURRENCIES = ["EUR", "USD"] as const;

// Marge de negociation : remise maximale par paliers (3 au plus), chaque palier atteint par une
// quantite ou par un montant de commande. Confidentielle, jamais appliquee automatiquement.
export const TIER_SLOTS = [1, 2, 3] as const;
export const TIER_BASES = ["qty", "amount"] as const;
export type { DiscountTier } from "@/lib/discount-tiers";
import type { DiscountTier } from "@/lib/discount-tiers";
export type TierField = `t${1 | 2 | 3}${"Basis" | "Threshold" | "Discount"}`;
export const TIER_FIELDS: TierField[] = TIER_SLOTS.flatMap((n) => [`t${n}Basis`, `t${n}Threshold`, `t${n}Discount`] as TierField[]);

export type PriceField =
  | "sku" | "crossRefs" | "price" | "currency" | "priceBasis" | "pricePlace"
  | "priceValidUntil" | "stock" | "moq" | "leadDays" | "originCountry" | "priceDzd" | TierField;
export const PRICE_FIELDS: PriceField[] = ["sku", "crossRefs", "price", "currency", "priceBasis", "pricePlace", "priceValidUntil", "stock", "moq", "leadDays", "originCountry", "priceDzd", ...TIER_FIELDS];
export type PackField = `pk${1 | 2 | 3 | 4}${"Qty" | "Type" | "Weight" | "Length" | "Width" | "Height"}` | "pkLabel" | "pkWedging" | "pkProtection" | "pkNotes";

const has = (list: readonly string[], v: string) => list.includes(v);
// Nombre facultatif >= 0 : null si vide, NaN si invalide.
const optAmount = (s: string) => (s === "" ? null : (parseAmount(s) ?? NaN));
const optInt = (s: string, max: number) => {
  const v = s.replace(/\s/g, "");
  if (v === "") return null;
  return /^\d{1,9}$/.test(v) && Number(v) <= max ? Number(v) : NaN;
};

// Prix, validite, stock, MOQ, delai, origine. "publishing" : la date de validite devient obligatoire.
export function readPriceInput(v: Record<PriceField, string>, today: string, publishing: boolean) {
  const errors: Partial<Record<PriceField, string>> = {};
  const sku = v.sku.trim();
  if (sku.length > 60) errors.sku = "errorSku";
  const crossRefs = [...new Set(v.crossRefs.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))];
  if (crossRefs.length > 20 || crossRefs.some((r) => r.length > 60)) errors.crossRefs = "errorCrossRefs";

  const price = parseAmount(v.price);
  if (price === null || price <= 0) errors.price = "errorPrice";
  if (!has(PRICE_BASES, v.priceBasis)) errors.priceBasis = "errorChoose";
  // Prix export : EUR ou USD seulement ; prix en dinars HT obligatoire a cote.
  if (!has(EXPORT_CURRENCIES, v.currency)) errors.currency = "errorExportCurrency";
  const priceDzd = parseAmount(v.priceDzd);
  if (priceDzd === null || priceDzd <= 0) errors.priceDzd = "errorPriceDzd";
  const tiers = readDiscountTiers((k) => v[k] ?? "");
  Object.assign(errors, tiers.errors);
  if (v.pricePlace.length > 120) errors.pricePlace = "errorTooLong";
  if (v.priceValidUntil) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.priceValidUntil) || v.priceValidUntil < today) errors.priceValidUntil = "errorValidUntil";
  } else if (publishing) errors.priceValidUntil = "errorValidUntilRequired";
  const stock = optAmount(v.stock);
  if (Number.isNaN(stock)) errors.stock = "errorAmount";
  const moq = parseAmount(v.moq);
  if (moq === null || moq <= 0) errors.moq = "errorMoq";
  const leadDays = optInt(v.leadDays, 365);
  if (Number.isNaN(leadDays)) errors.leadDays = "errorLeadDays";
  const origin = (v.originCountry || "DZ").toUpperCase();
  if (!isCountryCode(origin)) errors.originCountry = "errorChoose";

  const fields = {
    sku: sku || null,
    cross_refs: crossRefs,
    currency: v.currency,
    price_dzd_ht: priceDzd,
    // null : le produit suit la grille de remise par defaut du fournisseur.
    discount_tiers: tiers.tiers,
    price_place: v.pricePlace || null,
    price_valid_until: v.priceValidUntil || null,
    stock_quantity: stock !== null && !Number.isNaN(stock) ? stock : null,
    min_order_quantity: moq,
    lead_time_days: leadDays !== null && !Number.isNaN(leadDays) ? leadDays : null,
    origin_country: origin,
    unit_price_ht: price,
    price_basis: v.priceBasis,
    // Anciens couts du prix construit : effaces a la premiere modification.
    product_cost: null,
    packaging_cost: null,
  };
  return { errors, fields };
}

// Paliers de remise (facultatifs) : tout vide = null. Un palier commence = base, seuil et remise
// obligatoires ; seuil > 0 ; remise de 0,1 a 50 %.
export function readDiscountTiers(get: (k: TierField) => string): { errors: Partial<Record<TierField, string>>; tiers: DiscountTier[] | null } {
  const errors: Partial<Record<TierField, string>> = {};
  const tiers: DiscountTier[] = [];
  for (const n of TIER_SLOTS) {
    const basis = get(`t${n}Basis`).trim(), rawT = get(`t${n}Threshold`).trim(), rawD = get(`t${n}Discount`).trim();
    if (!rawT && !rawD) continue;
    if (!has(TIER_BASES, basis)) errors[`t${n}Basis`] = "errorChoose";
    const threshold = parseAmount(rawT);
    if (threshold === null || threshold <= 0) errors[`t${n}Threshold`] = "errorTierThreshold";
    const discount = parseAmount(rawD.replace("%", ""));
    if (discount === null || discount <= 0 || discount > 50) errors[`t${n}Discount`] = "errorTierDiscount";
    if (!errors[`t${n}Basis`] && !errors[`t${n}Threshold`] && !errors[`t${n}Discount`]) tiers.push({ basis: basis as DiscountTier["basis"], threshold: threshold!, discount: discount! });
  }
  return { errors, tiers: tiers.length ? tiers : null };
}

// Valeurs de formulaire a partir de paliers enregistres.
export function tierValues(tiers: unknown): Record<TierField, string> {
  const list = Array.isArray(tiers) ? (tiers as DiscountTier[]) : [];
  const out = {} as Record<TierField, string>;
  for (const n of TIER_SLOTS) {
    const t = list[n - 1];
    out[`t${n}Basis`] = t?.basis ?? "";
    out[`t${n}Threshold`] = t ? String(t.threshold) : "";
    out[`t${n}Discount`] = t ? String(t.discount) : "";
  }
  return out;
}

export { reachedTier } from "@/lib/discount-tiers";

// Conditionnement : tout est facultatif ; un nombre saisi doit etre valide.
export function readPackagingInput(get: (k: PackField) => string) {
  const errors: Partial<Record<PackField, string>> = {};
  let any = false;
  const levels: PackLevel[] = PACK_LEVELS.map((n) => {
    const num = (k: PackField, max: number, int = false) => {
      const raw = get(k).trim();
      if (raw) any = true;
      const val = int ? optInt(raw, max) : optAmount(raw);
      if (val !== null && (Number.isNaN(val) || val <= 0 || val > max)) { errors[k] = "errorPositive"; return null; }
      return val;
    };
    const type = get(`pk${n}Type`).trim();
    if (type) any = true;
    if (type && !has(PACK_TYPES, type)) errors[`pk${n}Type`] = "errorChoose";
    return {
      qty: num(`pk${n}Qty`, 1_000_000, true),
      type: type && has(PACK_TYPES, type) ? type : null,
      weight_kg: num(`pk${n}Weight`, 5000),
      length_mm: num(`pk${n}Length`, 15000, true),
      width_mm: num(`pk${n}Width`, 5000, true),
      height_mm: num(`pk${n}Height`, 5000, true),
    };
  });
  const pick = (k: PackField, list: readonly string[]) => {
    const val = get(k).trim();
    if (!val) return null;
    any = true;
    if (!has(list, val)) { errors[k] = "errorChoose"; return null; }
    return val;
  };
  const label = pick("pkLabel", PACK_LABELS);
  const wedging = pick("pkWedging", PACK_WEDGING);
  const protection = pick("pkProtection", PACK_PROTECTIONS);
  const notes = get("pkNotes").trim();
  if (notes) any = true;
  if (notes.length > 1000) errors.pkNotes = "errorTooLong";
  const spec: PackagingSpec | null = any ? { levels, label, wedging, protection, notes: notes || null } : null;
  return { errors, spec };
}

// Valeurs de formulaire a partir d'une fiche de conditionnement enregistree.
export function packagingValues(spec: unknown): Record<PackField, string> {
  const s = (spec && typeof spec === "object" ? spec : {}) as Partial<PackagingSpec>;
  const str = (x: unknown) => (x === null || x === undefined ? "" : String(x));
  const out = {} as Record<PackField, string>;
  for (const n of PACK_LEVELS) {
    const l = (s.levels?.[n - 1] ?? {}) as Partial<PackLevel>;
    out[`pk${n}Qty`] = str(l.qty);
    out[`pk${n}Type`] = str(l.type);
    out[`pk${n}Weight`] = str(l.weight_kg);
    out[`pk${n}Length`] = str(l.length_mm);
    out[`pk${n}Width`] = str(l.width_mm);
    out[`pk${n}Height`] = str(l.height_mm);
  }
  out.pkLabel = str(s.label);
  out.pkWedging = str(s.wedging);
  out.pkProtection = str(s.protection);
  out.pkNotes = str(s.notes);
  return out;
}

export const PACK_FIELDS: PackField[] = Object.keys(packagingValues(null)) as PackField[];

export const todayIso = () => new Date().toISOString().slice(0, 10);

// Etat du prix pour le catalogue : sans date, expire, bientot expire (7 jours), valide.
export function priceStatus(validUntil: string | null, today: string): { state: "none" | "expired" | "soon" | "ok"; days: number } {
  if (!validUntil) return { state: "none", days: 0 };
  const days = Math.round((Date.parse(`${validUntil}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5);
  return { state: days < 0 ? "expired" : days <= 7 ? "soon" : "ok", days };
}
