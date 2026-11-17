// Lot 6c : calcul automatique de l'offre depuis la liste de prix des fournisseurs.
// Fonction pure (aucun acces a la base), partagee par l'apercu de la console et l'action
// serveur qui cree les brouillons. Regles d'Adlene (14 au 17 novembre 2026) :
//   - une offre par couple (mode d'affaire, devise) : jamais deux modes ni deux devises ;
//   - intermediation : offre dans la devise du fournisseur, commission de la grille calculee
//     sur le total de TOUTE la demande ; assurance 1 % et fret si forfait Pro ou Enterprise ;
//   - export par AFRICA NEX : offre dans la devise de l'acheteur, prix en dinars converti au
//     taux de reference, marge de change 2 %, assurance 1 % toujours, fret gere par AFRICA NEX ;
//     la marge negociee reste secrete et se saisit au cas par cas (aucune valeur par defaut) ;
//   - un stock insuffisant n'exclut pas un prix : le delai de production est signale ;
//   - la remise maximale du fournisseur est montree a AFRICA NEX, jamais appliquee d'office.
import { DEFAULT_INSURANCE_RATE, DZD_PER_USD, commissionRateFor, round2 } from "./offer-pricing";
import { reachedTier, type DiscountTier } from "./discount-tiers";

export const FX_MARGIN_RATE = 2;
export const OFFER_VALIDITY_DAYS = 30;

export type ExportMode = "self" | "africanex";
type Currency = "DZD" | "EUR" | "USD";

// Une ligne de la demande avec son produit et son fournisseur (fonction offer_auto_inputs).
export type AutoInputRow = {
  line_id: string;
  line_position: number;
  line_description: string;
  line_reference: string | null;
  line_quantity: number | string | null;
  line_unit: string | null;
  product_id: string | null;
  product_name: string | null;
  product_status: string | null;
  product_unit: string | null;
  unit_price_ht: number | string | null;
  currency: string | null;
  price_basis: string | null;
  price_place: string | null;
  price_valid_until: string | null;
  price_dzd_ht: number | string | null;
  stock_quantity: number | string | null;
  lead_time_days: number | null;
  min_order_quantity: number | string | null;
  discount_tiers: unknown;
  company_id: string | null;
  company_name: string | null;
  subscription_tier: string | null;
  export_mode: string | null;
};

export type AutoContext = {
  rows: AutoInputRow[];
  buyerCurrency: string | null;
  requestedIncoterm: string | null;
  rates: Partial<Record<"EUR" | "USD", number>>;
  today: string; // AAAA-MM-JJ
};

// Ligne non chiffrable (bloquant) : elle reste hors de l'offre et part au lot 6d.
export type LineIssue =
  | "noProduct" | "noQuantity" | "unitMismatch" | "noMode" | "noExportPrice" | "noDzdPrice"
  | "priceExpired" | "noBuyerCurrency" | "noRate";
// Signalements non bloquants, montres a AFRICA NEX.
export type LineWarning = "stockShort" | "stockUnknown" | "belowMoq" | "noPriceValidity" | "productOffline";

export type PricedLine = {
  row: AutoInputRow;
  mode: ExportMode;
  currency: Currency; // devise de l'offre
  quantity: number;
  supplierUnitPrice: number;
  supplierCurrency: Currency;
  fxRate: number | null;
  base: number; // cout fournisseur dans la devise de l'offre
  commissionRate: number;
  commission: number;
  insuranceRate: number;
  insurance: number;
  fxMarginRate: number;
  fxMargin: number;
  unitPrice: number; // prix acheteur hors fret
  total: number;
  incoterm: string | null;
  incotermPlace: string | null;
  leadDays: number | null;
  availability: "stock" | "production" | null;
  maxDiscountRate: number | null;
  africanexFreight: boolean; // fret et assurance geres par AFRICA NEX
  warnings: LineWarning[];
};

export type SkippedLine = { row: AutoInputRow; issue: LineIssue };

export type AutoOffer = {
  mode: ExportMode;
  currency: Currency;
  lines: PricedLine[];
  base: number;
  commission: number;
  insurance: number;
  fxMargin: number;
  total: number; // hors fret et hors marge negociee
  commissionRate: number;
  insuranceRate: number;
  fxMarginRate: number;
  fxRate: number | null;
  incoterm: string | null;
  mixedIncoterms: boolean;
  leadDays: number | null;
  validUntil: string;
  marginPending: boolean;
  freightPending: boolean;
  maxDiscountAmount: number; // remise maximale cumulee, en devise de l'offre (indicatif)
};

export type AutoResult = {
  offers: AutoOffer[];
  skipped: SkippedLine[];
  demandTotalRef: number; // total de la demande ramene en EUR/USD, base du palier
  commissionRate: number;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const isExportCurrency = (c: string | null): c is "EUR" | "USD" => c === "EUR" || c === "USD";
const isCurrency = (c: string | null): c is Currency => c === "DZD" || isExportCurrency(c);

function addDays(day: string, days: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function tiersOf(v: unknown): DiscountTier[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (t): t is DiscountTier =>
      !!t && (t.basis === "qty" || t.basis === "amount") && Number.isFinite(Number(t.threshold)) && Number.isFinite(Number(t.discount)),
  ).map((t) => ({ basis: t.basis, threshold: Number(t.threshold), discount: Number(t.discount) }));
}

// Premiere passe : la ligne est-elle chiffrable, et a quel cout (devise de l'offre) ?
type Eligible = {
  row: AutoInputRow; mode: ExportMode; currency: Currency; quantity: number; supplierUnitPrice: number;
  supplierCurrency: Currency; fxRate: number | null; base: number; warnings: LineWarning[];
};

function examine(row: AutoInputRow, ctx: AutoContext): Eligible | SkippedLine {
  if (!row.product_id) return { row, issue: "noProduct" };
  const quantity = num(row.line_quantity);
  if (quantity === null || quantity <= 0) return { row, issue: "noQuantity" };
  if (row.line_unit && row.product_unit && row.line_unit !== row.product_unit) return { row, issue: "unitMismatch" };
  if (row.export_mode !== "self" && row.export_mode !== "africanex") return { row, issue: "noMode" };
  if (row.price_valid_until && row.price_valid_until < ctx.today) return { row, issue: "priceExpired" };

  const warnings: LineWarning[] = [];
  if (!row.price_valid_until) warnings.push("noPriceValidity");
  if (row.product_status && row.product_status !== "published") warnings.push("productOffline");
  const stock = num(row.stock_quantity);
  if (stock === null) warnings.push("stockUnknown");
  else if (stock < quantity) warnings.push("stockShort");
  const moq = num(row.min_order_quantity);
  if (moq !== null && quantity < moq) warnings.push("belowMoq");

  if (row.export_mode === "self") {
    const price = num(row.unit_price_ht);
    if (price === null || price <= 0 || !isExportCurrency(row.currency)) return { row, issue: "noExportPrice" };
    return { row, mode: "self", currency: row.currency, quantity, supplierUnitPrice: price, supplierCurrency: row.currency, fxRate: null, base: round2(price * quantity), warnings };
  }

  const dzd = num(row.price_dzd_ht);
  if (dzd === null || dzd <= 0) return { row, issue: "noDzdPrice" };
  if (!isCurrency(ctx.buyerCurrency)) return { row, issue: "noBuyerCurrency" };
  if (ctx.buyerCurrency === "DZD") {
    return { row, mode: "africanex", currency: "DZD", quantity, supplierUnitPrice: dzd, supplierCurrency: "DZD", fxRate: null, base: round2(dzd * quantity), warnings };
  }
  const rate = ctx.rates[ctx.buyerCurrency];
  if (!rate || rate <= 0) return { row, issue: "noRate" };
  return { row, mode: "africanex", currency: ctx.buyerCurrency, quantity, supplierUnitPrice: dzd, supplierCurrency: "DZD", fxRate: rate, base: round2((dzd * quantity) / rate), warnings };
}

// Prix acheteur d'une ligne : cout + pourcentages, arrondi au centime par unite ;
// l'ecart d'arrondi est absorbe par la remuneration d'AFRICA NEX (commission ou marge de change).
function priceLine(base: number, quantity: number, insuranceRate: number, earningRate: number) {
  const unitPrice = round2((base * (1 + (insuranceRate + earningRate) / 100)) / quantity);
  const total = round2(unitPrice * quantity);
  const insurance = round2((base * insuranceRate) / 100);
  const earning = round2(total - base - insurance);
  return { unitPrice, total, insurance, earning };
}

export function computeAutoOffers(ctx: AutoContext): AutoResult {
  const skipped: SkippedLine[] = [];
  const eligible: Eligible[] = [];
  for (const row of [...ctx.rows].sort((a, b) => a.line_position - b.line_position)) {
    const r = examine(row, ctx);
    if ("issue" in r) skipped.push(r);
    else eligible.push(r);
  }

  // Palier de commission sur le total de la demande (EUR et USD ont les memes seuils).
  const usdRate = ctx.rates.USD ?? DZD_PER_USD;
  const demandTotalRef = round2(eligible.reduce((s, e) => s + (e.currency === "DZD" ? e.base / usdRate : e.base), 0));
  const commissionRate = commissionRateFor(demandTotalRef, "USD");

  const priced: PricedLine[] = eligible.map((e) => {
    const { row } = e;
    const detailed = row.subscription_tier === "pro" || row.subscription_tier === "enterprise";
    const africanexFreight = e.mode === "africanex" || detailed;
    const insuranceRate = africanexFreight ? DEFAULT_INSURANCE_RATE : 0;
    const earningRate = e.mode === "self" ? commissionRate : FX_MARGIN_RATE;
    const p = priceLine(e.base, e.quantity, insuranceRate, earningRate);
    const stock = num(row.stock_quantity);
    const exportPrice = num(row.unit_price_ht);
    const tierAmount = exportPrice !== null && exportPrice > 0 ? exportPrice * e.quantity : e.supplierUnitPrice * e.quantity;
    const tier = reachedTier(tiersOf(row.discount_tiers), e.quantity, tierAmount);
    // Starter : le prix est donne a l'incoterm du fournisseur. Sinon AFRICA NEX livre a l'incoterm demande.
    const incoterm = africanexFreight ? (ctx.requestedIncoterm ?? (detailed ? "FCA" : null)) : row.price_basis;
    return {
      row,
      mode: e.mode,
      currency: e.currency,
      quantity: e.quantity,
      supplierUnitPrice: e.supplierUnitPrice,
      supplierCurrency: e.supplierCurrency,
      fxRate: e.fxRate,
      base: e.base,
      commissionRate: e.mode === "self" ? commissionRate : 0,
      commission: e.mode === "self" ? p.earning : 0,
      insuranceRate,
      insurance: p.insurance,
      fxMarginRate: e.mode === "africanex" && e.fxRate ? FX_MARGIN_RATE : 0,
      fxMargin: e.mode === "africanex" ? p.earning : 0,
      unitPrice: p.unitPrice,
      total: p.total,
      incoterm,
      incotermPlace: africanexFreight ? null : row.price_place,
      leadDays: row.lead_time_days,
      availability: stock === null ? null : stock >= e.quantity ? "stock" : "production",
      maxDiscountRate: tier ? tier.discount : null,
      africanexFreight,
      warnings: e.warnings,
    };
  });
  // En dinars, pas de conversion : pas de marge de change, la ligne reste au cout + assurance.
  for (const l of priced) {
    if (l.mode === "africanex" && !l.fxRate) {
      const p = priceLine(l.base, l.quantity, l.insuranceRate, 0);
      Object.assign(l, { unitPrice: p.unitPrice, total: p.total, insurance: p.insurance, fxMargin: p.earning });
    }
  }

  const groups = new Map<string, PricedLine[]>();
  for (const l of priced) {
    const key = `${l.mode}:${l.currency}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  const maxValid = addDays(ctx.today, OFFER_VALIDITY_DAYS);
  const offers: AutoOffer[] = [...groups.values()]
    .map((lines) => {
      const first = lines[0];
      const sum = (f: (l: PricedLine) => number) => round2(lines.reduce((s, l) => s + f(l), 0));
      const incoterms = new Set(lines.map((l) => l.incoterm ?? ""));
      const freightPending = lines.some((l) => l.africanexFreight);
      const validities = lines.map((l) => l.row.price_valid_until).filter((d): d is string => !!d).sort();
      const leads = lines.map((l) => l.leadDays).filter((d): d is number => d !== null);
      return {
        mode: first.mode,
        currency: first.currency,
        lines,
        base: sum((l) => l.base),
        commission: sum((l) => l.commission),
        insurance: sum((l) => l.insurance),
        fxMargin: sum((l) => l.fxMargin),
        total: sum((l) => l.total),
        commissionRate: first.mode === "self" ? commissionRate : 0,
        insuranceRate: lines.some((l) => l.insuranceRate > 0) ? DEFAULT_INSURANCE_RATE : 0,
        fxMarginRate: first.fxMarginRate,
        fxRate: first.fxRate,
        incoterm: freightPending ? (ctx.requestedIncoterm ?? first.incoterm) : incoterms.size === 1 ? first.incoterm : null,
        mixedIncoterms: incoterms.size > 1,
        leadDays: leads.length ? Math.max(...leads) : null,
        validUntil: validities.length && validities[0] < maxValid ? validities[0] : maxValid,
        marginPending: first.mode === "africanex",
        freightPending,
        maxDiscountAmount: sum((l) => (l.maxDiscountRate ? (l.base * l.maxDiscountRate) / 100 : 0)),
      };
    })
    .sort((a, b) => (a.mode === b.mode ? a.currency.localeCompare(b.currency) : a.mode === "self" ? -1 : 1));

  return { offers, skipped, demandTotalRef, commissionRate };
}
