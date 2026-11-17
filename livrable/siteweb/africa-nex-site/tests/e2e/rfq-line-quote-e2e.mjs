// Test de bout en bout de la consultation par ligne (lot 6d) : une ligne sans prix est envoyee aux
// producteurs, leurs devis entrent dans le calcul (le moins cher d'office, ou celui retenu par AFRICA NEX),
// le devis utilise suit la publication et le retrait de l'offre, confidentialite.
import { site, OUT, CHROME } from "./_guard.mjs";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const require = createRequire(`${site}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");

const BASE = `http://localhost:${process.argv[2] ?? 3000}`;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let failed = 0;
const report = (label, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "OK    " : "ECHEC "} ${label}${detail ? ` (${detail})` : ""}`); };
const TAG = `zz${randomBytes(2).toString("hex")}`;
const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

const users = [];
async function makeUser(role, name) {
  const email = `test-line-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role: role === "admin" ? "buyer" : role, locale: "fr" } });
  if (error) throw error;
  users.push(data.user.id);
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const jar = new Map();
  const client = createServerClient(url, pub, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value: v }) => (v ? jar.set(n, v) : jar.delete(n))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, jar, client };
}

const companies = [];
// Producteur avec son propre compte : il cree sa fiche (brouillon), AFRICA NEX fixe son mode.
async function producerCompany(user, name) {
  const { error } = await user.client.from("companies").insert({ company_name: `${name} ${TAG}`, kind: "producer", slug: `test-line-${name}-${TAG}`.toLowerCase(), owner_profile_id: user.id, sector: "C10", wilaya: "19", city: "Setif" });
  if (error) throw error;
  const { data } = await admin.from("companies").select("id").eq("owner_profile_id", user.id).single();
  companies.push(data.id);
  await admin.from("supplier_settings").upsert({ company_id: data.id, export_mode: "self" });
  return data.id;
}

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9359", `--user-data-dir=${OUT}/profile-line`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
let rfqId = null;
try {
  const boss = await makeUser("admin", "Admin Ligne");
  const buyer = await makeUser("buyer", "Acheteur Ligne");
  const prodA = await makeUser("producer", "Producteur A");
  const prodB = await makeUser("producer", "Producteur B");
  const coA = await producerCompany(prodA, "harissa-a");
  const coB = await producerCompany(prodB, "harissa-b");

  // Fournisseur au catalogue pour la ligne 1.
  const { data: s1 } = await admin.from("companies").insert({ company_name: `Catalogue ${TAG}`, kind: "producer", slug: `test-line-cat-${TAG}`, sector: "C10", visibility: "draft" }).select("id").single();
  companies.push(s1.id);
  await admin.from("supplier_settings").upsert({ company_id: s1.id, export_mode: "self" });
  const { data: p1 } = await admin.from("products").insert({ company_id: s1.id, product_name: "Huile 1 L", unit: "carton", unit_price_ht: 10, currency: "EUR", price_basis: "FOB", price_valid_until: day(60), stock_quantity: 1000, status: "draft" }).select("id").single();

  const { data: rfq } = await admin.from("rfqs").insert({ buyer_profile_id: buyer.id, title: `Panier ${TAG}`, currency: "EUR", incoterm: "FOB", destination_country: "SN", status: "qualified" }).select("id").single();
  rfqId = rfq.id;
  const { data: lines } = await admin.from("rfq_lines").insert([
    { rfq_id: rfqId, position: 1, product_id: p1.id, description: "Huile 1 L", quantity: 100, unit: "carton" },
    { rfq_id: rfqId, position: 2, product_id: null, description: "Harissa 200 g", reference: "HAR-200", quantity: 50, unit: "carton" },
  ]).select("id, position");
  const line2 = lines.find((l) => l.position === 2).id;

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9359/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); if (u) for (const [name, value] of u.jar) await send("Network.setCookie", { name, value, url: BASE, path: "/" }); };
  const waitFor = async (cond, tries = 60) => { for (let i = 0; i < tries; i++) { await sleep(400); try { if (await run(cond)) return true; } catch {} } return false; };
  const go = async (path, ready) => { await send("Page.navigate", { url: BASE + path }); await sleep(800); await waitFor(ready); };
  const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });
  const page = `/fr/admin/rfqs/${rfqId}`;
  const panelReady = `return !!document.querySelector("[data-auto-offers]");`;
  const prices = () => run(`return [...document.querySelectorAll("[data-buyer-price]")].map((e) => Number(e.dataset.buyerPrice));`);

  // 1. Ligne sans prix : bouton de consultation
  await loginAs(boss);
  await go(page, panelReady);
  report("Ligne 2 sans prix : signalee avec un bouton Consulter", await run(`return !!document.querySelector('[data-skipped-line="2"] [data-consult="2"]');`));

  // 2. Brief de la ligne, prerempli
  await run(`document.querySelector('[data-consult="2"]').click(); return true;`);
  report("Formulaire de consultation pour la ligne 2", await waitFor(`return document.querySelector("[data-consult-line]")?.dataset.consultLine === "2";`));
  report("Brief prerempli avec la ligne seule (titre, reference, quantite)", await run(`return document.getElementById("d-title").value === "Harissa 200 g" && document.getElementById("d-specs").value.includes("HAR-200") && document.getElementById("d-qty").value === "50" && document.getElementById("d-unit").value === "carton";`));
  await run(`for (const name of ["Harissa-a ${TAG}", "Harissa-b ${TAG}"]) { const li = [...document.querySelectorAll("#dispatch li")].find((l) => l.textContent.toLowerCase().includes(name.toLowerCase())); li.querySelector("input[type=checkbox]").click(); } return true;`);
  await shot("line-consult-form");
  await run(`[...document.querySelectorAll("#dispatch button[type=submit]")].pop().click(); return true;`);
  report("Brief envoye a 2 producteurs : message", await waitFor(`return location.search.includes("done=lineDispatch") && document.body.innerText.includes("Brief de la ligne envoyé à 2 producteurs");`));
  const { data: dispatches } = await admin.from("rfq_dispatches").select("id, company_id, rfq_line_id, brief_title, quantity, unit").eq("rfq_id", rfqId);
  report("En base : 2 briefs rattaches a la ligne 2", dispatches?.length === 2 && dispatches.every((d) => d.rfq_line_id === line2 && d.brief_title === "Harissa 200 g" && Number(d.quantity) === 50), JSON.stringify(dispatches));

  // 3. Les producteurs repondent avec le formulaire de devis habituel (ici par leur session)
  const dA = dispatches.find((d) => d.company_id === coA), dB = dispatches.find((d) => d.company_id === coB);
  const { data: seenByA } = await prodA.client.from("rfq_dispatches").select("id, brief_title");
  report("Producteur A : voit son seul brief, sans l'acheteur", seenByA?.length === 1 && seenByA[0].id === dA.id && !JSON.stringify(seenByA).includes("Acheteur"));
  const quoteOf = (u, co, d, price) => u.client.from("quotes").insert({ dispatch_id: d.id, company_id: co, author_profile_id: u.id, unit_price_ht: price, currency: "EUR", price_basis: "FOB", port_of_loading: "Oran", quantity: 50, production_lead_days: 15, valid_until: day(30) }).select("id").single();
  const { data: qA, error: eA } = await quoteOf(prodA, coA, dA, 9);
  const { data: qB, error: eB } = await quoteOf(prodB, coB, dB, 7);
  report("Devis deposes par A (9 EUR) et B (7 EUR)", !eA && !eB, `${eA?.message ?? ""} ${eB?.message ?? ""}`);

  // 4. Le calcul prend le moins cher
  await go(page, panelReady);
  report("Plus de ligne non chiffree", await run(`return !document.querySelector("[data-auto-skipped]");`));
  report("Ligne 2 chiffree depuis un devis", await run(`return document.querySelector('[data-auto-line="2"] [data-source]')?.dataset.source === "quote";`));
  report("Prix acheteur : 11 (catalogue) et 7,70 (devis B, le moins cher, commission 10 %)", JSON.stringify(await prices()) === "[11,7.7]", JSON.stringify(await prices()));
  report("Comparatif : devis B marque utilise, ligne indiquee", await run(`const tr = document.querySelector('[data-quote="${qB.id}"]'); return !!tr?.querySelector("[data-used]") && tr.querySelector("[data-quote-line]")?.dataset.quoteLine === "2";`));
  await shot("line-quote-cheapest");

  // 5. AFRICA NEX retient le devis A
  await run(`document.querySelector('[data-choose="${qA.id}"]').click(); return true;`);
  report("Devis A retenu : message", await waitFor(`return location.search.includes("done=lineQuoteChosen");`));
  await waitFor(panelReady);
  report("Le calcul utilise le devis A (9,90)", JSON.stringify(await prices()) === "[11,9.9]", JSON.stringify(await prices()));
  report("Comparatif : A retenu et utilise", await run(`const tr = document.querySelector('[data-quote="${qA.id}"]'); return !!tr?.querySelector("[data-chosen]") && !!tr.querySelector("[data-used]");`));

  // 6. Brouillon, publication, retrait
  await run(`[...document.querySelectorAll("button[type=submit]")].find((b) => b.textContent.includes("Créer les brouillons")).click(); return true;`);
  await waitFor(`return location.search.includes("done=autoCreated");`);
  const { data: offers } = await admin.from("offers").select("id, label, offer_lines(position, unit_price, offer_line_margins(quote_id, company_id, product_id))").eq("rfq_id", rfqId);
  const l2 = offers?.[0]?.offer_lines?.find((l) => l.position === 2);
  const m2 = Array.isArray(l2?.offer_line_margins) ? l2.offer_line_margins[0] : l2?.offer_line_margins;
  report("En base : la ligne 2 garde le devis A et son producteur", offers?.length === 1 && Number(l2?.unit_price) === 9.9 && m2?.quote_id === qA.id && m2.company_id === coA && m2.product_id === null, JSON.stringify(offers));
  await run(`document.querySelector('[data-offer="A"] form button[type=submit]').click(); return true;`);
  report("Offre publiee", await waitFor(`return location.search.includes("done=offerPublished");`));
  const status = async () => Object.fromEntries(((await admin.from("quotes").select("id, status").in("id", [qA.id, qB.id])).data ?? []).map((q) => [q.id, q.status]));
  let st = await status();
  report("Publication : devis A retenu (selected), B inchange", st[qA.id] === "selected" && st[qB.id] === "submitted", JSON.stringify(st));
  await go(page, `return !!document.querySelector('[data-offer="A"]');`);
  await run(`[...document.querySelectorAll('[data-offer="A"] form button[type=submit]')].find((b) => b.textContent.includes("Retirer")).click(); return true;`);
  await waitFor(`return location.search.includes("done=offerWithdrawn");`);
  st = await status();
  report("Retrait : devis A redevient en attente", st[qA.id] === "submitted", JSON.stringify(st));

  // 7. Retour au moins cher
  await waitFor(panelReady);
  await run(`document.querySelector('[data-choose="auto"]').click(); return true;`);
  await waitFor(`return location.search.includes("done=lineQuoteAuto");`);
  await waitFor(panelReady);
  report("Retour au moins cher : le calcul reprend le devis B", JSON.stringify(await prices()) === "[11,7.7]", JSON.stringify(await prices()));

  // 8. Confidentialite
  const { data: choicesB } = await prodB.client.from("rfq_line_choices").select("rfq_line_id");
  const { data: buyerQuotes } = await buyer.client.from("quotes").select("id");
  const { data: quotesSeenByB } = await prodB.client.from("quotes").select("id");
  report("Producteur B : ne voit ni le choix d'AFRICA NEX ni le devis de A", choicesB?.length === 0 && quotesSeenByB?.length === 1 && quotesSeenByB[0].id === qB.id);
  report("Acheteur : ne voit aucun devis de producteur", buyerQuotes?.length === 0);
  ws.close();
} catch (e) {
  failed++;
  console.error("ERREUR", e);
} finally {
  chrome.kill();
  if (rfqId) await admin.from("rfqs").delete().eq("id", rfqId);
  for (const c of companies) { await admin.from("products").delete().eq("company_id", c); await admin.from("companies").delete().eq("id", c); }
  await admin.from("audit_log").delete().in("actor_profile_id", users);
  for (const u of users) await admin.auth.admin.deleteUser(u);
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
