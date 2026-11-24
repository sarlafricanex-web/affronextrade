// Tests des regles d'acces (RLS), hors ligne : PostgreSQL complet en WebAssembly (PGlite).
// Les schemas auth et storage de Supabase sont simules ; a repasser sur africanex-dev.
// Lancement : npm run test:rls

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = await PGlite.create({ extensions: { pg_trgm } });

const SUPABASE_STUBS = `
  create schema extensions;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, extensions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable
    as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.objects to authenticated;
`;

await db.exec(SUPABASE_STUBS);
for (const file of readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(root, "migrations", file), "utf8"));
}
await db.exec(readFileSync(join(root, "seed.sql"), "utf8"));

const U = {
  buyer: "00000000-0000-0000-0000-0000000000b1",
  buyer2: "00000000-0000-0000-0000-0000000000b2",
  prodA: "00000000-0000-0000-0000-0000000000a1",
  prodB: "00000000-0000-0000-0000-0000000000a2",
  admin: "00000000-0000-0000-0000-0000000000ad",
};

let passed = 0;
const failures = [];

async function as(user, fn) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

async function rows(sql, params = []) {
  return (await db.query(sql, params)).rows;
}

async function check(name, fn) {
  try {
    await fn();
    passed++;
  } catch (e) {
    failures.push(`${name} : ${e.message}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

// Un refus doit venir d'une regle de securite, pas d'une faute dans le SQL du test.
const SECURITY_ERROR =
  /row-level security|permission denied|protected .* fields|role cannot be changed|onboarding cannot|only the dispatch status|invalid dispatch status|violates check constraint|offer not available|forbidden|pending margin or freight|auto offer already published|line mismatch|offer not draft|invalid currency/;
const verbose = process.argv.includes("--verbose");

async function expectError(promise) {
  try {
    await promise;
  } catch (e) {
    if (!SECURITY_ERROR.test(e.message)) throw new Error(`refus inattendu : ${e.message}`);
    if (verbose) console.log(`  refuse comme prevu : ${e.message}`);
    return;
  }
  throw new Error("aurait du etre refuse");
}

// Comptes. "admin" tente de s'inscrire avec le role admin depuis le navigateur.
await db.query(
  `insert into auth.users (id, email, raw_user_meta_data) values
     ($1, 'buyer@test.dz', '{"role":"buyer"}'), ($2, 'buyer2@test.dz', '{}'),
     ($3, 'a@test.dz', '{"role":"producer"}'), ($4, 'b@test.dz', '{"role":"producer"}'),
     ($5, 'admin@test.dz', '{"role":"admin"}')`,
  [U.buyer, U.buyer2, U.prodA, U.prodB, U.admin],
);

await check("Inscription : le role admin ne peut pas etre choisi depuis le navigateur", async () => {
  const [p] = await rows("select role from public.profiles where id = $1", [U.admin]);
  expect(p.role === "buyer", `role obtenu : ${p.role}`);
});
await db.query("update public.profiles set role = 'admin' where id = $1", [U.admin]);

// Le producteur cree sa fiche en brouillon (migration 10) ; seule AFRICA NEX la met en ligne.
const newCompany = async (owner, slug) => {
  // Insertion sans "returning", comme le site : le brouillon n'est lisible qu'une fois le membre ajoute.
  await as(owner, () =>
    rows(
      `insert into public.companies (company_name, slug, kind, owner_profile_id, visibility, sector)
       values ($1, $2, 'producer', $3, 'draft', 'C10')`,
      [slug, slug, owner],
    ),
  );
  return rows("update public.companies set visibility = 'published' where slug = $1 returning id", [slug]);
};

const [{ id: companyA }] = await newCompany(U.prodA, "producteur-a");
const [{ id: companyB }] = await newCompany(U.prodB, "producteur-b");

await check("Un producteur ne peut creer qu'une entreprise", () =>
  expectError(newCompany(U.prodA, "producteur-a-bis")));

await check("Un producteur ne peut pas s'attribuer le badge verifie", () =>
  expectError(as(U.prodA, () => rows("update public.companies set verified = true where id = $1", [companyA]))));

await check("Un acheteur ne peut pas creer d'entreprise productrice", () =>
  expectError(as(U.buyer, () => rows(
    `insert into public.companies (company_name, slug, kind, owner_profile_id) values ('X', 'x-buyer', 'producer', $1)`,
    [U.buyer]))));

for (const [owner, company] of [[U.prodA, companyA], [U.prodB, companyB]]) {
  await as(owner, async () => {
    await rows("insert into public.products (company_id, product_name) values ($1, 'Brouillon secret')", [company]);
    await rows(
      `insert into public.products (company_id, product_name, hs_code, unit_price_ht, currency, status)
       values ($1, 'Huile publiee', '1509.20', 9.2, 'USD', 'published')`,
      [company],
    );
  });
}

await check("Publication impossible sans code SH, prix et devise", () =>
  expectError(as(U.prodA, () => rows(
    "insert into public.products (company_id, product_name, status) values ($1, 'Incomplet', 'published')",
    [companyA]))));

await check("Test 1 : le producteur A ne voit jamais les brouillons du producteur B", async () => {
  const r = await as(U.prodA, () => rows("select product_name from public.products where company_id = $1", [companyB]));
  expect(r.length === 1 && r[0].product_name === "Huile publiee", `lignes vues : ${JSON.stringify(r)}`);
});

await check("Annuaire public : 16 fiches importees + 2 producteurs publies", async () => {
  const [r] = await as(null, () => rows("select count(*)::int as n from public.producer_cards"));
  expect(r.n === 18, `${r.n} fiches`);
});

await check("Les 16 fiches importees sont non revendiquees et sans badge", async () => {
  const [r] = await rows(
    "select count(*)::int as n from public.companies where legacy_id is not null and claim_status = 'unclaimed' and not verified");
  expect(r.n === 16, `${r.n} fiches conformes`);
});

for (const table of ["company_private", "rfqs", "quotes", "offers", "messages", "profiles", "submissions"]) {
  await check(`Test 2 : un visiteur anonyme ne lit rien dans ${table}`, () =>
    expectError(as(null, () => rows(`select * from public.${table}`))));
}

await check("Test 3 : un visiteur anonyme ne peut pas deposer d'avis", () =>
  expectError(as(null, () => rows(
    "insert into public.reviews (producer_company_id, author_name, rating) values ($1, 'Anonyme', 1)", [companyA]))));

// Parcours complet d'une demande de devis
const [{ id: rfq }] = await as(U.buyer, () =>
  rows("insert into public.rfqs (buyer_profile_id, title, quantity, unit) values ($1, 'Huile 20 000 L', 20000, 'l') returning id", [U.buyer]));

await check("Un acheteur ne peut pas creer une demande deja au statut offre", () =>
  expectError(as(U.buyer, () => rows(
    "insert into public.rfqs (buyer_profile_id, title, status) values ($1, 'Triche', 'offered')", [U.buyer]))));

const dispatchOf = {};
await as(U.admin, async () => {
  for (const [key, company] of [["A", companyA], ["B", companyB]]) {
    const [d] = await rows(
      "insert into public.rfq_dispatches (rfq_id, company_id, brief_title) values ($1, $2, 'Huile extra vierge') returning id",
      [rfq, company]);
    dispatchOf[key] = d.id;
  }
  await rows("update public.rfqs set status = 'dispatched' where id = $1", [rfq]);
});

await check("Test 5 : le producteur ne voit jamais la demande brute (identite de l'acheteur)", async () => {
  const r = await as(U.prodA, () => rows("select * from public.rfqs"));
  expect(r.length === 0, `${r.length} demandes visibles`);
});

await check("Le producteur ne voit que son propre envoi", async () => {
  const r = await as(U.prodA, () => rows("select id from public.rfq_dispatches"));
  expect(r.length === 1 && r[0].id === dispatchOf.A, `${r.length} envois visibles`);
});

await check("Le producteur peut marquer son envoi comme vu", async () => {
  await as(U.prodA, () => rows("update public.rfq_dispatches set status = 'viewed', viewed_at = now() where id = $1", [dispatchOf.A]));
  const [d] = await rows("select status from public.rfq_dispatches where id = $1", [dispatchOf.A]);
  expect(d.status === "viewed", `statut ${d.status}`);
});

await check("Le producteur ne peut pas modifier le brief", () =>
  expectError(as(U.prodA, () => rows("update public.rfq_dispatches set brief_title = 'Change' where id = $1", [dispatchOf.A]))));

const quote = (user, company, dispatch, price) =>
  as(user, () => rows(
    `insert into public.quotes (dispatch_id, company_id, author_profile_id, unit_price_ht, currency)
     values ($1, $2, $3, $4, 'USD') returning id`,
    [dispatch, company, user, price]));

const [{ id: quoteA }] = await quote(U.prodA, companyA, dispatchOf.A, 7.8);
await quote(U.prodB, companyB, dispatchOf.B, 7.1);

await check("Un devis passe l'envoi au statut devis envoye", async () => {
  const [d] = await rows("select status from public.rfq_dispatches where id = $1", [dispatchOf.A]);
  expect(d.status === "quoted", `statut ${d.status}`);
});

await check("Le producteur A ne peut pas repondre a l'envoi du producteur B", () =>
  expectError(quote(U.prodA, companyA, dispatchOf.B, 1)));

await check("Test 5 : le producteur A ne voit pas le prix de son concurrent", async () => {
  const r = await as(U.prodA, () => rows("select unit_price_ht from public.quotes"));
  expect(r.length === 1 && Number(r[0].unit_price_ht) === 7.8, `devis visibles : ${JSON.stringify(r)}`);
});

for (const table of ["quotes", "rfq_dispatches", "offer_margins"]) {
  await check(`Test 4 : l'acheteur ne lit rien dans ${table}`, async () => {
    const r = await as(U.buyer, () => rows(`select * from public.${table}`));
    expect(r.length === 0, `${r.length} lignes`);
  });
}

const [{ id: offer }] = await as(U.admin, async () => {
  const o = await rows(
    `insert into public.offers (rfq_id, label, unit_price, currency, status, published_at)
     values ($1, 'A', 8.9, 'USD', 'published', now()) returning id`, [rfq]);
  await rows(
    `insert into public.offer_margins (offer_id, source_quote_id, producer_unit_price, commission_rate)
     values ($1, $2, 7.8, 2.5)`, [o[0].id, quoteA]);
  await rows("update public.rfqs set status = 'offered' where id = $1", [rfq]);
  return o;
});

await check("L'acheteur voit l'offre publiee, sans la marge", async () => {
  const offers = await as(U.buyer, () => rows("select id from public.offers"));
  const margins = await as(U.buyer, () => rows("select * from public.offer_margins"));
  expect(offers.length === 1 && margins.length === 0, `offres ${offers.length}, marges ${margins.length}`);
});

await check("Test 5 : le producteur ne voit pas l'offre faite a l'acheteur", async () => {
  const r = await as(U.prodA, () => rows("select * from public.offers"));
  expect(r.length === 0, `${r.length} offres visibles`);
});

await check("Un autre acheteur ne peut pas accepter l'offre", () =>
  expectError(as(U.buyer2, () => rows("select public.accept_offer($1)", [offer]))));

await check("L'acheteur accepte son offre", async () => {
  await as(U.buyer, () => rows("select public.accept_offer($1)", [offer]));
  const [r] = await rows("select status from public.rfqs where id = $1", [rfq]);
  expect(r.status === "accepted", `statut ${r.status}`);
});

// Lot 6c : offre calculee automatiquement (lignes visibles de l'acheteur, construction du prix secrete)
const [{ id: rfqAuto }] = await as(U.buyer, () =>
  rows("insert into public.rfqs (buyer_profile_id, title, currency) values ($1, 'Demande multi-lignes', 'EUR') returning id", [U.buyer]));
const [{ id: productAuto }] = await rows(
  `insert into public.products (company_id, product_name, unit, unit_price_ht, currency, price_dzd_ht, status)
   values ($1, 'Huile 1 L', 'carton', 10, 'EUR', 1500, 'draft') returning id`, [companyA]);
const [{ id: lineAuto }] = await as(U.buyer, () => rows(
  `insert into public.rfq_lines (rfq_id, position, product_id, description, quantity, unit)
   values ($1, 1, $2, 'Huile 1 L', 100, 'carton') returning id`, [rfqAuto, productAuto]));
await as(U.admin, () => rows("update public.rfqs set status = 'qualified' where id = $1", [rfqAuto]));

const autoPayload = (marginPending) => JSON.stringify([{
  label: "A", currency: "EUR", incoterm: "FOB", valid_until: "2099-12-31", lead_time_days: 10, total_amount: 1100,
  margin: { export_mode: "self", margin_pending: marginPending, freight_pending: false, producer_currency: "EUR", commission_rate: 10, commission_amount: 100, insurance_rate: 0, insurance_cost: 0 },
  lines: [{
    rfq_line_id: lineAuto, position: 1, description: "Huile 1 L", quantity: 100, unit: "carton", unit_price: 11, total_amount: 1100, incoterm: "FOB",
    margin: { product_id: productAuto, company_id: companyA, export_mode: "self", supplier_unit_price: 10, supplier_currency: "EUR", base_amount: 1000, commission_rate: 10, commission_amount: 100, warnings: ["stockUnknown"] },
  }],
}]);

for (const [who, user] of [["l'acheteur", U.buyer], ["un producteur", U.prodA]]) {
  await check(`Lot 6c : ${who} ne lit pas les donnees du calcul (prix fournisseurs)`, () =>
    expectError(as(user, () => rows("select * from public.offer_auto_inputs($1)", [rfqAuto]))));
  await check(`Lot 6c : ${who} ne peut pas ecrire d'offre calculee`, () =>
    expectError(as(user, () => rows("select public.save_auto_offers($1, $2::jsonb)", [rfqAuto, autoPayload(false)]))));
}

await check("Lot 6c : l'admin lit la ligne avec le prix fournisseur et le prix en dinars", async () => {
  const r = await as(U.admin, () => rows("select * from public.offer_auto_inputs($1)", [rfqAuto]));
  expect(r.length === 1 && Number(r[0].unit_price_ht) === 10 && Number(r[0].price_dzd_ht) === 1500 && r[0].company_id === companyA, JSON.stringify(r));
});

let autoOffer;
await check("Lot 6c : l'admin enregistre l'offre calculee (brouillon, lignes et marges)", async () => {
  await as(U.admin, () => rows("select public.save_auto_offers($1, $2::jsonb)", [rfqAuto, autoPayload(true)]));
  const r = await rows(
    `select o.id, o.status, m.auto, m.margin_pending, (select count(*) from public.offer_lines l where l.offer_id = o.id)::int as lines,
            (select count(*) from public.offer_line_margins lm join public.offer_lines l on l.id = lm.offer_line_id where l.offer_id = o.id)::int as margins
       from public.offers o join public.offer_margins m on m.offer_id = o.id where o.rfq_id = $1`, [rfqAuto]);
  expect(r.length === 1 && r[0].status === "draft" && r[0].auto && r[0].margin_pending && r[0].lines === 1 && r[0].margins === 1, JSON.stringify(r));
  autoOffer = r[0].id;
});

await check("Lot 6c : un recalcul remplace le brouillon automatique (pas de doublon)", async () => {
  await as(U.admin, () => rows("select public.save_auto_offers($1, $2::jsonb)", [rfqAuto, autoPayload(true)]));
  const r = await rows("select id from public.offers where rfq_id = $1", [rfqAuto]);
  expect(r.length === 1, `${r.length} offres`);
  autoOffer = r[0].id;
});

await check("Lot 6c : l'acheteur ne voit pas les lignes d'un brouillon", async () => {
  const r = await as(U.buyer, () => rows("select * from public.offer_lines"));
  expect(r.length === 0, `${r.length} lignes`);
});

await check("Lot 6c : une offre avec marge a saisir ne peut pas etre publiee", () =>
  expectError(as(U.admin, () => rows("update public.offers set status = 'published', published_at = now() where id = $1", [autoOffer]))));

// Lot 6e : saisie d'AFRICA NEX sur l'offre calculee (commission, marge, fret, conditions)
const [{ id: autoLine }] = await rows("select id from public.offer_lines where offer_id = $1", [autoOffer]);
const pricing = (lines, over = {}) => JSON.stringify({
  total_amount: 1350, freight_amount: 250, incoterm_place: "Abidjan", valid_until: "2099-12-01", payment_terms: "30 % a la commande", notes: "",
  commission_rate: 10, commission_amount: 100, margin_rate: null, margin_amount: null, margin_pending: false, freight_cost: 250, freight_pending: false,
  lines, ...over,
});
const pricedLine = { id: autoLine, unit_price: 11, total_amount: 1100, commission_rate: 10, commission_amount: 100, fx_margin_amount: 0, margin_amount: 0 };

for (const [who, user] of [["l'acheteur", U.buyer], ["un producteur", U.prodA]]) {
  await check(`Lot 6e : ${who} ne peut pas completer une offre calculee`, () =>
    expectError(as(user, () => rows("select public.save_offer_pricing($1, $2::jsonb)", [autoOffer, pricing([pricedLine])]))));
}

await check("Lot 6e : les lignes doivent etre exactement celles de l'offre", () =>
  expectError(as(U.admin, () => rows("select public.save_offer_pricing($1, $2::jsonb)", [autoOffer, pricing([])]))));

await check("Lot 6e : l'admin enregistre marge, fret et conditions ; le fret s'ajoute au total", async () => {
  await as(U.admin, () => rows("select public.save_offer_pricing($1, $2::jsonb)", [autoOffer, pricing([pricedLine])]));
  const [r] = await rows(
    `select o.total_amount, o.freight_amount, o.incoterm_place, o.payment_terms, m.margin_pending, m.freight_cost, l.total_amount as line_total
       from public.offers o join public.offer_margins m on m.offer_id = o.id join public.offer_lines l on l.offer_id = o.id where o.id = $1`, [autoOffer]);
  expect(Number(r.total_amount) === 1350 && Number(r.freight_amount) === 250 && Number(r.line_total) === 1100 && r.incoterm_place === "Abidjan" && !r.margin_pending, JSON.stringify(r));
});

await as(U.admin, () => rows("update public.offers set status = 'published', published_at = now() where id = $1", [autoOffer]));

await check("Lot 6e : une offre publiee ne se modifie plus", () =>
  expectError(as(U.admin, () => rows("select public.save_offer_pricing($1, $2::jsonb)", [autoOffer, pricing([pricedLine])]))));

await check("Lot 6c : l'acheteur voit les lignes publiees, jamais la construction du prix", async () => {
  const lines = await as(U.buyer, () => rows("select unit_price from public.offer_lines"));
  const margins = await as(U.buyer, () => rows("select * from public.offer_line_margins"));
  expect(lines.length === 1 && Number(lines[0].unit_price) === 11 && margins.length === 0, `lignes ${lines.length}, marges ${margins.length}`);
});

await check("Lot 6c : le producteur et le visiteur ne voient ni les lignes ni les marges", async () => {
  for (const user of [U.prodA, null]) {
    for (const table of ["offer_lines", "offer_line_margins"]) {
      const r = await as(user, () => rows(`select * from public.${table}`).catch((e) => {
        if (/permission denied/.test(e.message)) return [];
        throw e;
      }));
      expect(r.length === 0, `${user ?? "anonyme"} lit ${r.length} lignes de ${table}`);
    }
  }
});

await check("Lot 6c : pas de recalcul une fois l'offre automatique publiee", () =>
  expectError(as(U.admin, () => rows("select public.save_auto_offers($1, $2::jsonb)", [rfqAuto, autoPayload(false)]))));

// Lot 6d : consultation par ligne et devis retenu (AFRICA NEX seule)
const [{ id: lineDispatch }] = await as(U.admin, () => rows(
  `insert into public.rfq_dispatches (rfq_id, rfq_line_id, company_id, brief_title) values ($1, $2, $3, 'Huile 1 L') returning id`,
  [rfqAuto, lineAuto, companyA]));

await check("Lot 6d : un seul brief par ligne et par producteur", async () => {
  try {
    await as(U.admin, () => rows(
      `insert into public.rfq_dispatches (rfq_id, rfq_line_id, company_id, brief_title) values ($1, $2, $3, 'Doublon')`,
      [rfqAuto, lineAuto, companyA]));
  } catch (e) {
    expect(/duplicate key/.test(e.message), e.message);
    return;
  }
  throw new Error("doublon accepte");
});

await check("Lot 6d : un brief de ligne et un brief de toute la demande coexistent", async () => {
  await as(U.admin, () => rows(
    `insert into public.rfq_dispatches (rfq_id, company_id, brief_title) values ($1, $2, 'Toute la demande')`, [rfqAuto, companyA]));
  const [{ n }] = await rows("select count(*)::int as n from public.rfq_dispatches where rfq_id = $1 and company_id = $2", [rfqAuto, companyA]);
  expect(n === 2, `${n} envois`);
});

await check("Lot 6d : une ligne d'une autre demande est refusee", async () => {
  try {
    await as(U.admin, () => rows(
      `insert into public.rfq_dispatches (rfq_id, rfq_line_id, company_id, brief_title) values ($1, $2, $3, 'Melange')`,
      [rfq, lineAuto, companyB]));
  } catch (e) {
    expect(/foreign key/.test(e.message), e.message);
    return;
  }
  throw new Error("ligne d'une autre demande acceptee");
});

const [{ id: lineQuote }] = await quote(U.prodA, companyA, lineDispatch, 9.5);

await check("Lot 6d : l'admin lit le devis de la ligne pour le calcul", async () => {
  const r = await as(U.admin, () => rows("select * from public.offer_auto_quotes($1)", [rfqAuto]));
  expect(r.length === 1 && r[0].quote_id === lineQuote && r[0].line_id === lineAuto && Number(r[0].unit_price_ht) === 9.5 && r[0].chosen === false, JSON.stringify(r));
});

await check("Lot 6d : l'acheteur ne lit pas les devis de la demande", () =>
  expectError(as(U.buyer, () => rows("select * from public.offer_auto_quotes($1)", [rfqAuto]))));

await as(U.admin, () => rows("insert into public.rfq_line_choices (rfq_line_id, quote_id, chosen_by) values ($1, $2, $3)", [lineAuto, lineQuote, U.admin]));

await check("Lot 6d : le devis retenu est signale au calcul", async () => {
  const r = await as(U.admin, () => rows("select chosen from public.offer_auto_quotes($1)", [rfqAuto]));
  expect(r[0]?.chosen === true, JSON.stringify(r));
});

for (const [who, user] of [["l'acheteur", U.buyer], ["le producteur", U.prodA]]) {
  await check(`Lot 6d : ${who} ne lit ni ne modifie le devis retenu`, async () => {
    const r = await as(user, () => rows("select * from public.rfq_line_choices"));
    expect(r.length === 0, `${r.length} lignes`);
    await expectError(as(user, () => rows("insert into public.rfq_line_choices (rfq_line_id, quote_id) values ($1, $2)", [lineAuto, lineQuote])));
  });
}

// Lot 5e : decisions de l'acheteur offre par offre (panier multi-lignes)
const [{ id: rfqBasket }] = await rows("insert into public.rfqs (buyer_profile_id, title, currency, status) values ($1, 'Panier', 'EUR', 'offered') returning id", [U.buyer]);
const basketLine = async (position, description) =>
  (await rows("insert into public.rfq_lines (rfq_id, position, description, quantity, unit) values ($1, $2, $3, 100, 'carton') returning id", [rfqBasket, position, description]))[0].id;
const bl1 = await basketLine(1, "Huile");
const bl2 = await basketLine(2, "Dattes");
async function basketOffer(rfqId, label, currency, lineIds) {
  const [{ id }] = await rows(
    "insert into public.offers (rfq_id, label, currency, total_amount, status, published_at, valid_until) values ($1, $2, $3, 100, 'published', now(), '2099-12-31') returning id",
    [rfqId, label, currency]);
  let p = 1;
  for (const l of lineIds) await rows("insert into public.offer_lines (offer_id, rfq_line_id, position, description, quantity, unit_price, total_amount) values ($1, $2, $3, 'x', 1, 100, 100)", [id, l, p++]);
  return id;
}
const oA = await basketOffer(rfqBasket, "A", "EUR", [bl1]);
const oA2 = await basketOffer(rfqBasket, "A2", "USD", [bl1]);
const oB = await basketOffer(rfqBasket, "B", "EUR", [bl2]);
const statusOf = async (id) => (await rows("select status from public.offers where id = $1", [id]))[0].status;

await check("Lot 5e : un autre acheteur ne peut ni refuser ni demander une devise", async () => {
  await expectError(as(U.buyer2, () => rows("select public.decline_offer($1, 'x')", [oB])));
  await expectError(as(U.buyer2, () => rows("select public.request_offer_currency($1, 'USD', null)", [oB])));
});

await check("Lot 5e : l'acheteur demande un changement de devise, l'offre reste publiee", async () => {
  await as(U.buyer, () => rows("select public.request_offer_currency($1, 'USD', 'Paiement en dollars')", [oB]));
  const [r] = await rows("select status, currency_change_to, currency_change_note from public.offers where id = $1", [oB]);
  expect(r.status === "published" && r.currency_change_to === "USD" && r.currency_change_note === "Paiement en dollars", JSON.stringify(r));
});

await check("Lot 5e : demander la devise deja utilisee est refuse", () =>
  expectError(as(U.buyer, () => rows("select public.request_offer_currency($1, 'EUR', null)", [oB]))));

await check("Lot 5e : accepter A ecarte son alternative (meme ligne), pas l'offre complementaire", async () => {
  await as(U.buyer, () => rows("select public.accept_offer($1)", [oA]));
  const [{ status: rfqStatus }] = await rows("select status from public.rfqs where id = $1", [rfqBasket]);
  const s = [await statusOf(oA), await statusOf(oA2), await statusOf(oB)];
  expect(s.join() === "accepted,declined,published" && rfqStatus === "offered", `${s.join()} / ${rfqStatus}`);
});

await check("Lot 5e : une offre ecartee ne peut plus etre acceptee", () =>
  expectError(as(U.buyer, () => rows("select public.accept_offer($1)", [oA2]))));

await check("Lot 5e : refus avec motif ; plus rien a decider, la demande passe acceptee", async () => {
  await as(U.buyer, () => rows("select public.decline_offer($1, '  Trop cher  ')", [oB]));
  const [o] = await rows("select status, decline_reason, decided_at from public.offers where id = $1", [oB]);
  const [{ status: rfqStatus }] = await rows("select status from public.rfqs where id = $1", [rfqBasket]);
  expect(o.status === "declined" && o.decline_reason === "Trop cher" && o.decided_at && rfqStatus === "accepted", `${JSON.stringify(o)} / ${rfqStatus}`);
});

await check("Lot 5e : toutes les offres refusees, la demande revient en consultation", async () => {
  const [{ id: rfqAlone }] = await rows("insert into public.rfqs (buyer_profile_id, title, currency, status) values ($1, 'Seule', 'EUR', 'offered') returning id", [U.buyer]);
  const oAlone = await basketOffer(rfqAlone, "A", "EUR", []);
  await as(U.buyer, () => rows("select public.decline_offer($1, null)", [oAlone]));
  const [{ status }] = await rows("select status from public.rfqs where id = $1", [rfqAlone]);
  expect(status === "dispatched", status);
});

await check("Lot 5e : l'acheteur n'appelle pas les fonctions internes", async () => {
  await expectError(as(U.buyer, () => rows("select public.rfq_settle_offers($1)", [rfqBasket])));
  await expectError(as(U.buyer, () => rows("select public.offers_overlap($1, $2)", [oA, oB])));
});

// Emails de notification : journal lisible par AFRICA NEX seule
await rows("insert into public.email_notifications (kind, rfq_id, recipient_profile_id, recipient_email, subject, status) values ('offer_ready', $1, $2, 'acheteur@test.dz', 'Une offre est disponible', 'logged')", [rfq, U.buyer]);

await check("Emails : seul l'admin lit le journal", async () => {
  for (const user of [U.buyer, U.prodA, null]) {
    const r = await as(user, () => rows("select * from public.email_notifications").catch((e) => {
      if (/permission denied/.test(e.message)) return [];
      throw e;
    }));
    expect(r.length === 0, `${user ?? "anonyme"} lit ${r.length} email(s)`);
  }
  const r = await as(U.admin, () => rows("select subject from public.email_notifications"));
  expect(r.length === 1, `admin : ${r.length}`);
});

await check("Emails : personne n'ecrit dans le journal avec sa session", async () => {
  for (const user of [U.buyer, U.admin]) {
    await expectError(as(user, () => rows("insert into public.email_notifications (kind, subject, status) values ('x', 'y', 'sent')")));
  }
});

// Messages : deux fils, jamais acheteur avec producteur
await as(U.buyer, () => rows(
  "insert into public.messages (rfq_id, sender_profile_id, sender_role, body) values ($1, $2, 'buyer', 'Question acheteur')",
  [rfq, U.buyer]));
await as(U.prodA, () => rows(
  `insert into public.messages (rfq_id, dispatch_id, sender_profile_id, sender_role, body)
   values ($1, $2, $3, 'producer', 'Question producteur')`, [rfq, dispatchOf.A, U.prodA]));

await check("L'acheteur ne peut pas ecrire dans le fil d'un producteur", () =>
  expectError(as(U.buyer, () => rows(
    `insert into public.messages (rfq_id, dispatch_id, sender_profile_id, sender_role, body)
     values ($1, $2, $3, 'buyer', 'Intrusion')`, [rfq, dispatchOf.A, U.buyer]))));

await check("Chaque partie ne lit que son propre fil", async () => {
  const buyerSees = await as(U.buyer, () => rows("select body from public.messages"));
  const prodASees = await as(U.prodA, () => rows("select body from public.messages"));
  const prodBSees = await as(U.prodB, () => rows("select body from public.messages"));
  expect(
    buyerSees.length === 1 && buyerSees[0].body === "Question acheteur"
      && prodASees.length === 1 && prodASees[0].body === "Question producteur"
      && prodBSees.length === 0,
    `acheteur ${buyerSees.length}, A ${prodASees.length}, B ${prodBSees.length}`);
});

// Lot 5f : messages lus, marques seulement par leur destinataire
await as(U.admin, async () => {
  await rows("insert into public.messages (rfq_id, sender_profile_id, sender_role, body) values ($1, $2, 'admin', 'Reponse a l''acheteur')", [rfq, U.admin]);
  await rows("insert into public.messages (rfq_id, dispatch_id, sender_profile_id, sender_role, body) values ($1, $2, $3, 'admin', 'Reponse au producteur A')", [rfq, dispatchOf.A, U.admin]);
});
const readOf = async (body) => (await rows("select read_at from public.messages where body = $1", [body]))[0].read_at;

await check("Lot 5f : l'acheteur ne modifie pas directement l'etat lu", async () => {
  await as(U.buyer, () => rows("update public.messages set read_at = now()"));
  expect(!(await readOf("Reponse a l'acheteur")), "message marque lu par une mise a jour directe");
});

await check("Lot 5f : un autre producteur ne marque pas le fil de A", async () => {
  const [{ n }] = await as(U.prodB, () => rows("select public.mark_messages_read($1, $2) as n", [rfq, dispatchOf.A]));
  expect(n === 0 && !(await readOf("Reponse au producteur A")), `${n} message(s) marque(s)`);
});

await check("Lot 5f : l'acheteur marque lus les messages d'AFRICA NEX, pas les siens", async () => {
  const [{ n }] = await as(U.buyer, () => rows("select public.mark_messages_read($1, null) as n", [rfq]));
  expect(n === 1 && !!(await readOf("Reponse a l'acheteur")) && !(await readOf("Question acheteur")) && !(await readOf("Reponse au producteur A")), `${n} message(s)`);
});

await check("Lot 5f : le producteur A et l'admin marquent chacun leurs messages recus", async () => {
  const [{ n: a }] = await as(U.prodA, () => rows("select public.mark_messages_read($1, $2) as n", [rfq, dispatchOf.A]));
  const [{ n: adm }] = await as(U.admin, () => rows("select public.mark_messages_read($1, null) as n", [rfq]));
  expect(a === 1 && adm === 1 && !!(await readOf("Reponse au producteur A")) && !!(await readOf("Question acheteur")) && !(await readOf("Question producteur")), `A ${a}, admin ${adm}`);
});

// Profils
await check("Test 6 : un acheteur ne peut pas se donner le role admin", () =>
  expectError(as(U.buyer, () => rows("update public.profiles set role = 'admin' where id = $1", [U.buyer]))));

await check("Le role se choisit pendant l'inscription, puis se fige", async () => {
  await as(U.buyer2, () => rows("update public.profiles set role = 'producer' where id = $1", [U.buyer2]));
  await as(U.buyer2, () => rows("update public.profiles set onboarding_completed = true where id = $1", [U.buyer2]));
  const [p] = await rows("select role, onboarding_completed from public.profiles where id = $1", [U.buyer2]);
  expect(p.role === "producer" && p.onboarding_completed, `profil ${JSON.stringify(p)}`);
  await expectError(as(U.buyer2, () => rows("update public.profiles set role = 'buyer' where id = $1", [U.buyer2])));
});

await check("Test 7 : le producteur A ne peut pas modifier l'entreprise B", async () => {
  await as(U.prodA, () => rows("update public.companies set company_name = 'Pirate' where id = $1", [companyB]));
  const [r] = await rows("select company_name from public.companies where id = $1", [companyB]);
  expect(r.company_name === "producteur-b", `nom devenu ${r.company_name}`);
});

// Avis
await check("Un acheteur connecte depose un avis, en attente de validation", async () => {
  await as(U.buyer, () => rows(
    `insert into public.reviews (producer_company_id, author_profile_id, author_name, rating)
     values ($1, $2, 'Aminata', 5)`, [companyA, U.buyer]));
  const pub = await as(null, () => rows("select * from public.reviews where producer_company_id = $1", [companyA]));
  expect(pub.length === 0, "avis visible avant validation");
});

await check("Un acheteur ne peut pas publier lui-meme son avis", () =>
  expectError(as(U.buyer, () => rows(
    `insert into public.reviews (producer_company_id, author_profile_id, author_name, rating, status)
     values ($1, $2, 'Triche', 5, 'approved')`, [companyB, U.buyer]))));

await check("Un producteur ne peut pas deposer d'avis", () =>
  expectError(as(U.prodB, () => rows(
    `insert into public.reviews (producer_company_id, author_profile_id, author_name, rating)
     values ($1, $2, 'Concurrent', 1)`, [companyA, U.prodB]))));

// Revendication
const [{ id: ifri }] = await rows("select id from public.companies where slug = 'ifri'");

await check("Un acheteur ne peut pas revendiquer une fiche", () =>
  expectError(as(U.buyer, () => rows(
    "insert into public.company_claims (company_id, profile_id) values ($1, $2)", [ifri, U.buyer]))));

await check("Une revendication passe la fiche en cours de revendication", async () => {
  await as(U.prodB, () => rows("insert into public.company_claims (company_id, profile_id) values ($1, $2)", [ifri, U.prodB]));
  const [r] = await rows("select claim_status from public.companies where id = $1", [ifri]);
  expect(r.claim_status === "claim_pending", `statut ${r.claim_status}`);
});

// Fichiers
await check("Un producteur depose son logo dans son dossier", async () => {
  await as(U.prodA, () => rows("insert into storage.objects (bucket_id, name) values ('producer-logos', $1)", [`${companyA}/logo.png`]));
  const [r] = await rows("select count(*)::int as n from storage.objects where name = $1", [`${companyA}/logo.png`]);
  expect(r.n === 1, `${r.n} fichier`);
});

await check("Un producteur ne peut pas deposer dans le dossier d'un concurrent", () =>
  expectError(as(U.prodA, () => rows(
    "insert into storage.objects (bucket_id, name) values ('producer-logos', $1)", [`${companyB}/logo.png`]))));

await check("Un chemin malforme est refuse sans planter", () =>
  expectError(as(U.prodA, () => rows(
    "insert into storage.objects (bucket_id, name) values ('company-documents', 'pas-un-uuid/rc.pdf')"))));

// ---------------------------------------------------------------------------------------------
// Abonnements fournisseurs (migration 35) : prix, quotas, places fondateurs, descente de forfait
// ---------------------------------------------------------------------------------------------
async function expectFail(promise, re) {
  try {
    await promise;
  } catch (e) {
    if (!re.test(e.message)) throw new Error(`erreur inattendue : ${e.message}`);
    return;
  }
  throw new Error("aurait du etre refuse");
}
const supplier = async (slug) =>
  (await rows("insert into public.companies (company_name, slug, kind, visibility, sector) values ($1, $2, 'producer', 'published', 'C10') returning id", [slug, slug]))[0].id;
const addProducts = (company, n) =>
  rows("insert into public.products (company_id, product_name, hs_code, unit, unit_price_ht, currency, status) select $1, 'Produit ' || g, '150910', 'carton', 10, 'EUR', 'published' from generate_series(1, $2) g", [company, n]);
const subscribe = async (company, plan, cycle = "monthly") => {
  const [{ id }] = await as(U.admin, () => rows("select public.request_subscription($1, $2, $3::public.billing_cycle) as id", [company, plan, cycle]));
  await as(U.admin, () => rows("select public.activate_subscription($1, 'VIR-TEST')", [id]));
  return id;
};
const one = async (sql, params = []) => Object.values((await rows(sql, params))[0])[0];

// Grille du 24 novembre 2026 (migration 38) : Passeport gratuit, Agent Export, Ambassadeur ; -10 % en annuel.
await check("Abonnements : prix (Agent Export 36 900, Ambassadeur 59 600, annuel -10 %), Croissance retiree", async () => {
  const p = await as(null, () => rows(`select public.compute_price('agent_export', 'monthly') as am, public.compute_price('agent_export', 'annual_prepaid') as aa,
    public.compute_price('ambassadeur', 'monthly') as bm, public.compute_price('ambassadeur', 'annual_prepaid') as ba, public.compute_price('vitrine', 'monthly') as v`));
  expect(p[0].am === 36900 && p[0].aa === 398520 && p[0].bm === 59600 && p[0].ba === 643680 && p[0].v === 0, JSON.stringify(p[0]));
  await expectFail(as(null, () => rows("select public.compute_price('croissance', 'monthly')")), /unknown plan/);
});

await check("Abonnements : offres lisibles par un visiteur, abonnements non", async () => {
  const plans = await as(null, () => rows("select code, name from public.plans where is_active order by sort_order"));
  const subs = await as(null, () => rows("select id from public.subscriptions").catch((e) => (/permission denied/.test(e.message) ? [] : Promise.reject(e))));
  expect(plans.map((p) => p.name).join() === "Passeport,Agent Export,Ambassadeur" && subs.length === 0, `${plans.map((p) => p.code).join()} / ${subs.length} abonnements`);
});

await check("Passeport : demandes d'acheteurs differees, ni import Excel ni traduction ; Agent Export : 1 000 produits", async () => {
  const pf = await as(null, () => rows("select plan_code, feature_key, limit_value, access_level from public.plan_features where feature_key in ('buyer_requests', 'excel_import', 'translation', 'products')"));
  const get = (plan, key) => pf.find((r) => r.plan_code === plan && r.feature_key === key);
  const delay = await one("select value::int from public.billing_settings where key = 'free_request_delay_hours'");
  expect(get("vitrine", "buyer_requests").access_level === "delayed" && delay === 48 && get("vitrine", "excel_import").limit_value === 0
    && get("vitrine", "translation").limit_value === 0 && get("agent_export", "products").limit_value === 1000 && get("agent_export", "excel_import").limit_value === null,
    JSON.stringify(pf));
});

await check("Abonnements : Passeport par defaut ; un concurrent ne lit pas l'offre d'un autre", async () => {
  const plan = await as(U.prodA, () => one("select public.current_plan($1)", [companyA]));
  expect(plan === "vitrine", plan);
  await expectFail(as(U.prodB, () => rows("select public.current_plan($1)", [companyA])), /forbidden/);
});

await check("Abonnements : le fournisseur n'ecrit ni son abonnement ni ses compteurs", async () => {
  await expectFail(as(U.prodA, () => rows("insert into public.subscriptions (company_id, plan_code, price_charged_dzd, status) values ($1, 'ambassadeur', 0, 'active')", [companyA])), /row-level security/);
  await expectFail(as(U.prodA, () => rows("insert into public.usage_counters (company_id, feature_key, period_start, used) values ($1, 'ai_videos', current_date, 0)", [companyA])), /row-level security/);
  await expectFail(as(U.prodA, () => rows("select public.request_subscription($1, 'agent_export', 'monthly')", [companyB])), /forbidden/);
});

await check("Quota de produits : 11e publication refusee au Passeport", async () => {
  const co = await supplier("quota-vitrine");
  await addProducts(co, 10);
  await expectFail(addProducts(co, 1), /product quota reached/);
  const n = await one("select count(*)::int from public.products where company_id = $1", [co]);
  expect(n === 10, `${n} produits`);
});

await rows("update public.features set available = true where key = 'ai_videos'");

await check("Quota depasse : 3e video du mois refusee en Ambassadeur (2 par mois, provisoire)", async () => {
  const co = await supplier("quota-ambassadeur");
  await subscribe(co, "ambassadeur");
  await as(U.admin, () => rows("select public.consume($1, 'ai_videos')", [co]));
  await as(U.admin, () => rows("select public.consume($1, 'ai_videos')", [co]));
  await expectFail(as(U.admin, () => rows("select public.consume($1, 'ai_videos')", [co])), /quota exceeded/);
  const [s] = await as(U.admin, () => rows("select * from public.can_use($1, 'ai_videos')", [co]));
  expect(s.allowed === false && s.used === 2 && s.remaining === 0 && s.plan_code === "ambassadeur", JSON.stringify(s));
});

await check("Remise a zero mensuelle : le quota du mois precedent ne compte plus", async () => {
  const co = await supplier("quota-mois");
  await subscribe(co, "ambassadeur");
  await rows("insert into public.usage_counters (company_id, feature_key, period_start, used) values ($1, 'ai_videos', (date_trunc('month', current_date) - interval '1 month')::date, 2)", [co]);
  const used = await as(U.admin, () => one("select public.consume($1, 'ai_videos')", [co]));
  expect(used === 1, `consomme ${used}`);
});

await check("Agent Export : videos non incluses (marketing reserve a Ambassadeur)", async () => {
  const co = await supplier("agent-sans-video");
  await subscribe(co, "agent_export");
  await expectFail(as(U.admin, () => rows("select public.consume($1, 'ai_videos')", [co])), /quota exceeded/);
});

await rows("update public.features set available = false where key = 'ai_videos'");

await check("Service pas encore disponible : consommation refusee", () =>
  expectFail(as(U.admin, () => rows("select public.consume($1, 'ai_campaigns')", [companyA])), /feature not available/));

await check("Essai gratuit : 60 jours, AFRICA NEX seule, un par producteur, 3 producteurs au plus", async () => {
  const ids = (await rows("insert into public.companies (company_name, slug, kind, visibility, sector) select 'Essai ' || g, 'essai-' || g, 'producer', 'published', 'C10' from generate_series(1, 4) g returning id")).map((r) => r.id);
  await expectFail(as(U.prodA, () => rows("select public.start_trial($1, 'agent_export')", [companyA])), /forbidden/);
  for (const id of ids.slice(0, 3)) await as(U.admin, () => rows("select public.start_trial($1, 'agent_export')", [id]));
  await expectFail(as(U.admin, () => rows("select public.start_trial($1, 'agent_export')", [ids[3]])), /no trial slot/);
  const [t] = await rows("select status::text as status, price_charged_dzd as price, current_period_end - current_period_start + 1 as days from public.subscriptions where company_id = $1", [ids[0]]);
  const plan = await as(U.admin, () => one("select public.current_plan($1)", [ids[0]]));
  expect(t.status === "active" && t.price === 0 && t.days === 60 && plan === "agent_export", JSON.stringify(t) + " " + plan);
  // Fin d'essai : retour au Passeport, abonnement clos (pas un impaye), pas de second essai.
  await rows("update public.subscriptions set current_period_start = current_date - 60, current_period_end = current_date - 1 where company_id = $1", [ids[0]]);
  await as(U.admin, () => rows("select public.sync_subscriptions()"));
  const after = await one("select status::text from public.subscriptions where company_id = $1", [ids[0]]);
  const back = await as(U.admin, () => one("select public.current_plan($1)", [ids[0]]));
  await expectFail(as(U.admin, () => rows("select public.start_trial($1, 'agent_export')", [ids[0]])), /trial already used|no trial slot/);
  expect(after === "cancelled" && back === "vitrine", `${after} ${back}`);
});

await check("Descente d'offre : produits en trop masques, jamais supprimes, invisibles du public", async () => {
  const co = await supplier("descente");
  await subscribe(co, "ambassadeur");
  await addProducts(co, 15);
  await as(U.admin, () => rows("select public.schedule_downgrade($1, 'vitrine')", [co]));
  await rows("update public.subscriptions set current_period_start = current_date - 31, current_period_end = current_date - 1 where company_id = $1 and status = 'active'", [co]);
  await as(U.admin, () => rows("select public.sync_subscriptions()"));
  const visible = await one("select count(*)::int from public.products where company_id = $1 and not quota_hidden", [co]);
  const total = await one("select count(*)::int from public.products where company_id = $1", [co]);
  const status = await one("select status::text from public.subscriptions where company_id = $1 order by created_at desc limit 1", [co]);
  const publicView = await as(null, () => rows("select id from public.products where company_id = $1", [co]));
  expect(visible === 10 && total === 15 && status === "cancelled" && publicView.length === 10, `visibles ${visible}, total ${total}, statut ${status}, public ${publicView.length}`);
});

await check("Montee d'offre immediate : produits masques de nouveau visibles", async () => {
  const co = (await rows("select id from public.companies where slug = 'descente'"))[0].id;
  await subscribe(co, "agent_export");
  const visible = await one("select count(*)::int from public.products where company_id = $1 and not quota_hidden", [co]);
  const plan = await as(U.admin, () => one("select public.current_plan($1)", [co]));
  expect(visible === 15 && plan === "agent_export", `visibles ${visible}, offre ${plan}`);
});

await check("Descente vers une offre payante : nouvelle demande au prix inferieur, retour au Passeport en attendant", async () => {
  const co = await supplier("descente-payante");
  await subscribe(co, "ambassadeur");
  await as(U.admin, () => rows("select public.schedule_downgrade($1, 'agent_export')", [co]));
  await expectFail(as(U.admin, () => rows("select public.schedule_downgrade($1, 'ambassadeur')", [co])), /not a downgrade/);
  await rows("update public.subscriptions set current_period_start = current_date - 31, current_period_end = current_date - 1 where company_id = $1 and status = 'active'", [co]);
  await as(U.admin, () => rows("select public.sync_subscriptions()"));
  const subs = await rows("select plan_code, status::text as status, price_charged_dzd from public.subscriptions where company_id = $1 order by created_at", [co]);
  const plan = await as(U.admin, () => one("select public.current_plan($1)", [co]));
  expect(subs.length === 2 && subs[0].status === "past_due" && subs[1].plan_code === "agent_export" && subs[1].status === "pending_payment" && subs[1].price_charged_dzd === 36900 && plan === "vitrine", JSON.stringify(subs) + " " + plan);
});

// ---------------------------------------------------------------------------------------------
// Session 2 (migration 36) : tous les incoterms, accord du fournisseur pour l'export par AFRICA NEX
// ---------------------------------------------------------------------------------------------
await check("Incoterms : les 11 d'Incoterms 2020 acceptes pour un prix fournisseur, un inconnu refuse", async () => {
  const co = await supplier("incoterms");
  for (const basis of ["EXW", "FAS", "CPT", "DAP", "DPU", "DDP"]) {
    await rows("insert into public.products (company_id, product_name, hs_code, unit, unit_price_ht, currency, price_basis, status) values ($1, $2, '150910', 'carton', 10, 'EUR', $3, 'draft')", [co, basis, basis]);
  }
  await expectFail(rows("insert into public.products (company_id, product_name, hs_code, unit, unit_price_ht, currency, price_basis, status) values ($1, 'X', '150910', 'carton', 10, 'EUR', 'DAF', 'draft')", [co]), /price_basis_check/);
});

await check("Export par AFRICA NEX : refuse par la base sans l'accord du fournisseur", () =>
  expectFail(as(U.admin, () => rows("insert into public.supplier_settings (company_id, export_mode) values ($1, 'africanex')", [companyA])), /export consent required/));

await check("Accord du fournisseur : il le donne lui-meme, la date est posee par la base", async () => {
  await as(U.prodA, () => rows("update public.companies set africanex_export_consent = true where id = $1", [companyA]));
  const [c] = await rows("select africanex_export_consent as ok, africanex_export_consent_at as at from public.companies where id = $1", [companyA]);
  await as(U.prodA, () => rows("update public.companies set africanex_export_consent_at = '2020-01-01' where id = $1", [companyA]));
  const at2 = await one("select africanex_export_consent_at from public.companies where id = $1", [companyA]);
  expect(c.ok === true && c.at && String(at2) === String(c.at), `accord ${c.ok}, date ${c.at}, apres forcage ${at2}`);
  await as(U.admin, () => rows("insert into public.supplier_settings (company_id, export_mode) values ($1, 'africanex') on conflict (company_id) do update set export_mode = 'africanex'", [companyA]));
});

await check("Retrait de l'accord : le fournisseur repasse en intermediation", async () => {
  await as(U.prodA, () => rows("update public.companies set africanex_export_consent = false where id = $1", [companyA]));
  const mode = await one("select export_mode from public.supplier_settings where company_id = $1", [companyA]);
  const at = await one("select africanex_export_consent_at from public.companies where id = $1", [companyA]);
  expect(mode === "self" && at === null, `mode ${mode}, date ${at}`);
});

// ---------------------------------------------------------------------------------------------
// Audit legal, correction 3 (migration 37) : suppression de compte et durees de conservation
// ---------------------------------------------------------------------------------------------
await check("Suppression de compte : l'acheteur la demande, une seule demande en attente", async () => {
  const id1 = await as(U.buyer2, () => one("select public.request_account_deletion('Plus besoin')"));
  const id2 = await as(U.buyer2, () => one("select public.request_account_deletion()"));
  const mine = await as(U.buyer2, () => rows("select status, reason, role from public.account_deletion_requests"));
  const role = await one("select role from public.profiles where id = $1", [U.buyer2]);
  expect(id1 === id2 && mine.length === 1 && mine[0].status === "pending" && mine[0].reason === "Plus besoin" && mine[0].role === role, JSON.stringify(mine));
});

await check("Suppression de compte : invisible des autres, statut non modifiable par l'utilisateur", async () => {
  const seen = await as(U.prodA, () => rows("select id from public.account_deletion_requests"));
  await as(U.buyer2, () => rows("update public.account_deletion_requests set status = 'done'"));
  const status = await one("select status from public.account_deletion_requests where profile_id = $1", [U.buyer2]);
  expect(seen.length === 0 && status === "pending", `vu par un autre : ${seen.length}, statut ${status}`);
});

await check("Suppression de compte : AFRICA NEX la voit ; l'utilisateur peut l'annuler", async () => {
  const adminSees = await as(U.admin, () => rows("select id from public.account_deletion_requests where status = 'pending'"));
  await as(U.buyer2, () => rows("select public.cancel_account_deletion()"));
  const status = await one("select status from public.account_deletion_requests where profile_id = $1", [U.buyer2]);
  expect(adminSees.length === 1 && status === "cancelled", `admin ${adminSees.length}, statut ${status}`);
});

await check("Suppression de compte : refusee pour un compte AFRICA NEX ou un visiteur", async () => {
  await expectFail(as(U.admin, () => rows("select public.request_account_deletion()")), /admin account/);
  await expectFail(as(null, () => rows("select public.request_account_deletion()")), /permission denied|not signed in/);
});

await check("Durees de conservation : purge des donnees expirees seulement", async () => {
  await rows(`insert into public.submissions (name, email, created_at) values ('Ancien', 'a@x.dz', now() - interval '13 months'), ('Recent', 'r@x.dz', now() - interval '2 months')`);
  await rows(`insert into public.profile_views (company_id, created_at) values ($1, now() - interval '14 months'), ($1, now() - interval '1 month')`, [companyA]);
  await expectFail(as(U.admin, () => rows("select public.purge_expired_data()")), /permission denied/);
  const [{ r }] = await rows("select public.purge_expired_data() as r");
  const names = (await rows("select name from public.submissions where name in ('Ancien', 'Recent')")).map((x) => x.name).join();
  const oldViews = await one("select count(*)::int from public.profile_views where company_id = $1 and created_at < now() - interval '13 months'", [companyA]);
  expect(r.submissions >= 1 && r.views >= 1 && names === "Recent" && oldViews === 0, `${JSON.stringify(r)} restants : ${names}, anciennes vues ${oldViews}`);
});

console.log(`\n${passed} tests reussis, ${failures.length} en echec`);
for (const f of failures) console.log(`  ECHEC  ${f}`);
process.exit(failures.length ? 1 : 0);
