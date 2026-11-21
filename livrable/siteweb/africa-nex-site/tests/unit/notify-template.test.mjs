// Tests des emails de notification : mise en page (fonction pure) et textes complets dans les
// trois langues. Lancement : npm run test:unit
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try { return next(`${specifier}.ts`, context); } catch { /* resolution normale */ }
    }
    return next(specifier, context);
  },
});

const { renderEmail } = await import("../../src/lib/notify/template.ts");
const { frDate, money } = await import("../../src/lib/notify/format.ts");
const messages = Object.fromEntries(["fr", "en", "ar"].map((l) => [l, JSON.parse(readFileSync(new URL(`../../messages/${l}.json`, import.meta.url), "utf8")).email]));

// Chaque email envoye par src/lib/notify (nature, variante) et ses cles obligatoires.
const EMAILS = [
  ["new_request"], ["offer_ready"], ["new_message", "buyer"], ["new_message", "producer"],
  ["admin_new_rfq"], ["admin_new_quote"], ["admin_new_quote", "update"],
  ["admin_decision", "accept"], ["admin_decision", "decline"], ["admin_decision", "currency"], ["admin_new_message"],
];

test("chaque email a sujet, titre, introduction et bouton dans les trois langues", () => {
  for (const lang of ["fr", "en", "ar"]) {
    const m = messages[lang];
    for (const [kind, variant] of EMAILS) {
      const k = variant ? `${kind}_${variant}` : kind;
      for (const part of ["subject", "title", "intro"]) assert.ok(m[`${k}_${part}`], `${lang} : ${k}_${part} manquant`);
      assert.ok(m[`${kind}_cta`], `${lang} : ${kind}_cta manquant`);
    }
    for (const key of ["greeting", "greetingNoName", "footer", "footerAdmin"]) assert.ok(m[key], `${lang} : ${key} manquant`);
  }
});

test("les trois langues ont exactement les memes cles", () => {
  const keys = (l) => Object.keys(messages[l]).sort().join();
  assert.equal(keys("en"), keys("fr"));
  assert.equal(keys("ar"), keys("fr"));
});

test("les emails aux utilisateurs ne promettent jamais le texte du message ni le nom de l'autre partie", () => {
  for (const lang of ["fr", "en", "ar"]) {
    const m = messages[lang];
    for (const k of ["new_request_intro", "new_request_note", "offer_ready_intro", "new_message_buyer_intro", "new_message_producer_intro"]) {
      assert.ok(!/\{(buyer|producer|who|body)\}/.test(m[k]), `${lang} : ${k} cite une partie`);
    }
  }
});

const sample = (over = {}) => ({
  locale: "fr", preheader: "Apercu", title: "Votre offre est prete", greeting: "Bonjour Awa,",
  paragraphs: ["AFRICA NEX a prepare l'offre A."], rows: [{ label: "Reference", value: "RFQ-2026-ABC123" }],
  cta: { label: "Voir l'offre", url: "http://localhost:3000/fr/rfq/1#offers" }, footer: "Message de service.", ...over,
});

test("mise en page : lien, lignes de detail, pied de page et version texte", () => {
  const { html, text } = renderEmail(sample());
  assert.ok(html.includes('href="http://localhost:3000/fr/rfq/1#offers"'));
  assert.ok(html.includes("RFQ-2026-ABC123"));
  assert.ok(html.includes('lang="fr"') && html.includes('dir="ltr"'));
  assert.ok(text.includes("Voir l'offre : http://localhost:3000/fr/rfq/1#offers"));
  assert.ok(text.includes("Reference : RFQ-2026-ABC123"));
  assert.ok(text.endsWith("Message de service."));
});

test("mise en page : le texte saisi est neutralise (pas de HTML injecte)", () => {
  const { html } = renderEmail(sample({ paragraphs: ['<script>alert("x")</script>'], title: "A & B" }));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("A &amp; B"));
});

test("mise en page : l'arabe se lit de droite a gauche", () => {
  const { html } = renderEmail(sample({ locale: "ar" }));
  assert.ok(html.includes('lang="ar"') && html.includes('dir="rtl"'));
  assert.ok(html.includes("text-align:right"));
});

test("formats : date et montant lisibles", () => {
  assert.equal(frDate("2026-11-25"), "25/11/2026");
  assert.equal(frDate(null), "-");
  assert.equal(money(1234.5, "EUR"), "1 234,50 EUR");
  assert.equal(money(22.2, "USD"), "22,20 USD");
});
