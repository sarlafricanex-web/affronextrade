// Tests de la saisie sur une offre calculee (lot 6e) : commission modifiee, marge negociee en %
// ou en montant, fret en ligne separee. Hors ligne. Lancement : npm run test:unit
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try { return next(`${specifier}.ts`, context); } catch { /* resolution normale */ }
    }
    return next(specifier, context);
  },
});

const { repriceOffer } = await import("../../src/lib/offer-reprice.ts");
const { computeAutoOffers } = await import("../../src/lib/offer-auto.ts");

const line = (over = {}) => ({ quantity: 100, base: 1000, insuranceRate: 0, fxMarginRate: 0, ...over });

test("intermediation : meme prix que le calcul automatique au taux de la grille", () => {
  const auto = computeAutoOffers({
    rows: [{ line_id: "l1", line_position: 1, line_description: "Huile", line_reference: null, line_quantity: 7, line_unit: "carton", product_id: "p", product_name: "Huile", product_status: "published", product_unit: "carton", unit_price_ht: 3.33, currency: "EUR", price_basis: "FOB", price_place: null, price_valid_until: "2026-12-31", price_dzd_ht: null, stock_quantity: 100, lead_time_days: 5, min_order_quantity: null, discount_tiers: null, company_id: "c", company_name: "C", subscription_tier: "pro", export_mode: "self" }],
    buyerCurrency: "EUR", requestedIncoterm: "CIF", rates: {}, today: "2026-11-19",
  }).offers[0];
  const r = repriceOffer({ mode: "self", commissionRate: auto.commissionRate, margin: null, freight: null, lines: [line({ quantity: 7, base: auto.base, insuranceRate: 1 })] });
  assert.equal(r.lines[0].unitPrice, auto.lines[0].unitPrice);
  assert.equal(r.total, auto.total);
  assert.equal(r.commission, auto.commission);
});

test("intermediation : commission modifiee offre par offre", () => {
  const r = repriceOffer({ mode: "self", commissionRate: 5, margin: null, freight: null, lines: [line({ insuranceRate: 1 })] });
  assert.equal(r.lines[0].unitPrice, 10.6);
  assert.equal(r.commission, 50);
  assert.equal(r.insurance, 10);
  assert.equal(r.total, 1060);
});

test("fret : ligne separee, ajoute au total mais pas aux prix unitaires", () => {
  const r = repriceOffer({ mode: "self", commissionRate: 10, margin: null, freight: 450, lines: [line()] });
  assert.equal(r.lines[0].unitPrice, 11);
  assert.equal(r.linesTotal, 1100);
  assert.equal(r.freight, 450);
  assert.equal(r.total, 1550);
});

test("export AFRICA NEX, marge en % du cout, en plus du change 2 % et de l'assurance 1 %", () => {
  const r = repriceOffer({ mode: "africanex", commissionRate: 0, margin: { kind: "rate", value: 8 }, freight: null, lines: [line({ insuranceRate: 1, fxMarginRate: 2 })] });
  assert.equal(r.lines[0].unitPrice, 11.1);
  assert.equal(r.insurance, 10);
  assert.equal(r.fxMargin, 20);
  assert.equal(r.margin, 80);
  assert.equal(r.commission, 0);
  assert.equal(r.total, 1110);
});

test("export AFRICA NEX, marge en montant repartie au prorata du cout", () => {
  const r = repriceOffer({ mode: "africanex", commissionRate: 0, margin: { kind: "amount", value: 300 }, freight: null, lines: [line({ base: 1000 }), line({ base: 2000, quantity: 50 })] });
  assert.deepEqual(r.lines.map((l) => l.margin), [100, 200]);
  assert.deepEqual(r.lines.map((l) => l.unitPrice), [11, 44]);
  assert.equal(r.margin, 300);
});

test("marge negociee : arrondi au centime superieur, jamais moins que la marge saisie", () => {
  // 1 000 / 3 unites : le prix exact (343,3333...) est arrondi a 343,34 et non 343,33.
  const r = repriceOffer({ mode: "africanex", commissionRate: 0, margin: { kind: "amount", value: 30 }, freight: null, lines: [line({ quantity: 3, base: 1000 })] });
  assert.equal(r.lines[0].unitPrice, 343.34);
  assert.ok(r.margin >= 30, String(r.margin));
  // Grande quantite : l'arrondi pese, la marge reste au moins celle saisie.
  const big = repriceOffer({ mode: "africanex", commissionRate: 0, margin: { kind: "rate", value: 0.5 }, freight: null, lines: [line({ quantity: 1000, base: 1234.567, insuranceRate: 1, fxMarginRate: 2 })] });
  assert.ok(big.margin >= 6.17, String(big.margin));
  assert.ok(big.fxMargin >= 24.69 - 0.01, String(big.fxMargin));
});

test("export AFRICA NEX sans marge saisie : meme prix que le calcul automatique", () => {
  const r = repriceOffer({ mode: "africanex", commissionRate: 0, margin: null, freight: null, lines: [line({ insuranceRate: 1, fxMarginRate: 2 })] });
  assert.equal(r.lines[0].unitPrice, 10.3);
  assert.equal(r.margin, 0);
  assert.equal(r.fxMargin, 20);
});

test("remise maximale des fournisseurs : cumulee, jamais appliquee", () => {
  const r = repriceOffer({ mode: "self", commissionRate: 10, margin: null, freight: null, lines: [line({ maxDiscountRate: 4 }), line({ maxDiscountRate: null })] });
  assert.equal(r.maxDiscountAmount, 40);
  assert.equal(r.lines[0].unitPrice, 11);
});
