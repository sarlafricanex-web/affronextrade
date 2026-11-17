// Tests du calcul automatique de l'offre (lot 6c), hors ligne : aucune base, aucun serveur.
// Lancement : npm run test:unit
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import { test } from "node:test";

// Les modules TypeScript du site importent sans extension ("./offer-pricing") : on la complete.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try { return next(`${specifier}.ts`, context); } catch { /* resolution normale */ }
    }
    return next(specifier, context);
  },
});

const { computeAutoOffers } = await import("../../src/lib/offer-auto.ts");

const TODAY = "2026-11-17";
let n = 0;
function row(over = {}) {
  n += 1;
  return {
    line_id: `line-${n}`, line_position: n, line_description: `Produit ${n}`, line_reference: null,
    line_quantity: 100, line_unit: "carton",
    product_id: `prod-${n}`, product_name: `Produit ${n}`, product_status: "published", product_unit: "carton",
    unit_price_ht: 10, currency: "EUR", price_basis: "FOB", price_place: "Alger", price_valid_until: "2026-12-31",
    price_dzd_ht: 1500, stock_quantity: 1000, lead_time_days: 10, min_order_quantity: 10, discount_tiers: null,
    company_id: "co-1", company_name: "Fournisseur Un", subscription_tier: "starter", export_mode: "self",
    ...over,
  };
}
const ctx = (rows, over = {}) => ({ rows, buyerCurrency: "EUR", requestedIncoterm: "CIF", rates: { EUR: 150, USD: 135 }, today: TODAY, ...over });

test("intermediation Starter : commission seule, incoterm du fournisseur, pas de fret", () => {
  const r = computeAutoOffers(ctx([row()]));
  assert.equal(r.offers.length, 1);
  const o = r.offers[0];
  assert.equal(o.mode, "self");
  assert.equal(o.currency, "EUR");
  assert.equal(r.commissionRate, 10); // 1 000 EUR < 5 000
  assert.equal(o.lines[0].unitPrice, 11);
  assert.equal(o.total, 1100);
  assert.equal(o.commission, 100);
  assert.equal(o.insurance, 0);
  assert.equal(o.incoterm, "FOB");
  assert.equal(o.lines[0].incotermPlace, "Alger");
  assert.equal(o.freightPending, false);
  assert.equal(o.marginPending, false);
});

test("intermediation Pro : commission + assurance 1 %, fret a saisir, incoterm demande", () => {
  const r = computeAutoOffers(ctx([row({ subscription_tier: "pro" })]));
  const o = r.offers[0];
  assert.equal(o.lines[0].unitPrice, 11.1);
  assert.equal(o.insurance, 10);
  assert.equal(o.commission, 100);
  assert.equal(o.freightPending, true);
  assert.equal(o.incoterm, "CIF");
});

test("palier de commission calcule sur le total de toute la demande", () => {
  // 3 lignes de 2 000 EUR : chacune seule serait a 10 %, le total (6 000) passe a 7 %.
  const r = computeAutoOffers(ctx([row({ line_quantity: 200 }), row({ line_quantity: 200 }), row({ line_quantity: 200, currency: "USD" })]));
  assert.equal(r.demandTotalRef, 6000);
  assert.equal(r.commissionRate, 7);
  assert.equal(r.offers.length, 2); // EUR et USD : jamais deux devises dans une offre
  assert.deepEqual(r.offers.map((o) => o.currency), ["EUR", "USD"]);
  for (const o of r.offers) assert.equal(o.commissionRate, 7);
});

test("une offre consolidee pour plusieurs fournisseurs du meme mode et de la meme devise", () => {
  const r = computeAutoOffers(ctx([row({ company_id: "co-1" }), row({ company_id: "co-2", company_name: "Deux" })]));
  assert.equal(r.offers.length, 1);
  assert.equal(r.offers[0].lines.length, 2);
});

test("export AFRICA NEX : devise de l'acheteur, taux de reference, change 2 %, assurance 1 %, marge a saisir", () => {
  const r = computeAutoOffers(ctx([row({ export_mode: "africanex", price_dzd_ht: 1500, line_quantity: 100 })]));
  const o = r.offers[0];
  assert.equal(o.mode, "africanex");
  assert.equal(o.currency, "EUR");
  assert.equal(o.fxRate, 150);
  assert.equal(o.base, 1000); // 150 000 DZD / 150
  assert.equal(o.lines[0].unitPrice, 10.3); // + 1 % assurance + 2 % change
  assert.equal(o.insurance, 10);
  assert.equal(o.fxMargin, 20);
  assert.equal(o.commission, 0);
  assert.equal(o.marginPending, true);
  assert.equal(o.freightPending, true);
  assert.equal(o.lines[0].supplierCurrency, "DZD");
});

test("les deux modes ne se melangent jamais", () => {
  const r = computeAutoOffers(ctx([row(), row({ export_mode: "africanex" })]));
  assert.equal(r.offers.length, 2);
  assert.deepEqual(r.offers.map((o) => o.mode), ["self", "africanex"]);
});

test("lignes non chiffrables : signalees et laissees hors de l'offre", () => {
  const r = computeAutoOffers(ctx([
    row({ product_id: null }),
    row({ line_quantity: null }),
    row({ line_unit: "kg" }),
    row({ export_mode: null }),
    row({ currency: "DZD" }),
    row({ price_valid_until: "2026-11-01" }),
    row({ export_mode: "africanex", price_dzd_ht: null }),
  ]));
  assert.equal(r.offers.length, 0);
  assert.deepEqual(r.skipped.map((s) => s.issue), ["noProduct", "noQuantity", "unitMismatch", "noMode", "noExportPrice", "priceExpired", "noDzdPrice"]);
});

test("export AFRICA NEX sans taux de reference : ligne bloquee", () => {
  const r = computeAutoOffers(ctx([row({ export_mode: "africanex" })], { rates: {} }));
  assert.equal(r.skipped[0].issue, "noRate");
});

test("stock insuffisant : le prix reste propose, le delai de production est signale", () => {
  const r = computeAutoOffers(ctx([row({ stock_quantity: 20, lead_time_days: 45 })]));
  const l = r.offers[0].lines[0];
  assert.equal(l.availability, "production");
  assert.ok(l.warnings.includes("stockShort"));
  assert.equal(r.offers[0].leadDays, 45);
});

test("remise maximale du fournisseur : affichee, jamais appliquee", () => {
  const tiers = [{ basis: "qty", threshold: 50, discount: 3 }, { basis: "amount", threshold: 900, discount: 5 }];
  const r = computeAutoOffers(ctx([row({ discount_tiers: tiers })]));
  const l = r.offers[0].lines[0];
  assert.equal(l.maxDiscountRate, 5);
  assert.equal(l.unitPrice, 11); // prix inchange
  assert.equal(r.offers[0].maxDiscountAmount, 50);
});

test("validite de l'offre : la plus proche des validites de prix, 30 jours au plus", () => {
  const r1 = computeAutoOffers(ctx([row({ price_valid_until: "2026-11-25" }), row({ price_valid_until: "2027-03-01" })]));
  assert.equal(r1.offers[0].validUntil, "2026-11-25");
  const r2 = computeAutoOffers(ctx([row({ price_valid_until: null })]));
  assert.equal(r2.offers[0].validUntil, "2026-12-17");
  assert.ok(r2.offers[0].lines[0].warnings.includes("noPriceValidity"));
});

test("arrondis : total = prix unitaire x quantite, l'ecart va dans la commission", () => {
  const r = computeAutoOffers(ctx([row({ unit_price_ht: 3.33, line_quantity: 7 })]));
  const o = r.offers[0];
  assert.equal(o.lines[0].unitPrice, 3.66);
  assert.equal(o.total, 25.62);
  assert.equal(o.base, 23.31);
  assert.equal(o.commission, 2.31);
});
