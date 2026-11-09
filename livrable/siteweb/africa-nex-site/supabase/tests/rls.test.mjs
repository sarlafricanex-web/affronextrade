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
  /row-level security|permission denied|protected .* fields|role cannot be changed|onboarding cannot|only the dispatch status|invalid dispatch status|violates check constraint|offer not available/;
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

const newCompany = (owner, slug) =>
  as(owner, () =>
    rows(
      `insert into public.companies (company_name, slug, kind, owner_profile_id, visibility, sector)
       values ($1, $2, 'producer', $3, 'published', 'agrifood') returning id`,
      [slug, slug, owner],
    ),
  );

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
  rows("insert into public.rfqs (buyer_profile_id, title, quantity) values ($1, 'Huile 20 000 L', 20000) returning id", [U.buyer]));

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

console.log(`\n${passed} tests reussis, ${failures.length} en echec`);
for (const f of failures) console.log(`  ECHEC  ${f}`);
process.exit(failures.length ? 1 : 0);
