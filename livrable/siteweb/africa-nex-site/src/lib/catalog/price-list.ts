// Regles de la liste de prix fournisseur, communes a l'editeur de produit et a l'import Excel.
// Forfait Starter : prix HT + incoterm (+ lieu), fret et assurance a la charge du fournisseur.
// Forfaits Pro et Enterprise : cout produit + cout emballage = prix FCA (calcule en base).
import { CURRENCIES, parseAmount } from "@/lib/onboarding/reference";
import { isCountryCode } from "@/lib/countries";

export type Tier = "starter" | "pro" | "enterprise";
export const isDetailedTier = (tier: string | null | undefined) => tier === "pro" || tier === "enterprise";
export const STARTER_BASES = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DDP"] as const;

// Conditionnement en 4 niveaux (structure de l'annexe "brief conditionnement").
export const PACK_LEVELS = [1, 2, 3, 4] as const;
export const PACK_TYPES = ["bag", "box", "carton", "carton_case", "wood_case", "plastic_bin", "drum", "jerrycan", "big_bag", "sack", "bulk", "pallet_euro", "pallet_us", "wire_container", "other"] as const;
export const PACK_LABELS = ["supplier", "customer", "neutral", "none"] as const;
export const PACK_PROTECTIONS = ["stretch", "strapping", "stretch_strapping", "film", "none"] as const;
export const PACK_WEDGING = ["yes", "no"] as const;

export type PackLevel = { qty: number | null; type: string | null; weight_kg: number | null; length_mm: number | null; width_mm: number | null; height_mm: number | null };
export type PackagingSpec = { levels: PackLevel[]; label: string | null; wedging: string | null; protection: string | null; notes: string | null };

export type PriceField =
  | "sku" | "crossRefs" | "price" | "productCost" | "packagingCost" | "currency" | "priceBasis" | "pricePlace"
  | "priceValidUntil" | "stock" | "moq" | "leadDays" | "originCountry";
export const PRICE_FIELDS: PriceField[] = ["sku", "crossRefs", "price", "productCost", "packagingCost", "currency", "priceBasis", "pricePlace", "priceValidUntil", "stock", "moq", "leadDays", "originCountry"];
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
export function readPriceInput(v: Record<PriceField, string>, tier: string | null | undefined, today: string, publishing: boolean) {
  const errors: Partial<Record<PriceField, string>> = {};
  const detailed = isDetailedTier(tier);
  const sku = v.sku.trim();
  if (sku.length > 60) errors.sku = "errorSku";
  const crossRefs = [...new Set(v.crossRefs.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))];
  if (crossRefs.length > 20 || crossRefs.some((r) => r.length > 60)) errors.crossRefs = "errorCrossRefs";

  let price: number | null = null;
  let productCost: number | null = null;
  let packagingCost: number | null = null;
  if (detailed) {
    productCost = parseAmount(v.productCost);
    if (productCost === null || productCost <= 0) errors.productCost = "errorCost";
    packagingCost = optAmount(v.packagingCost);
    if (Number.isNaN(packagingCost)) errors.packagingCost = "errorCost";
    if (productCost !== null && packagingCost !== null && !Number.isNaN(packagingCost)) price = productCost + packagingCost;
    else price = productCost;
  } else {
    price = parseAmount(v.price);
    if (price === null || price <= 0) errors.price = "errorPrice";
    if (!has(STARTER_BASES, v.priceBasis)) errors.priceBasis = "errorChoose";
  }
  if (!has(CURRENCIES, v.currency)) errors.currency = "errorChoose";
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
    price_place: v.pricePlace || null,
    price_valid_until: v.priceValidUntil || null,
    stock_quantity: stock !== null && !Number.isNaN(stock) ? stock : null,
    min_order_quantity: moq,
    lead_time_days: leadDays !== null && !Number.isNaN(leadDays) ? leadDays : null,
    origin_country: origin,
    // Pro/Enterprise : le prix FCA est recalcule en base a partir des couts.
    ...(detailed
      ? { product_cost: productCost, packaging_cost: packagingCost !== null && !Number.isNaN(packagingCost) ? packagingCost : 0, unit_price_ht: price, price_basis: "FCA" }
      : { product_cost: null, packaging_cost: null, unit_price_ht: price, price_basis: v.priceBasis }),
  };
  return { errors, fields };
}

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
