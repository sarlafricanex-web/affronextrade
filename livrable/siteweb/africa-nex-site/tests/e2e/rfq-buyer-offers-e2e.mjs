// Test de bout en bout du lot 5e : l'acheteur voit les offres AFRICA NEX (lignes, fret, total),
// demande une autre devise, accepte une offre (son alternative est ecartee, l'offre complementaire
// reste a decider), refuse l'autre avec un motif ; la console admin voit chaque decision.
import { site, OUT, CHROME } from "./_guard.mjs";
import { waitEmails, delivered } from "./_emails.mjs";
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
  const email = `test-offers-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role: role === "admin" ? "buyer" : role, locale: "fr" } });
  if (error) throw error;
  users.push(data.user.id);
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const jar = new Map();
  const client = createServerClient(url, pub, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value: v }) => (v ? jar.set(n, v) : jar.delete(n))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, jar, client };
}

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9358", `--user-data-dir=${OUT}/profile-buyer-offers`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
let rfqId = null;
try {
  const boss = await makeUser("admin", "Admin Offres");
  const buyer = await makeUser("buyer", "Acheteur Offres");
  const other = await makeUser("buyer", "Autre Acheteur");

  // Demande a deux lignes, offres deja publiees par AFRICA NEX.
  const { data: rfq, error: rfqError } = await admin.from("rfqs").insert({ buyer_profile_id: buyer.id, title: `Panier ${TAG}`, currency: "EUR", incoterm: "CIF", destination_country: "CI", status: "offered" }).select("id, reference").single();
  if (rfqError) throw rfqError;
  rfqId = rfq.id;
  const { data: lines, error: linesError } = await admin.from("rfq_lines").insert([
    { rfq_id: rfqId, position: 1, description: "Huile 1 L", quantity: 100, unit: "carton" },
    { rfq_id: rfqId, position: 2, description: "Dattes 5 kg", quantity: 50, unit: "carton" },
    { rfq_id: rfqId, position: 3, description: "Piment doux", quantity: 20, unit: "carton" },
  ]).select("id, position").order("position");
  if (linesError) throw linesError;
  async function offer(label, currency, line, unitPrice, over = {}) {
    const total = unitPrice * line.qty;
    const { data, error } = await admin.from("offers").insert({ rfq_id: rfqId, label, currency, incoterm: "CIF", incoterm_place: "Abidjan", total_amount: total + (over.freight_amount ?? 0), status: "published", published_at: new Date().toISOString(), valid_until: day(10), payment_terms: "30 % à la commande", cagex_insured: true, ...over }).select("id").single();
    if (error) throw error;
    await admin.from("offer_lines").insert({ offer_id: data.id, rfq_line_id: line.id, position: 1, description: line.description, quantity: line.qty, unit: "carton", unit_price: unitPrice, total_amount: total, incoterm: "CIF", lead_time_days: 20, availability: "stock" });
    await admin.from("offer_margins").insert({ offer_id: data.id, auto: true, export_mode: "self", commission_rate: 10, commission_amount: 99, producer_currency: currency });
    return data.id;
  }
  const L1 = { id: lines[0].id, description: "Huile 1 L", qty: 100 }, L2 = { id: lines[1].id, description: "Dattes 5 kg", qty: 50 };
  await offer("A", "EUR", L1, 11, { freight_amount: 120 });
  await offer("A2", "USD", L1, 12);
  const oB = await offer("B", "EUR", L2, 22.2);
  const statusOf = async () => Object.fromEntries(((await admin.from("offers").select("label, status, decline_reason, currency_change_to, currency_change_note").eq("rfq_id", rfqId)).data ?? []).map((o) => [o.label, o]));

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9358/json/list")).json()).find((t) => t.type === "page"); } catch { /* Chrome demarre */ } }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); if (m.error) reject(new Error(m.error.message)); else resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); if (u) for (const [name, value] of u.jar) await send("Network.setCookie", { name, value, url: BASE, path: "/" }); };
  const waitFor = async (cond, tries = 60) => { for (let i = 0; i < tries; i++) { await sleep(400); try { if (await run(cond)) return true; } catch { /* page en chargement */ } } return false; };
  const go = async (path, ready) => { await send("Page.navigate", { url: BASE + path }); await sleep(800); await waitFor(ready); };
  const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  const card = (label) => `document.querySelector('[data-buyer-offer="${label}"]')`;
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });
  const page = `/fr/rfq/${rfqId}`;
  const ready = `return document.readyState === "complete" && !!document.querySelector("[data-buyer-offers]");`;

  // Affichage des offres
  await loginAs(buyer);
  await go(page, ready);
  report("3 offres affichees", await run(`return document.querySelector("[data-buyer-offers]").dataset.buyerOffers === "3" && !!${card("A")} && !!${card("A2")} && !!${card("B")};`));
  report("Offre A : prix unitaire 11,00 EUR, fret 120, total 1 220 EUR", await run(`const c = ${card("A")}; return c.innerText.includes("11,00") && c.querySelector("[data-offer-freight]").dataset.offerFreight === "120" && c.querySelector("[data-offer-total]").dataset.offerTotal === "1220";`));
  report("A et A2 signalees comme alternatives (memes produits), pas B", await run(`return !!${card("A")}.querySelector("[data-alternative]") && !!${card("A2")}.querySelector("[data-alternative]") && !${card("B")}.querySelector("[data-alternative]");`));
  report("Produit sans offre signale (piment doux)", await run(`const p = document.querySelector("[data-lines-pending]"); return p?.dataset.linesPending === "1" && p.innerText.includes("Piment doux");`));
  report("Aucune donnee du calcul a l'ecran (commission, marge)", await run(`const t = document.body.innerText.toLowerCase(); return !t.includes("commission") && !t.includes("marge") && !t.includes("99,00");`));
  const { data: buyerMargins } = await buyer.client.from("offer_margins").select("offer_id");
  const { data: otherOffers } = await other.client.from("offers").select("id").eq("rfq_id", rfqId);
  report("Acheteur : marges illisibles ; un autre acheteur ne voit pas les offres", !buyerMargins?.length && !otherOffers?.length);
  const { error: otherAccept } = await other.client.rpc("accept_offer", { p_offer_id: oB });
  report("Un autre acheteur ne peut pas accepter l'offre", !!otherAccept);
  await shot("buyer-offers");

  // Demande de changement de devise sur B
  await run(`${card("B")}.querySelector('[data-action="currency"] summary').click(); return true;`);
  await run(`const f = ${card("B")}.querySelector('[data-action="currency"] form'); f.querySelector("select").value = "USD"; f.querySelector("textarea").value = "Paiement en dollars ${TAG}"; f.querySelector("button[type=submit]").click(); return true;`);
  report("Devise : demande envoyee", await waitFor(`return document.querySelector('[data-offer-notice="currencyRequested"]') && !!${card("B")}?.querySelector('[data-currency-requested="USD"]');`));
  let s = await statusOf();
  report("En base : B toujours publiee, devise USD demandee avec la precision", s.B.status === "published" && s.B.currency_change_to === "USD" && s.B.currency_change_note === `Paiement en dollars ${TAG}`, JSON.stringify(s.B));
  report("Le bouton de devise disparait une fois la demande faite", await run(`return !${card("B")}.querySelector('[data-action="currency"]');`));

  // Acceptation de A
  await run(`${card("A")}.querySelector('[data-action="accept"] summary').click(); return true;`);
  report("Confirmation : l'alternative A2 sera ecartee", await waitFor(`return ${card("A")}.querySelector('[data-action="accept"] form').innerText.includes("A2");`, 10));
  await run(`${card("A")}.querySelector('[data-action="accept"] button[type=submit]').click(); return true;`);
  report("Acceptation : message", await waitFor(`return !!document.querySelector('[data-offer-notice="accepted"]');`));
  s = await statusOf();
  let { data: rfqNow } = await admin.from("rfqs").select("status").eq("id", rfqId).single();
  report("En base : A acceptee, A2 ecartee, B toujours a decider, demande encore en offres pretes", s.A.status === "accepted" && s.A2.status === "declined" && s.B.status === "published" && rfqNow.status === "offered", `${s.A.status} ${s.A2.status} ${s.B.status} / ${rfqNow.status}`);
  report("Affichage : A acceptee, A2 non retenue, total accepte", await run(`return ${card("A")}.dataset.status === "accepted" && ${card("A2")}.dataset.status === "declined" && !${card("A")}.querySelector('[data-action]') && document.querySelector("[data-accepted-total]").innerText.replace(/\\s/g, " ").includes("1 220,00 EUR");`), await run(`return [${card("A")}.dataset.status, ${card("A2")}.dataset.status, !!${card("A")}.querySelector('[data-action]'), document.querySelector("[data-accepted-total]")?.innerText].join(" | ");`));

  // Console admin : la demande de devise est visible
  await loginAs(boss);
  await go("/fr/admin/rfqs", `return !!document.querySelector("h1");`);
  report("Console : la demande est marquee \"devise demandee\"", await run(`return [...document.querySelectorAll("tr, li")].some((r) => r.innerText.includes("Panier ${TAG}") && r.querySelector("[data-currency-asked]"));`));
  await go(`/fr/admin/rfqs/${rfqId}`, `return !!document.querySelector('[data-offer="B"]');`);
  report("Fiche admin : devise demandee et precision de l'acheteur sur B", await run(`const b = document.querySelector('[data-offer="B"] [data-currency-request="USD"]'); return !!b && b.innerText.includes("Paiement en dollars ${TAG}");`));

  // Refus de B avec motif
  await loginAs(buyer);
  await go(page, ready);
  await run(`${card("B")}.querySelector('[data-action="decline"] summary').click(); return true;`);
  await run(`const f = ${card("B")}.querySelector('[data-action="decline"] form'); f.querySelector("textarea").value = "Délai trop long"; f.querySelector("button[type=submit]").click(); return true;`);
  report("Refus : message", await waitFor(`return !!document.querySelector('[data-offer-notice="declined"]');`));
  s = await statusOf();
  ({ data: rfqNow } = await admin.from("rfqs").select("status").eq("id", rfqId).single());
  report("En base : B non retenue avec son motif, la demande passe acceptee", s.B.status === "declined" && s.B.decline_reason === "Délai trop long" && rfqNow.status === "accepted", `${JSON.stringify(s.B)} / ${rfqNow.status}`);
  report("Affichage : motif rappele, plus aucun bouton de decision", await run(`return ${card("B")}.innerText.includes("Votre motif : Délai trop long") && !document.querySelector("[data-action]");`));

  await loginAs(boss);
  await go(`/fr/admin/rfqs/${rfqId}`, `return !!document.querySelector('[data-offer="B"]');`);
  report("Fiche admin : motif de l'acheteur visible", await run(`return document.querySelector('[data-offer="B"] [data-decline-reason]')?.innerText.includes("Délai trop long");`));

  // Telephone et arabe
  await loginAs(buyer);
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await go(page, ready);
  report("Telephone : la page ne deborde pas", await run(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`), await run(`return document.documentElement.scrollWidth + " / " + window.innerWidth;`));
  await shot("buyer-offers-mobile");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });
  await go(`/ar/rfq/${rfqId}`, ready);
  const decisions = await waitEmails(admin, { rfq_id: rfqId, kind: "admin_decision" }, { count: 3 });
  const subjects = decisions.map((m) => m.subject).join(" | ");
  report("Emails a AFRICA NEX : devise demandee, acceptation, refus", decisions.length === 3 && delivered(decisions) && subjects.includes("Changement de devise demandé") && subjects.includes("Offre A acceptée") && subjects.includes("Offre B non retenue"), subjects);
  report("Arabe : offres traduites", await run(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("عروض تفاوضت عليها AFRICA NEX");`));
  await shot("buyer-offers-ar");
  ws.close();
} catch (e) {
  failed++;
  console.error("ERREUR", e);
} finally {
  chrome.kill();
  if (rfqId) await admin.from("rfqs").delete().eq("id", rfqId);
  await admin.from("audit_log").delete().in("actor_profile_id", users);
  for (const u of users) await admin.auth.admin.deleteUser(u);
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
