// Test de bout en bout de la liste de prix fournisseur : modele Excel selon le forfait,
// import avec apercu, erreurs ligne par ligne, conditionnement, cloisonnement.
import { site, OUT, CHROME } from "./_guard.mjs";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";

const require = createRequire(`${site}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
const ExcelJS = require("exceljs");

const BASE = `http://localhost:${process.argv[2] ?? 3000}`;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let failed = 0;
const report = (label, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "OK    " : "ECHEC "} ${label}${detail ? ` (${detail})` : ""}`); };
const TAG = `ZZ${randomBytes(2).toString("hex")}`;
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const users = [];
async function makeUser(role, name) {
  const email = `test-pricelist-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role, locale: "fr", phone: "+213551234567" } });
  if (error) throw error;
  users.push(data.user.id);
  const jar = new Map();
  const client = createServerClient(url, pub, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value: v }) => (v ? jar.set(n, v) : jar.delete(n))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, jar, client, cookie: () => [...jar].map(([n, v]) => `${n}=${v}`).join("; ") };
}
async function makeProducer(name, tier) {
  const u = await makeUser("producer", name);
  await u.client.from("companies").insert({ company_name: `${name} ${TAG}`, kind: "producer", slug: `test-pl-${name}-${TAG}`.toLowerCase().replace(/\W+/g, "-"), owner_profile_id: u.id, sector: "C29", wilaya: "19", city: "Setif" });
  const { data: co } = await admin.from("companies").select("id").eq("owner_profile_id", u.id).single();
  if (tier !== "starter") await admin.from("companies").update({ subscription_tier: tier }).eq("id", co.id);
  await admin.from("profiles").update({ onboarding_completed: true }).eq("id", u.id);
  return { ...u, companyId: co.id };
}
const download = async (u) => {
  const res = await fetch(`${BASE}/api/catalog/price-list?locale=fr`, { headers: { cookie: u.cookie() }, redirect: "manual" });
  const wb = new ExcelJS.Workbook();
  if (res.status === 200) await wb.xlsx.load(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get("content-type"), wb };
};
const keysOf = (ws) => { const m = new Map(); ws.getRow(2).eachCell((c, i) => m.set(String(c.value), i)); return m; };
const rowOf = (ws, id) => { let found = null; ws.eachRow((r, n) => { if (n >= 5 && r.getCell(1).value === id) found = n; }); return found; };

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9353", `--user-data-dir=${OUT}/profile-pricelist`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
try {
  const starter = await makeProducer("Filtres Setif", "starter");
  const pro = await makeProducer("Filtres Pro", "pro");
  const rival = await makeProducer("Filtres Rival", "starter");
  const buyer = await makeUser("buyer", "Awa Buyer");
  const base = { kind: undefined, hs_code: "8421.31", currency: "EUR", price_basis: "FCA", unit: "unit", min_order_quantity: 1000, status: "draft", source: "producer" };
  delete base.kind;
  const { data: pA, error: ea } = await starter.client.from("products").insert({ ...base, company_id: starter.companyId, product_name: `Filtre a air A ${TAG}`, unit_price_ht: 2 }).select("id").single();
  if (ea) throw ea;
  const { data: pB } = await starter.client.from("products").insert({ ...base, company_id: starter.companyId, product_name: `Filtre a air B ${TAG}`, unit_price_ht: 2.4 }).select("id").single();
  const { data: pP } = await pro.client.from("products").insert({ ...base, company_id: pro.companyId, product_name: `Filtre Pro ${TAG}`, unit_price_ht: 3 }).select("id").single();
  const { data: pR } = await rival.client.from("products").insert({ ...base, company_id: rival.companyId, product_name: `Filtre rival ${TAG}`, unit_price_ht: 9 }).select("id").single();

  // Acces au modele
  const anon = await fetch(`${BASE}/api/catalog/price-list`, { redirect: "manual" });
  report("Visiteur : modele refuse", anon.status === 403 || anon.status === 307, String(anon.status));
  const asBuyer = await download(buyer);
  report("Acheteur : modele refuse", asBuyer.status === 403, String(asBuyer.status));

  // Modele Starter
  const s = await download(starter);
  report("Starter : fichier Excel telecharge", s.status === 200 && /spreadsheetml/.test(s.type ?? ""), `${s.status}`);
  const prices = s.wb.getWorksheet("Liste de prix");
  const pack = s.wb.getWorksheet("Conditionnement");
  report("Feuilles : consignes, liste de prix, conditionnement", Boolean(s.wb.getWorksheet("Consignes") && prices && pack));
  const sk = keysOf(prices);
  report("Modele Starter : prix HT + incoterm, sans couts", sk.has("price") && sk.has("priceBasis") && sk.has("pricePlace") && !sk.has("productCost"), [...sk.keys()].join(","));
  report("Modele : prix en dinars et 3 paliers de remise", sk.has("priceDzd") && ["t1Basis", "t1Threshold", "t1Discount", "t3Discount"].every((k) => sk.has(k)));
  const curList = s.wb.getWorksheet("Listes");
  // Liste des devises : la colonne vers laquelle pointe la validation de la cellule devise.
  const curFormula = String(prices.getCell(5, sk.get("currency")).dataValidation?.formulae?.[0] ?? "");
  const curCol = /!\$([A-Z]+)\$/.exec(curFormula)?.[1];
  const curVals = []; if (curCol) curList?.getColumn(curCol).eachCell((c) => { if (c.value !== null && c.value !== "") curVals.push(String(c.value)); });
  report("Devise export : EUR et USD seulement", curVals.join(",") === "EUR,USD", `${curFormula} -> ${curVals.join(",")}`);
  report("Pre-rempli avec ses 2 produits, sans ceux du concurrent", Boolean(rowOf(prices, pA.id) && rowOf(prices, pB.id)) && !rowOf(prices, pR.id) && !rowOf(prices, pP.id));
  report("Conditionnement : 4 pictogrammes", pack.getImages().length === 4, String(pack.getImages().length));
  report("Listes deroulantes sur la devise", Boolean(prices.getCell(5, sk.get("currency")).dataValidation?.type === "list"));

  // Modification du fichier comme un fournisseur
  const rA = rowOf(prices, pA.id), rB = rowOf(prices, pB.id);
  const set = (ws, keys, row, key, v) => { ws.getCell(row, keys.get(key)).value = v; };
  set(prices, sk, rA, "sku", "AF-018");
  set(prices, sk, rA, "price", 5.5);
  set(prices, sk, rA, "priceDzd", 750);
  // Marge de negociation : -3 % a partir de 5 000 unites, -6 % a partir de 20 000 EUR de commande.
  set(prices, sk, rA, "t1Basis", "Quantité / Quantity");
  set(prices, sk, rA, "t1Threshold", 5000);
  set(prices, sk, rA, "t1Discount", 3);
  set(prices, sk, rA, "t2Basis", "Montant / Amount");
  set(prices, sk, rA, "t2Threshold", 20000);
  set(prices, sk, rA, "t2Discount", 6);
  set(prices, sk, rA, "priceBasis", "FOB");
  set(prices, sk, rA, "pricePlace", "Port d'Alger");
  // Date enregistree par Excel sous son numero de serie (format de cellule perdu).
  set(prices, sk, rA, "priceValidUntil", Math.round((Date.parse(`${day(30)}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 864e5));
  prices.getCell(rA, sk.get("priceValidUntil")).numFmt = "General";
  set(prices, sk, rA, "stock", 1200);
  set(prices, sk, rA, "leadDays", 30);
  set(prices, sk, rA, "crossRefs", "1444 TV, P520A");
  set(prices, sk, rB, "price", "abc");
  let free = 5; while (prices.getCell(free, 1).value) free++;
  set(prices, sk, free, "sku", "AF-099");
  set(prices, sk, free, "productName", `Nouveau filtre ${TAG}`);
  set(prices, sk, free, "unit", "unit");
  set(prices, sk, free, "price", 3);
  set(prices, sk, free, "priceDzd", 400);
  set(prices, sk, free, "currency", "USD");
  set(prices, sk, free, "priceBasis", "FOB");
  set(prices, sk, free, "priceValidUntil", "31/12/2027");
  set(prices, sk, free, "moq", 100);
  set(prices, sk, free + 1, "id", pR.id);
  set(prices, sk, free + 1, "price", 1);
  const pkk = keysOf(pack);
  const pr = rowOf(pack, pA.id);
  // Carton de 20 unites, 380 x 260 x 320 mm, 18,5 kg ; palette de 800 unites (40 cartons).
  // Poids palette volontairement incoherent (44,96 kg < 40 x 18,5 kg) : avertissement attendu.
  const PACK = { pk1Qty: 1, pk2Qty: 20, pk2Length: 380, pk2Width: 260, pk2Height: 320, pk2Weight: 18.5, pk4Qty: 800, pk4Weight: 44.96, maxStack: 5 };
  for (const [k, v] of Object.entries(PACK)) set(pack, pkk, pr, k, v);
  set(pack, pkk, pr, "pk2Type", "Carton / Cardboard box");
  set(pack, pkk, pr, "pk4Type", "Palette Europe 80x120 / Euro pallet 80x120");
  set(pack, pkk, pr, "storage", "ambient");
  set(pack, pkk, pr, "pkLabel", "Étiquette client / Customer label");
  set(pack, pkk, pr, "pkProtection", "Banderolage");
  const FILE = `${OUT}/liste-de-prix-modifiee.xlsx`;
  writeFileSync(FILE, Buffer.from(await s.wb.xlsx.writeBuffer()));

  // Navigateur : import avec apercu
  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9353/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); if (u) for (const [name, value] of u.jar) await send("Network.setCookie", { name, value, url: BASE, path: "/" }); };
  const waitFor = async (cond, tries = 80) => { for (let i = 0; i < tries; i++) { await sleep(400); try { if (await run(cond)) return true; } catch {} } return false; };
  const go = async (path, ready = "return document.readyState === 'complete' && !!document.querySelector('h1');") => { await send("Page.navigate", { url: BASE + path }); await sleep(800); await waitFor(ready); };
  const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  const attach = async (file) => { const { root } = await send("DOM.getDocument"); const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[name=file]" }); await send("DOM.setFileInputFiles", { nodeId, files: [file.replace(/\//g, "\\")] }); await sleep(500); };
  const count = (k) => `Number(document.querySelector('[data-count="${k}"] p:last-child')?.textContent)`;
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("DOM.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });

  await loginAs(starter);
  await go("/fr/catalog", `return !!document.querySelector('[data-download="price-list"]');`);
  report("Catalogue : boutons telecharger et importer", await run(`return !!document.querySelector('a[href$="/catalog/import"]');`));
  await go("/fr/catalog/import", `return !!document.querySelector("input[name=file]");`);
  report("Page d'import : modele unique annonce (prix HT et incoterm)", await run(`return document.body.innerText.includes("prix HT et incoterm (les 11 incoterms 2020)");`));
  await attach(FILE);
  await run(`[...document.querySelectorAll("main button")].find((b) => /vérifier/i.test(b.textContent)).click(); return true;`);
  report("Apercu : 1 mis a jour, 1 nouveau, 2 lignes en erreur", await waitFor(`return ${count("importUpdates")} === 1 && ${count("importCreates")} === 1 && ${count("importIssues")} === 2;`), await run(`return [${count("importUpdates")}, ${count("importCreates")}, ${count("importUnchanged")}, ${count("importIssues")}].join("/");`));
  report("Detail des changements de A : ancien -> nouveau (prix, longueur carton, capacite)", await run(`const li = [...document.querySelectorAll("[data-change]")].find((x) => x.dataset.change.startsWith("AF-018 · Filtre a air A")); const t = li?.innerText.replace(/\\s+/g, " ") ?? ""; return /Prix : 2 → 5,5/.test(t) && /Niveau 2 longueur : – → 380/.test(t) && /Au sol 20 pieds : – → 13\\s?200/.test(t);`), await run(`return [...document.querySelectorAll("[data-change]")].map((x) => x.innerText.replace(/\\s+/g, " ")).join(" | ").slice(0, 600);`));
  report("Avertissement : palette plus legere que son contenu (import possible)", await run(`return document.querySelector("[data-import-warnings]")?.innerText.includes("Niveau 4 : le poids total est inférieur au poids de son contenu");`));
  report("Erreurs : prix invalide (ligne B) et produit inconnu (concurrent)", await run(`const t = document.body.innerText; return t.includes("Ligne ${rB}") && /prix/i.test(t) && t.includes("Produit introuvable dans votre catalogue");`));
  const { data: before } = await admin.from("products").select("unit_price_ht").eq("id", pA.id).single();
  report("Apercu : rien n'est encore enregistre", Number(before.unit_price_ht) === 2);
  await shot("price-list-import");
  await run(`[...document.querySelectorAll("main button")].find((b) => /enregistrer/i.test(b.textContent)).click(); return true;`);
  report("Enregistrement : message, lignes en erreur rappelees", await waitFor(`return document.body.innerText.includes("Import enregistré, sauf les lignes en erreur");`));

  const { data: a } = await admin.from("products").select("*").eq("id", pA.id).single();
  report("En base : A 5,50 FOB Port d'Alger, AF-018, validite, stock 1200 date, delai 30, refs croisees", Number(a.unit_price_ht) === 5.5 && a.price_basis === "FOB" && a.price_place === "Port d'Alger" && a.sku === "AF-018" && a.price_valid_until === day(30) && Number(a.stock_quantity) === 1200 && Boolean(a.stock_updated_at) && a.lead_time_days === 30 && a.cross_refs.join("|") === "1444 TV|P520A", JSON.stringify({ p: a.unit_price_ht, b: a.price_basis, v: a.price_valid_until, s: a.stock_quantity }));
  const spec = a.packaging_spec;
  report("Conditionnement : carton x20, palette Europe 800 / 44,96 kg, etiquette client, banderolage", spec?.levels?.[1]?.type === "carton" && spec.levels[1].qty === 20 && spec.levels[3].type === "pallet_euro" && spec.levels[3].qty === 800 && spec.levels[3].weight_kg === 44.96 && spec.label === "customer" && spec.protection === "stretch", JSON.stringify(spec));
  report("Logistique deduite a l'import : 20 par carton, 40 cartons par palette, capacites palette et sol", Number(a.units_per_carton) === 20 && a.palletized && a.cartons_per_pallet === 40 && a.container_capacity_20ft > 0 && a.container_floor_20ft === 13200 && a.container_floor_40ft === 27000, JSON.stringify({ u: a.units_per_carton, p: a.cartons_per_pallet, c20: a.container_capacity_20ft, f20: a.container_floor_20ft, f40: a.container_floor_40ft }));
  const { data: b } = await admin.from("products").select("unit_price_ht").eq("id", pB.id).single();
  report("Ligne en erreur non appliquee (B inchange)", Number(b.unit_price_ht) === 2.4);
  const { data: created } = await admin.from("products").select("status, unit_price_ht, currency, price_valid_until, company_id").eq("sku", "AF-099").eq("company_id", starter.companyId).maybeSingle();
  report("Nouvelle reference creee en brouillon (date 31/12/2027 lue)", created?.status === "draft" && Number(created.unit_price_ht) === 3 && created.currency === "USD" && created.price_valid_until === "2027-12-31", JSON.stringify(created));
  const { data: priv } = await admin.from("products").select("price_dzd_ht, discount_tiers").eq("id", pA.id).single();
  const tiersA = priv?.discount_tiers ?? [];
  report("A : prix en dinars 750 et paliers (-3 % des 5 000 u., -6 % des 20 000 EUR)", Number(priv?.price_dzd_ht) === 750 && tiersA.length === 2 && tiersA[0].basis === "qty" && tiersA[0].threshold === 5000 && tiersA[0].discount === 3 && tiersA[1].basis === "amount" && tiersA[1].threshold === 20000 && tiersA[1].discount === 6, JSON.stringify(priv));
  const { data: r } = await admin.from("products").select("unit_price_ht").eq("id", pR.id).single();
  report("Produit du concurrent intact", Number(r.unit_price_ht) === 9);

  // Catalogue : validite et filtre
  await go("/fr/catalog", `return !!document.querySelector("main table");`);
  report("Catalogue : reference AF-018 et validite affichees", await run(`const t = document.querySelector("main table").innerText; return t.includes("AF-018") && /valable jusqu'au/i.test(t) && /validité à préciser/i.test(t);`));
  // Le filtre est reapplique a chaque essai : avant l'hydratation de la page, le changement est perdu.
  const STALE = `const s = [...document.querySelectorAll("main select")].find((x) => [...x.options].some((o) => o.value === "stale")); if (s.value !== "stale") { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, "stale"); s.dispatchEvent(new Event("change", { bubbles: true })); }`;
  report("Filtre 'prix a mettre a jour' : B seul (A et AF-099 ont un prix valide)", await waitFor(`${STALE} const t = document.querySelector("main table").innerText; return !t.includes("AF-018") && !t.includes("AF-099") && t.includes("Filtre a air B");`, 20), await run(`return document.querySelector("main table").innerText.replace(/\\s+/g, " ").slice(0, 400);`));
  await shot("price-list-catalog");

  // Grille de remise par defaut du fournisseur (bas du catalogue).
  await go("/fr/catalog", `return !!document.getElementById("dt-t1Basis");`);
  const SETV_TOP = `const setV = (el, v) => { const p = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };`;
  await run(`${SETV_TOP} setV(document.getElementById("dt-t1Basis"), "qty"); setV(document.getElementById("dt-t1Threshold"), "10000"); setV(document.getElementById("dt-t1Discount"), "5"); [...document.querySelectorAll("[data-default-tiers] button[type=submit]")][0].click(); return true;`);
  report("Grille par defaut : enregistree", await waitFor(`return location.search.includes("saved=tiers");`));
  const { data: grid } = await admin.from("supplier_pricing").select("discount_tiers").eq("company_id", starter.companyId).maybeSingle();
  report("En base : -5 % des 10 000 unites (grille par defaut)", grid?.discount_tiers?.[0]?.basis === "qty" && grid.discount_tiers[0].threshold === 10000 && grid.discount_tiers[0].discount === 5, JSON.stringify(grid));

  // Editeur Starter : meme conditionnement saisi a la main sur B -> meme logistique qu'a l'import pour A.
  await go(`/fr/catalog/${pB.id}`, `return !!document.getElementById("pe-price");`);
  report("Editeur Starter : prix HT, incoterm, lieu, validite", await run(`return !!document.getElementById("pe-basis") && !!document.getElementById("pe-place") && !!document.getElementById("pe-valid") && !document.getElementById("pe-cost");`));
  report("Editeur : prix en dinars, devise EUR/USD, paliers et rappel de la grille par defaut", await run(`const cur = [...document.getElementById("pe-currency").options].map((o) => o.value).filter(Boolean).join(","); return !!document.getElementById("pe-dzd") && cur === "EUR,USD" && !!document.getElementById("pe-t3Discount") && document.querySelector("[data-tiers]").innerText.includes("Grille par défaut appliquée si vide");`));
  const SETV = `const setV = (el, v) => { const p = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };`;
  // Saisie reappliquee tant que la page ne reagit pas (avant l'hydratation, les evenements sont perdus).
  const FILL = `${SETV} ${Object.entries(PACK).map(([k, v]) => `setV(document.getElementById(${JSON.stringify(k === "maxStack" ? "pe-stack" : `pe-${k}`)}), ${JSON.stringify(String(v))});`).join(" ")} setV(document.getElementById("pe-pk2Type"), "carton"); setV(document.getElementById("pe-pk4Type"), "pallet_euro"); setV(document.getElementById("pe-dzd"), "900"); document.querySelector("input[name=storage][value=ambient]").click();`;
  report("Editeur : meme avertissement que l'import", await waitFor(`if (!document.querySelector("[data-pack-warnings]")) { ${FILL} } return document.querySelector("[data-pack-warnings]")?.innerText.includes("Niveau 4 : le poids total est inférieur au poids de son contenu");`, 30));
  report("Editeur : capacites palette et au sol affichees", await run(`return !!document.querySelector("[data-mode='pallet'][data-container='20']") && document.querySelector("[data-mode='floor'][data-container='20']").innerText.replace(/\\s/g, "").includes("13200");`));
  await run(`[...document.querySelectorAll("button[type=submit]")].find((b) => b.value === "draft").click(); return true;`);
  await waitFor(`return location.pathname === "/fr/catalog";`);
  const cols = "units_per_carton, carton_length_cm, carton_width_cm, carton_height_cm, carton_gross_weight_kg, max_stack_layers, storage_condition, palletized, cartons_per_pallet, container_capacity_20ft, container_capacity_40ft, container_floor_20ft, container_floor_40ft";
  const { data: viaExcel } = await admin.from("products").select(cols).eq("id", pA.id).single();
  const { data: viaEditor } = await admin.from("products").select(cols).eq("id", pB.id).single();
  report("Meme resultat logistique par l'editeur et par Excel", JSON.stringify(viaExcel) === JSON.stringify(viaEditor), `${JSON.stringify(viaExcel)} / ${JSON.stringify(viaEditor)}`);

  // Ancien forfait Pro : meme modele unique que tous (21 novembre 2026), les 11 incoterms 2020.
  const p = await download(pro);
  const pw = p.wb.getWorksheet("Liste de prix");
  const pk = keysOf(pw);
  report("Modele unique pour tous : prix HT + incoterm, sans couts ni FCA calcule", pk.has("price") && pk.has("priceBasis") && pk.has("pricePlace") && !pk.has("productCost") && !pk.has("fca"), [...pk.keys()].join(","));
  const basisFormula = String(pw.getCell(5, pk.get("priceBasis")).dataValidation?.formulae?.[0] ?? "");
  const basisCol = /!\$([A-Z]+)\$/.exec(basisFormula)?.[1];
  const basisVals = []; if (basisCol) p.wb.getWorksheet("Listes")?.getColumn(basisCol).eachCell((c) => { if (c.value !== null && c.value !== "") basisVals.push(String(c.value)); });
  report("Incoterms proposes : les 11 d'Incoterms 2020", basisVals.join(",") === "EXW,FCA,FAS,FOB,CFR,CIF,CPT,CIP,DAP,DPU,DDP", basisVals.join(","));
  // Fichier de l'ancien modele (cout produit + cout emballage) : toujours importable, repris en FCA.
  const prow = rowOf(pw, pP.id);
  pw.getCell(2, pk.get("price")).value = "productCost";
  pw.getCell(2, pk.get("priceBasis")).value = "packagingCost";
  pw.getCell(prow, pk.get("price")).value = 1.6;
  pw.getCell(prow, pk.get("priceBasis")).value = 0.4;
  pw.getCell(prow, pk.get("priceDzd")).value = 300;
  pw.getCell(prow, pk.get("priceValidUntil")).value = new Date(`${day(60)}T00:00:00Z`);
  const PRO_FILE = `${OUT}/liste-de-prix-ancien-modele.xlsx`;
  writeFileSync(PRO_FILE, Buffer.from(await p.wb.xlsx.writeBuffer()));
  await loginAs(pro);
  await go("/fr/catalog/import", `return !!document.querySelector("input[name=file]");`);
  await attach(PRO_FILE);
  await run(`[...document.querySelectorAll("main button")].find((b) => /vérifier/i.test(b.textContent)).click(); return true;`);
  await waitFor(`return ${count("importUpdates")} === 1;`);
  await run(`[...document.querySelectorAll("main button")].find((b) => /enregistrer/i.test(b.textContent)).click(); return true;`);
  report("Ancien modele : import sans erreur, retour au catalogue", await waitFor(`return location.pathname === "/fr/catalog" && location.search.includes("imported=1");`));
  const { data: pp } = await admin.from("products").select("unit_price_ht, product_cost, packaging_cost, price_basis").eq("id", pP.id).single();
  report("En base : prix 2,00 FCA (1,60 + 0,40), couts effaces", Number(pp.unit_price_ht) === 2 && pp.product_cost === null && pp.packaging_cost === null && pp.price_basis === "FCA", JSON.stringify(pp));
  await go(`/fr/catalog/${pP.id}`, `return !!document.getElementById("pe-price");`);
  report("Editeur : un seul prix et les 11 incoterms, plus de couts", await run(`return !document.getElementById("pe-cost") && !document.querySelector("[data-fca]") && [...document.getElementById("pe-basis").options].map((o) => o.value).join() === "EXW,FCA,FAS,FOB,CFR,CIF,CPT,CIP,DAP,DPU,DDP" && document.getElementById("pe-basis").value === "FCA";`));

  // Confidentialite des couts
  const anonClient = createClient(url, pub, { auth: { persistSession: false } });
  const { error: costErr } = await anonClient.from("products").select("product_cost").limit(1);
  const { error: skuErr } = await anonClient.from("products").select("sku").limit(1);
  report("Public : couts illisibles, reference lisible", Boolean(costErr) && !skuErr, costErr?.code);
  const { error: dzdErr } = await anonClient.from("products").select("price_dzd_ht").limit(1);
  const { error: tiersErr } = await anonClient.from("products").select("discount_tiers").limit(1);
  report("Public : prix en dinars et paliers illisibles", Boolean(dzdErr) && Boolean(tiersErr), `${dzdErr?.code} ${tiersErr?.code}`);
  const { data: rivalGrid } = await rival.client.from("supplier_pricing").select("company_id").eq("company_id", starter.companyId);
  report("Concurrent : grille par defaut de l'autre invisible", rivalGrid?.length === 0);
  const { data: rivalPrices } = await rival.client.rpc("product_prices", { p_company: starter.companyId });
  report("Concurrent : aucun prix ni cout de l'autre fournisseur", (rivalPrices ?? []).length === 0);

  // Feuille Conditionnement laissee vide (ancien modele) : la fiche existante n'est jamais effacee.
  await loginAs(starter);
  const again = await download(starter);
  const pk2 = again.wb.getWorksheet("Conditionnement");
  const k2 = keysOf(pk2);
  const rowA = rowOf(pk2, pA.id);
  for (const [key, col] of k2) if (!["id", "sku", "productName"].includes(key)) pk2.getCell(rowA, col).value = null;
  const BLANK_FILE = `${OUT}/liste-de-prix-conditionnement-vide.xlsx`;
  writeFileSync(BLANK_FILE, Buffer.from(await again.wb.xlsx.writeBuffer()));
  await go("/fr/catalog/import", `return !!document.querySelector("input[name=file]");`);
  await attach(BLANK_FILE);
  await run(`[...document.querySelectorAll("main button")].find((b) => /vérifier/i.test(b.textContent)).click(); return true;`);
  report("Conditionnement vide dans le fichier : aucun effacement propose", await waitFor(`return ${count("importUpdates")} === 0 && ${count("importUnchanged")} >= 1 && ![...document.querySelectorAll("[data-change]")].some((x) => x.dataset.change.startsWith("AF-018"));`), await run(`return [${count("importUpdates")}, ${count("importUnchanged")}].join("/") + " " + [...document.querySelectorAll("[data-change]")].map((x) => x.innerText.replace(/\\s+/g, " ")).join(" | ");`));

  await go(`/ar/catalog/import`, `return !!document.querySelector("input[name=file]");`);
  report("Import en arabe (RTL)", await run(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("استيراد قائمة أسعاري");`));
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  console.log("Nettoyage :", users.length, "comptes supprimes");
  await sleep(300);
  try { rmSync(`${OUT}/profile-pricelist`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
