// Lots 6c et 6d : calcul automatique de l'offre depuis la liste de prix des fournisseurs et les
// devis recus par ligne. Fonction pure (aucun acces a la base), partagee par l'apercu de la console
// et l'action serveur qui cree les brouillons. Regles d'Adlene (14 au 17 novembre 2026) :
//   - une offre par couple (mode d'affaire, devise) : jamais deux modes ni deux devises ;
//   - intermediation : offre dans la devise du fournisseur, commission de la grille calculee
//     sur le total de TOUTE la demande ; assurance 1 % et fret si forfait Pro ou Enterprise ;
//   - export par AFRICA NEX : offre dans la devise de l'acheteur, prix en dinars converti au
//     taux de reference, marge de change 2 %, assurance 1 % toujours, fret gere par AFRICA NEX ;
//     la marge negociee reste secrete et se saisit au cas par cas (aucune valeur par defaut) ;
//   - un stock insuffisant n'exclut pas un prix : le delai de production est signale ;
//   - la remise maximale du fournisseur est montree a AFRICA NEX, jamais appliquee d'office ;
//   - ligne sans prix : consultation des producteurs pour cette ligne ; le devis valide le moins
//     cher entre dans le calcul, sauf si AFRICA NEX en retient un autre.
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

// Un devis recu pour une ligne (fonction offer_auto_quotes).
export type AutoQuoteRow = {
  line_id: string;
  quote_id: string;
  quote_status: string;
  unit_price_ht: number | string | null;
  currency: string | null;
  price_basis: string | null;
  port_of_loading: string | null;
  quantity: number | string | null;
  production_lead_days: number | null;
  valid_until: string | null;
  company_id: string;
  company_name: string;
  subscription_tier: string | null;
  export_mode: string | null;
  chosen: boolean;
};

export type AutoContext = {
  rows: AutoInputRow[];
  quotes?: AutoQuoteRow[];
  buyerCurrency: string | null;
  requestedIncoterm: string | null;
  rates: Partial<Record<"EUR" | "USD", number>>;
  today: string; // AAAA-MM-JJ
};

// Ligne non chiffrable (bloquant) : elle reste hors de l'offre ; AFRICA NEX consulte les producteurs.
export type LineIssue =
  | "noProduct" | "noQuantity" | "unitMismatch" | "noMode" | "noExportPrice" | "noDzdPrice"
  | "priceExpired" | "noBuyerCurrency" | "noRate";
// Signalements non bloquants, montres a AFRICA NEX.
export type LineWarning = "stockShort" | "stockUnknown" | "belowMoq" | "noPriceValidity" | "productOffline" | "quoteQuantityShort";

export type PricedLine = {
  row: AutoInputRow;
  source: "catalog" | "quote";
  quoteId: string | null;
  quotesUsable: number; // devis utilisables recus pour cette ligne
  companyId: string | null;
  supplierName: string | null;
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

export type SkippedLine = { row: AutoInputRow; issue: LineIssue; quotesReceived: number };

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

// D'ou vient le prix d'une ligne : la liste de prix du produit, ou un devis recu pour la ligne.
type Source = {
  kind: "catalog" | "quote";
  quoteId: string | null;
  chosen: boolean;
  companyId: string | null;
  companyName: string | null;
  tier: string | null;
  mode: string | null;
  exportPrice: number | null; // EUR ou USD
  exportCurrency: string | null;
  priceDzd: number | null;
  basis: string | null;
  place: string | null;
  validUntil: string | null;
  leadDays: number | null;
  stock: number | null;
  moq: number | null;
  offeredQuantity: number | null;
  tiers: DiscountTier[];
  productStatus: string | null;
};

const catalogSource = (row: AutoInputRow): Source => ({
  kind: "catalog",
  quoteId: null,
  chosen: false,
  companyId: row.company_id,
  companyName: row.company_name,
  tier: row.subscription_tier,
  mode: row.export_mode,
  exportPrice: num(row.unit_price_ht),
  exportCurrency: row.currency,
  priceDzd: num(row.price_dzd_ht),
  basis: row.price_basis,
  place: row.price_place,
  validUntil: row.price_valid_until,
  leadDays: row.lead_time_days,
  stock: num(row.stock_quantity),
  moq: num(row.min_order_quantity),
  offeredQuantity: null,
  tiers: tiersOf(row.discount_tiers),
  productStatus: row.product_status,
});

// Un devis porte un seul prix, dans une devise : en dinars il sert l'export par AFRICA NEX,
// en EUR ou USD l'intermediation.
const quoteSource = (q: AutoQuoteRow): Source => {
  const price = num(q.unit_price_ht);
  return {
    kind: "quote",
    quoteId: q.quote_id,
    chosen: q.chosen,
    companyId: q.company_id,
    companyName: q.company_name,
    tier: q.subscription_tier,
    mode: q.export_mode,
    exportPrice: q.currency === "DZD" ? null : price,
    exportCurrency: q.currency,
    priceDzd: q.currency === "DZD" ? price : null,
    basis: q.price_basis,
    place: q.port_of_loading,
    validUntil: q.valid_until,
    leadDays: q.production_lead_days,
    stock: null,
    moq: null,
    offeredQuantity: num(q.quantity),
    tiers: [],
    productStatus: null,
  };
};

// Ligne chiffrable : cout fournisseur dans la devise de l'offre.
type Eligible = {
  row: AutoInputRow; source: Source; mode: ExportMode; currency: Currency; quantity: number; supplierUnitPrice: number;
  supplierCurrency: Currency; fxRate: number | null; base: number; warnings: LineWarning[];
};

function evaluate(row: AutoInputRow, quantity: number, s: Source, ctx: AutoContext): Eligible | LineIssue {
  if (s.mode !== "self" && s.mode !== "africanex") return "noMode";
  if (s.validUntil && s.validUntil < ctx.today) return "priceExpired";

  const warnings: LineWarning[] = [];
  if (s.kind === "catalog") {
    if (!s.validUntil) warnings.push("noPriceValidity");
    if (s.productStatus && s.productStatus !== "published") warnings.push("productOffline");
    if (s.stock === null) warnings.push("stockUnknown");
    else if (s.stock < quantity) warnings.push("stockShort");
    if (s.moq !== null && quantity < s.moq) warnings.push("belowMoq");
  } else if (s.offeredQuantity !== null && s.offeredQuantity < quantity) {
    warnings.push("quoteQuantityShort");
  }
  const base = { row, source: s, quantity, warnings };

  if (s.mode === "self") {
    if (s.exportPrice === null || s.exportPrice <= 0 || !isExportCurrency(s.exportCurrency)) return "noExportPrice";
    return { ...base, mode: "self", currency: s.exportCurrency, supplierUnitPrice: s.exportPrice, supplierCurrency: s.exportCurrency, fxRate: null, base: round2(s.exportPrice * quantity) };
  }
  if (s.priceDzd === null || s.priceDzd <= 0) return "noDzdPrice";
  if (!isCurrency(ctx.buyerCurrency)) return "noBuyerCurrency";
  if (ctx.buyerCurrency === "DZD") {
    return { ...base, mode: "africanex", currency: "DZD", supplierUnitPrice: s.priceDzd, supplierCurrency: "DZD", fxRate: null, base: round2(s.priceDzd * quantity) };
  }
  const rate = ctx.rates[ctx.buyerCurrency];
  if (!rate || rate <= 0) return "noRate";
  return { ...base, mode: "africanex", currency: ctx.buyerCurrency, supplierUnitPrice: s.priceDzd, supplierCurrency: "DZD", fxRate: rate, base: round2((s.priceDzd * quantity) / rate) };
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
  const eligible: (Eligible & { quotesUsable: number })[] = [];
  const usdRate = ctx.rates.USD ?? DZD_PER_USD;
  const ref = (e: Eligible) => (e.currency === "DZD" ? e.base / usdRate : e.base);

  for (const row of [...ctx.rows].sort((a, b) => a.line_position - b.line_position)) {
    const quotes = (ctx.quotes ?? []).filter((q) => q.line_id === row.line_id);
    const quantity = num(row.line_quantity);
    if (quantity === null || quantity <= 0) { skipped.push({ row, issue: "noQuantity", quotesReceived: quotes.length }); continue; }

    const catalog: Eligible | LineIssue = !row.product_id
      ? "noProduct"
      : row.line_unit && row.product_unit && row.line_unit !== row.product_unit
        ? "unitMismatch"
        : evaluate(row, quantity, catalogSource(row), ctx);
    const usable = quotes.map((q) => evaluate(row, quantity, quoteSource(q), ctx)).filter((e): e is Eligible => typeof e !== "string");
    const cheapest = [...usable].sort((a, b) => ref(a) - ref(b))[0];
    // Priorite : devis retenu par AFRICA NEX, puis liste de prix valide, puis devis le moins cher.
    const pick = usable.find((e) => e.source.chosen) ?? (typeof catalog !== "string" ? catalog : cheapest);
    if (pick) eligible.push({ ...pick, quotesUsable: usable.length });
    else skipped.push({ row, issue: catalog as LineIssue, quotesReceived: quotes.length });
  }

  // Palier de commission sur le total de la demande (EUR et USD ont les memes seuils).
  const demandTotalRef = round2(eligible.reduce((s, e) => s + ref(e), 0));
  const commissionRate = commissionRateFor(demandTotalRef, "USD");

  const priced: PricedLine[] = eligible.map((e) => {
    const { row, source: s } = e;
    const detailed = s.tier === "pro" || s.tier === "enterprise";
    const africanexFreight = e.mode === "africanex" || detailed;
    const insuranceRate = africanexFreight ? DEFAULT_INSURANCE_RATE : 0;
    // En dinars, pas de conversion : pas de marge de change.
    const earningRate = e.mode === "self" ? commissionRate : e.fxRate ? FX_MARGIN_RATE : 0;
    const p = priceLine(e.base, e.quantity, insuranceRate, earningRate);
    const tierAmount = s.exportPrice !== null && s.exportPrice > 0 ? s.exportPrice * e.quantity : e.supplierUnitPrice * e.quantity;
    const tier = reachedTier(s.tiers, e.quantity, tierAmount);
    // Starter : le prix est donne a l'incoterm du fournisseur. Sinon AFRICA NEX livre a l'incoterm demande.
    const incoterm = africanexFreight ? (ctx.requestedIncoterm ?? (detailed ? "FCA" : null)) : s.basis;
    return {
      row,
      source: s.kind,
      quoteId: s.quoteId,
      quotesUsable: e.quotesUsable,
      companyId: s.companyId,
      supplierName: s.companyName,
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
      incotermPlace: africanexFreight ? null : s.place,
      leadDays: s.leadDays,
      availability: s.stock === null ? (s.kind === "quote" ? "production" : null) : s.stock >= e.quantity ? "stock" : "production",
      maxDiscountRate: tier ? tier.discount : null,
      africanexFreight,
      warnings: e.warnings,
    };
  });

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
      const validities = eligible
        .filter((e) => lines.some((l) => l.row.line_id === e.row.line_id))
        .map((e) => e.source.validUntil)
        .filter((d): d is string => !!d)
        .sort();
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
