// Test de bout en bout du calcul automatique de l'offre (lot 6c) : demande multi-lignes chiffree
// depuis les listes de prix, repartition par mode et par devise, palier de commission sur le total,
// brouillons crees, publication bloquee tant que marge ou fret restent a saisir, confidentialite.
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
  const email = `test-auto-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
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
async function supplier(name, tier, mode, owner) {
  const { data, error } = await admin.from("companies").insert({ company_name: `${name} ${TAG}`, kind: "producer", slug: `test-auto-${name}-${TAG}`.toLowerCase(), owner_profile_id: owner ?? null, sector: "C10", subscription_tier: tier, visibility: "draft" }).select("id").single();
  if (error) throw error;
  companies.push(data.id);
  await admin.from("supplier_settings").upsert({ company_id: data.id, export_mode: mode });
  return data.id;
}
async function product(company_id, fields) {
  const { data, error } = await admin.from("products").insert({ company_id, unit: "carton", status: "draft", price_valid_until: day(60), lead_time_days: 7, ...fields }).select("id, unit_price_ht").single();
  if (error) throw error;
  return data;
}

// Taux de reference de la base de dev partagee : remis en etat a la fin.
const { data: ratesBefore } = await admin.from("fx_rates").select("*");
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9357", `--user-data-dir=${OUT}/profile-auto`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
let rfqId = null;
try {
  const boss = await makeUser("admin", "Admin Calcul");
  const buyer = await makeUser("buyer", "Acheteur Calcul");
  const producer = await makeUser("producer", "Producteur Calcul");
  await admin.from("fx_rates").upsert([{ currency: "EUR", dzd_per_unit: 150 }, { currency: "USD", dzd_per_unit: 135 }]);

  // Trois fournisseurs : Starter en intermediation, Pro en intermediation, Starter exporte par AFRICA NEX.
  const s1 = await supplier("starter", "starter", "self");
  const s2 = await supplier("pro", "pro", "self", producer.id);
  const s3 = await supplier("export", "starter", "africanex");
  const p1 = await product(s1, { product_name: "Huile 1 L", unit_price_ht: 10, currency: "EUR", price_basis: "FOB", price_place: "Alger", stock_quantity: 1000 });
  const p2 = await product(s2, { product_name: "Dattes 5 kg", product_cost: 18, packaging_cost: 2, currency: "EUR", price_basis: "FCA", stock_quantity: 10, lead_time_days: 30, discount_tiers: [{ basis: "qty", threshold: 50, discount: 4 }] });
  const p3 = await product(s3, { product_name: "Couscous 1 kg", unit_price_ht: 9, currency: "EUR", price_dzd_ht: 3000, stock_quantity: 500 });
  report("Forfait Pro : prix FCA calcule en base (18 + 2)", Number(p2.unit_price_ht) === 20, String(p2.unit_price_ht));

  const { data: rfq, error: rfqError } = await admin.from("rfqs").insert({ buyer_profile_id: buyer.id, title: `Panier ${TAG}`, currency: "EUR", incoterm: "CIF", destination_country: "CI", status: "qualified" }).select("id").single();
  if (rfqError) throw rfqError;
  rfqId = rfq.id;
  const { error: linesError } = await admin.from("rfq_lines").insert([
    { rfq_id: rfqId, position: 1, product_id: p1.id, description: "Huile 1 L", quantity: 100, unit: "carton" },
    { rfq_id: rfqId, position: 2, product_id: p2.id, description: "Dattes 5 kg", quantity: 100, unit: "carton" },
    { rfq_id: rfqId, position: 3, product_id: p3.id, description: "Couscous 1 kg", quantity: 50, unit: "carton" },
    { rfq_id: rfqId, position: 4, product_id: null, description: "Piment doux en poudre", quantity: 20, unit: "carton" },
  ]);
  if (linesError) throw linesError;

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9357/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); if (u) for (const [name, value] of u.jar) await send("Network.setCookie", { name, value, url: BASE, path: "/" }); };
  const waitFor = async (cond, tries = 60) => { for (let i = 0; i < tries; i++) { await sleep(400); try { if (await run(cond)) return true; } catch {} } return false; };
  const go = async (path, ready = "return document.readyState === 'complete' && !!document.querySelector('h1');") => { await send("Page.navigate", { url: BASE + path }); await sleep(800); await waitFor(ready); };
  const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });
  const page = `/fr/admin/rfqs/${rfqId}`;

  // Apercu du calcul
  await loginAs(boss);
  await go(page, `return !!document.querySelector("[data-auto-offers]");`);
  const blocks = await run(`return document.querySelector("[data-auto-offers]").dataset.autoOffers + " " + [...document.querySelectorAll("[data-auto-offer]")].map((e) => e.dataset.autoOffer + ":" + e.dataset.incoterm).join();`);
  report("Apercu : 3 offres (intermediation FOB, intermediation CIF, export AFRICA NEX CIF)", blocks === "3 self-EUR:FOB,self-EUR:CIF,africanex-EUR:CIF", blocks);
  report("Palier sur le total de la demande (4 000 EUR) : 10 %", await run(`return document.querySelector("[data-commission-rate]").dataset.commissionRate === "10";`));
  const prices = await run(`return [...document.querySelectorAll("[data-buyer-price]")].map((e) => Number(e.dataset.buyerPrice));`);
  report("Prix acheteur : Starter 11, Pro 22,20 (+ assurance), export 20,60 (+ assurance et change)", JSON.stringify(prices) === JSON.stringify([11, 22.2, 20.6]), JSON.stringify(prices));
  report("Ligne hors catalogue signalee", await run(`const s = document.querySelector("[data-auto-skipped]"); return s?.dataset.autoSkipped === "1" && !!s.querySelector('[data-issue="noProduct"]');`));
  report("Stock insuffisant : delai de production affiche", await run(`return document.querySelector('[data-auto-line="2"]').innerText.includes("À produire · 30 j");`));
  report("Remise maximale du fournisseur visible (4 %)", await run(`return document.querySelector('[data-auto-line="2"]').innerText.includes("4 %");`));
  report("Fret et marge signales a saisir (rien pour le Starter en FOB)", await run(`const b = [...document.querySelectorAll("[data-auto-offer]")]; return !b[0].querySelector("[data-pending]") && !!b[1].querySelector('[data-pending="freight"]') && !b[1].querySelector('[data-pending="margin"]') && !!b[2].querySelector('[data-pending="margin"]') && !!b[2].querySelector('[data-pending="freight"]');`));
  await shot("auto-offer-preview");

  // Telephone : pas de debordement de la page
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await go(page, `return !!document.querySelector("[data-auto-offers]");`);
  report("Telephone : la page ne deborde pas", await run(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`), await run(`return document.documentElement.scrollWidth + " / " + window.innerWidth;`));
  await shot("auto-offer-mobile");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });
  await go(page, `return !!document.querySelector("[data-auto-offers]");`);

  // Creation des brouillons
  await run(`[...document.querySelectorAll("button[type=submit]")].find((b) => b.textContent.includes("Créer les brouillons")).click(); return true;`);
  report("Brouillons crees : message", await waitFor(`return location.search.includes("done=autoCreated") && document.body.innerText.includes("3 offres calculées créées en brouillon");`));
  const offersOf = async () => (await admin.from("offers").select("id, label, status, currency, incoterm, incoterm_place, valid_until, payment_terms, total_amount, freight_amount, unit_price, offer_margins(auto, export_mode, margin_pending, freight_pending, commission_rate, commission_amount, margin_rate, margin_amount, freight_cost), offer_lines(id, position, unit_price, total_amount, offer_line_margins(company_id, supplier_unit_price, supplier_currency, max_discount_rate, margin_amount, commission_amount))").eq("rfq_id", rfqId).order("label")).data ?? [];
  let offers = await offersOf();
  const m = (o) => (Array.isArray(o.offer_margins) ? o.offer_margins[0] : o.offer_margins);
  const [oa, ob, oc] = offers;
  report("En base : offre A intermediation FOB, 1 ligne, 1 100 EUR, commission 10 %, rien a saisir", offers.length === 3 && oa.label === "A" && oa.incoterm === "FOB" && m(oa).export_mode === "self" && oa.offer_lines.length === 1 && Number(oa.total_amount) === 1100 && Number(m(oa).commission_rate) === 10 && !m(oa).freight_pending && oa.unit_price === null, JSON.stringify(oa));
  report("En base : offre B intermediation CIF (Pro), 2 220 EUR, fret a saisir", ob?.label === "B" && ob.incoterm === "CIF" && m(ob).export_mode === "self" && Number(ob.total_amount) === 2220 && m(ob).freight_pending, JSON.stringify(ob));
  report("En base : offre C export AFRICA NEX, marge a saisir", oc?.label === "C" && m(oc).export_mode === "africanex" && m(oc).margin_pending && Number(oc.total_amount) === 1030, JSON.stringify(oc));
  const lm = oc?.offer_lines?.[0]?.offer_line_margins;
  const lineMargin = Array.isArray(lm) ? lm[0] : lm;
  report("En base : prix fournisseur en dinars conserve (3 000 DZD)", Number(lineMargin?.supplier_unit_price) === 3000 && lineMargin.supplier_currency === "DZD");
  report("Liste des offres : badges a saisir", await run(`return !document.querySelector('[data-offer="A"] [data-pending]') && !!document.querySelector('[data-offer="B"] [data-pending="freight"]') && !!document.querySelector('[data-offer="C"] [data-pending="margin"]');`));

  // Confidentialite
  const { data: buyerLines } = await buyer.client.from("offer_lines").select("id");
  const { data: buyerMargins } = await buyer.client.from("offer_line_margins").select("offer_line_id");
  const { data: prodLines } = await producer.client.from("offer_lines").select("id");
  const { error: prodRpc } = await producer.client.rpc("offer_auto_inputs", { p_rfq: rfqId });
  report("Acheteur : rien de lisible tant que l'offre est en brouillon", buyerLines?.length === 0 && buyerMargins?.length === 0);
  report("Producteur : ni lignes, ni donnees du calcul", prodLines?.length === 0 && !!prodRpc);

  // Publication bloquee
  await run(`document.querySelector('[data-offer="C"] form button[type=submit]').click(); return true;`);
  report("Publication refusee tant que la marge est a saisir", await waitFor(`return location.search.includes("done=offerPending");`));
  offers = await offersOf();
  const { data: rfqAfter } = await admin.from("rfqs").select("status").eq("id", rfqId).single();
  report("L'offre reste en brouillon et la demande ne passe pas en offres pretes", offers.every((o) => o.status === "draft") && rfqAfter.status === "qualified", `${rfqAfter.status}`);

  // Recalcul : les brouillons sont remplaces, sans doublon
  await go(page, `return !!document.querySelector("[data-auto-offers]");`);
  await run(`[...document.querySelectorAll("button[type=submit]")].find((b) => b.textContent.includes("Recalculer les brouillons")).click(); return true;`);
  await waitFor(`return location.search.includes("done=autoCreated");`);
  offers = await offersOf();
  report("Recalcul : toujours 3 offres (A, B, C), nouveaux identifiants", offers.length === 3 && offers.map((o) => o.label).join() === "A,B,C" && offers[0].id !== oa.id);

  // Lot 6e : AFRICA NEX complete les offres calculees (marge, fret, commission, conditions)
  const SET = `const setV = (el, v) => { const p = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };`;
  const fill = (values) => run(`${SET} for (const [sel, v] of Object.entries(${JSON.stringify(values)})) setV(document.querySelector(sel), v); return true;`);
  const press = (label) => run(`[...document.querySelectorAll("button[type=submit]")].find((b) => b.textContent.includes(${JSON.stringify(label)})).click(); return true;`);
  const [, offB, offC] = offers;
  const editor = (o) => `/fr/admin/rfqs/${rfqId}/offers/${o.id}`;

  await go(page, `return !!document.querySelector("[data-offers], [data-offer]");`);
  report("Liste des offres : bouton Completer sur les offres calculees", await run(`return !!document.querySelector('[data-complete="B"]') && !!document.querySelector('[data-complete="C"]');`));

  await go(editor(offC), `return !!document.querySelector("[data-calc]");`);
  report("Ecran de saisie : fournisseur et cout visibles (AFRICA NEX seule)", await run(`return document.querySelector('[data-edit-line="1"]').innerText.includes("export ${TAG}") && !!document.querySelector("#a-margin") && !!document.querySelector("#a-freight") && !document.querySelector("#a-commission");`));
  await fill({ "#a-margin": "8", "#a-freight": "120" });
  report("Apercu : marge 8 % + change 2 % + assurance 1 % = 22,20 EUR, total avec fret 1 230 EUR", await waitFor(`return document.querySelector("[data-edit-price]").dataset.editPrice === "22.2" && document.querySelector("[data-edit-total]").dataset.editTotal === "1230";`, 10));
  await fill({ "#a-valid": day(45) });
  await press("Enregistrer et publier");
  report("Validite au-dela de 30 jours refusee", await waitFor(`return !!document.querySelector('[data-error="validUntil"]');`));
  await fill({ "#a-valid": day(20), "#a-notes": `Fabrique par export ${TAG}` });
  await press("Enregistrer et publier");
  report("Garde-fou d'anonymat : un fournisseur nomme est refuse", await waitFor(`return !!document.querySelector('[data-error="notes"]');`));
  await fill({ "#a-notes": "Livraison groupée", "#a-pay": "30 % à la commande", "#a-place": "Abidjan" });
  await press("Enregistrer et publier");
  report("Offre C completee et publiee", await waitFor(`return location.search.includes("done=offerPublished");`));
  offers = await offersOf();
  const c2 = offers.find((o) => o.label === "C");
  const cl = c2.offer_lines[0], clm = Array.isArray(cl.offer_line_margins) ? cl.offer_line_margins[0] : cl.offer_line_margins;
  report("En base : C publiee, prix 22,20, fret 120 en ligne separee, total 1 230, marge 8 % (80 EUR)", c2.status === "published" && Number(cl.unit_price) === 22.2 && Number(cl.total_amount) === 1110 && Number(c2.freight_amount) === 120 && Number(c2.total_amount) === 1230 && Number(m(c2).margin_rate) === 8 && Number(m(c2).margin_amount) === 80 && Number(clm.margin_amount) === 80 && !m(c2).margin_pending && !m(c2).freight_pending && c2.incoterm_place === "Abidjan" && c2.payment_terms === "30 % à la commande", JSON.stringify(c2));
  const { data: rfqOffered } = await admin.from("rfqs").select("status").eq("id", rfqId).single();
  report("La demande passe en offres pretes", rfqOffered.status === "offered", rfqOffered.status);

  await go(editor(offB), `return !!document.querySelector("[data-calc]");`);
  report("Offre B (intermediation) : commission de la grille proposee, pas de marge", await run(`return document.querySelector("#a-commission").value === "10" && !document.querySelector("#a-margin");`));
  await fill({ "#a-commission": "5" });
  report("Apercu : commission 5 % + assurance 1 % = 21,20 EUR", await waitFor(`return document.querySelector("[data-edit-price]").dataset.editPrice === "21.2";`, 10));
  await press("Enregistrer et publier");
  report("Publication refusee sans fret : message sous le champ", await waitFor(`return !!document.querySelector('[data-error="freight"]');`));
  await press("Enregistrer en brouillon");
  report("Brouillon enregistre sans fret", await waitFor(`return location.search.includes("done=offerSaved");`));
  offers = await offersOf();
  const b2 = offers.find((o) => o.label === "B");
  report("En base : B en brouillon, commission 5 % (100 EUR), total 2 120, fret toujours a saisir", b2.status === "draft" && Number(m(b2).commission_rate) === 5 && Number(m(b2).commission_amount) === 100 && Number(b2.total_amount) === 2120 && m(b2).freight_pending && b2.freight_amount === null, JSON.stringify(b2));
  await go(editor(offB), `return !!document.querySelector("[data-calc]");`);
  report("La commission saisie est conservee a la reouverture", await run(`return document.querySelector("#a-commission").value === "5";`));

  const { data: buyerOffers } = await buyer.client.from("offers").select("label, total_amount, freight_amount");
  const { data: buyerLines2 } = await buyer.client.from("offer_lines").select("unit_price");
  const { data: buyerLm } = await buyer.client.from("offer_line_margins").select("margin_amount");
  const { data: buyerM } = await buyer.client.from("offer_margins").select("margin_amount");
  report("Acheteur : voit l'offre C (lignes et fret), jamais la marge ni le brouillon B", buyerOffers?.length === 1 && buyerOffers[0].label === "C" && Number(buyerOffers[0].freight_amount) === 120 && buyerLines2?.length === 1 && Number(buyerLines2[0].unit_price) === 22.2 && !buyerLm?.length && !buyerM?.length, JSON.stringify({ buyerOffers, buyerLines2, buyerLm, buyerM }));

  await go(editor(offC), `return !!document.querySelector("h1");`);
  report("Offre publiee : consultation seule", await run(`return !document.querySelector("[data-calc]") && document.body.innerText.includes("Cette offre est publiée");`));
  await shot("auto-offer-edit-locked");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await go(editor(offB), `return !!document.querySelector("[data-calc]");`);
  report("Telephone : l'ecran de saisie ne deborde pas", await run(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`), await run(`return document.documentElement.scrollWidth + " / " + window.innerWidth;`));
  await shot("auto-offer-edit-mobile");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });

  // Arabe (RTL) : le panneau s'affiche
  await go(`/ar/admin/rfqs/${rfqId}`, `return !!document.querySelector("[data-auto-offers]");`);
  report("Arabe : panneau traduit", await run(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("عرض محسوب من قوائم الأسعار");`));
  await shot("auto-offer-ar");
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
  await admin.from("fx_rates").delete().in("currency", ["EUR", "USD"]);
  if (ratesBefore?.length) await admin.from("fx_rates").insert(ratesBefore);
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
