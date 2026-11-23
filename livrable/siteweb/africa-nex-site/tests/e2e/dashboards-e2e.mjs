// Test de bout en bout de la semaine 6 : tableaux de bord producteur et acheteur (chiffres reels),
// page Tarifs (zones et devises, pas de "success fee"), Mon abonnement, menus, telephone et arabe.
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
const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();

const users = [];
async function makeUser(role, name) {
  const email = `test-dash-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role: role === "admin" ? "buyer" : role, locale: "fr", phone: "+2250701020304" } });
  if (error) throw error;
  users.push(data.user.id);
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const jar = new Map();
  const client = createServerClient(url, pub, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value: v }) => (v ? jar.set(n, v) : jar.delete(n))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, jar, client };
}

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9361", `--user-data-dir=${OUT}/profile-dash`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
const rfqIds = [];
try {
  const producer = await makeUser("producer", "Karim Tableau");
  const buyer = await makeUser("buyer", "Aminata Tableau");
  const boss = await makeUser("admin", "Admin Tableau");

  // Producteur : fiche, 2 produits (dont 1 prix expire), 3 demandes recues, vues de la fiche.
  await producer.client.from("companies").insert({ company_name: `Huilerie Tableau ${TAG}`, kind: "producer", slug: `test-dash-${TAG}`.toLowerCase(), owner_profile_id: producer.id, sector: "C10", wilaya: "06", city: "Akbou" });
  await admin.from("profiles").update({ onboarding_completed: true }).eq("id", producer.id);
  const { data: pc } = await admin.from("companies").select("id").eq("owner_profile_id", producer.id).single();
  await admin.from("products").insert([
    { company_id: pc.id, product_name: "Huile 1 L", unit: "carton", status: "draft", unit_price_ht: 10, currency: "EUR", price_valid_until: day(-5) },
    { company_id: pc.id, product_name: "Huile 5 L", unit: "carton", status: "draft", unit_price_ht: 40, currency: "EUR", price_valid_until: day(60) },
  ]);
  const views = [...Array(3)].map(() => ({ company_id: pc.id, viewer_country: "CI", created_at: ago(3) }));
  views.push({ company_id: pc.id, viewer_country: "SN", created_at: ago(10) }, { company_id: pc.id, viewer_country: "CI", created_at: ago(40) }, { company_id: pc.id, viewer_country: "NG", created_at: ago(45) });
  await admin.from("profile_views").insert(views);

  // Acheteur : profil rempli, une demande avec 2 offres publiees, une demande envoyee, une acceptee.
  await buyer.client.from("companies").insert({ company_name: `Abidjan Tableau ${TAG}`, kind: "buyer", slug: `test-dash-b-${TAG}`.toLowerCase(), owner_profile_id: buyer.id, country: "CI", city: "Abidjan", buyer_type: "importer", interests: ["C10"] });
  await admin.from("profiles").update({ onboarding_completed: true }).eq("id", buyer.id);
  const mkRfq = async (title, status) => {
    const { data, error } = await admin.from("rfqs").insert({ buyer_profile_id: buyer.id, title: `${title} ${TAG}`, currency: "EUR", incoterm: "CIF", destination_country: "CI", status }).select("id, reference").single();
    if (error) throw error;
    rfqIds.push(data.id);
    return data;
  };
  const rOffered = await mkRfq("Huile d'olive", "offered");
  await mkRfq("Dattes", "submitted");
  const rAccepted = await mkRfq("Couscous", "accepted");
  for (const [rfq, label, status] of [[rOffered, "A", "published"], [rOffered, "B", "published"], [rAccepted, "A", "accepted"]]) {
    await admin.from("offers").insert({ rfq_id: rfq.id, label, currency: "EUR", incoterm: "CIF", unit_price: 5, quantity: 100, total_amount: 500, status, published_at: new Date().toISOString(), valid_until: day(10) });
  }
  await admin.from("messages").insert({ rfq_id: rOffered.id, sender_profile_id: boss.id, sender_role: "admin", body: "Bonjour" });

  // Demandes recues par le producteur : une urgente sans devis (+ message non lu), un devis retenu, un devis en attente.
  const brief = (rfq) => ({ rfq_id: rfq.id, company_id: pc.id, brief_title: `Brief ${TAG}`, quantity: 100, unit: "carton", destination_country: "CI", created_by: boss.id });
  const { data: d1 } = await admin.from("rfq_dispatches").insert({ ...brief(rOffered), respond_by: day(1) }).select("id").single();
  const { data: d2 } = await admin.from("rfq_dispatches").insert({ ...brief(rAccepted), respond_by: day(5) }).select("id").single();
  const rOther = await mkRfq("Figues", "dispatched");
  const { data: d3 } = await admin.from("rfq_dispatches").insert({ ...brief(rOther), respond_by: day(5) }).select("id").single();
  const quote = { company_id: pc.id, author_profile_id: producer.id, unit_price_ht: 4, currency: "EUR", price_basis: "FOB", quantity: 100, valid_until: day(20) };
  const { error: qe } = await admin.from("quotes").insert([{ ...quote, dispatch_id: d2.id, status: "selected" }, { ...quote, dispatch_id: d3.id, status: "submitted" }]);
  if (qe) throw qe;
  await admin.from("messages").insert({ rfq_id: rOffered.id, dispatch_id: d1.id, sender_profile_id: boss.id, sender_role: "admin", body: "Question" });

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9361/json/list")).json()).find((t) => t.type === "page"); } catch { /* Chrome demarre */ } }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); if (m.error) reject(new Error(m.error.message)); else resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); if (u) for (const [name, value] of u.jar) await send("Network.setCookie", { name, value, url: BASE, path: "/" }); };
  const waitFor = async (cond, tries = 60) => { for (let i = 0; i < tries; i++) { await sleep(400); try { if (await run(cond)) return true; } catch { /* chargement */ } } return false; };
  const go = async (path, ready) => { await send("Page.navigate", { url: BASE + path }); await sleep(800); await waitFor(ready); };
  const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  const kpi = (k) => run(`return document.querySelector('[data-kpi="${k}"] [data-kpi-value]')?.dataset.kpiValue;`);
  const noOverflow = () => run(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`);
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });

  // Tableau de bord producteur
  await loginAs(producer);
  await go("/fr/dashboard", `return !!document.querySelector('[data-dashboard="producer"]');`);
  const pk = { views: await kpi("views"), received: await kpi("received"), quotes: await kpi("quotes"), selection: await kpi("selection") };
  report("Producteur : 4 vues sur 30 jours, 3 demandes, 2 devis, 50 % de selection", pk.views === "4" && pk.received === "3" && pk.quotes === "2" && pk.selection === "50 %", JSON.stringify(pk));
  report("Producteur : variation des vues (+100 % sur les 30 jours precedents)", await run(`return document.querySelector('[data-kpi="views"]').innerText.includes("+100 %");`));
  report("Producteur : actions (demande urgente, message, prix expire, fiche a completer)", await run(`const ids = [...document.querySelectorAll("[data-action-item]")].map((e) => e.dataset.actionItem); return ids.some((i) => i.startsWith("req-")) && ids.some((i) => i.startsWith("msg-")) && ids.includes("prices") && ids.includes("profile") && document.querySelector('[data-action-item^="req-"]').textContent.includes("Urgent");`), await run(`return [...document.querySelectorAll("[data-action-item]")].map((e) => e.dataset.actionItem.slice(0, 4)).join(",");`));
  report("Producteur : pays des visiteurs (Cote d'Ivoire en tete, pas les vues de plus de 30 jours)", await run(`const c = document.querySelector("[data-countries]"); return c.dataset.countries === "2" && c.querySelector("li").innerText.includes("Côte d") && !c.innerText.includes("Nigeria") && !c.innerText.includes("Nigéria");`));
  report("Producteur : forfait Vitrine (abonnements) et lien Mon abonnement", await run(`return document.querySelector("[data-tier]").dataset.tier === "vitrine" && !!document.querySelector('nav a[href$="/subscription"]');`));
  report("Producteur : aucune mention inventee (ALGEX, ZLECAf, douane)", await run(`const t = document.body.innerText; return !/ALGEX|ZLECAf|douane/i.test(t);`));
  await shot("dashboard-producer");
  await go("/fr/subscription", `return !!document.querySelector("[data-subscription]");`);
  report("Mon abonnement : forfait Starter, passage au Pro propose, pas de paiement en ligne", await run(`return document.querySelector("[data-current-plan]").dataset.currentPlan === "starter" && document.body.innerText.includes("Passer au forfait Pro") && document.body.innerText.includes("Aucun paiement en ligne") && !/renouvellement|actif/i.test(document.querySelector("main")?.innerText ?? document.body.innerText);`));
  await shot("subscription");
  await loginAs(buyer);
  await go("/fr/subscription", `return document.readyState === "complete" && !!document.querySelector("h1");`);
  report("Mon abonnement reserve aux producteurs (l'acheteur est renvoye)", await run(`return !document.querySelector("[data-subscription]") && location.pathname.endsWith("/dashboard");`));

  // Tableau de bord acheteur
  await go("/fr/dashboard", `return !!document.querySelector('[data-dashboard="buyer"]');`);
  const bk = { inProgress: await kpi("inProgress"), toDecide: await kpi("toDecide"), accepted: await kpi("accepted") };
  report("Acheteur : 3 demandes en cours, 2 offres a decider, 1 acceptee", bk.inProgress === "3" && bk.toDecide === "2" && bk.accepted === "1", JSON.stringify(bk));
  report("Acheteur : action requise (offres pretes et message non lu)", await run(`const a = document.querySelector("[data-buyer-actions]"); return a?.dataset.buyerActions === "2" && a.innerText.includes("${rOffered.reference}");`));
  report("Acheteur : dernieres demandes avec leur frise", await run(`return document.body.innerText.includes("Huile d'olive ${TAG}") && document.body.innerText.includes("Dattes ${TAG}");`));
  report("Acheteur : rien de faux (pas de bon de commande, pas de session securisee)", await run(`return !/bon de commande|session sécurisée/i.test(document.body.innerText);`));
  await shot("dashboard-buyer");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await go("/fr/dashboard", `return !!document.querySelector('[data-dashboard="buyer"]');`);
  report("Telephone : tableau de bord acheteur sans debordement", await noOverflow());
  await loginAs(producer);
  await go("/fr/dashboard", `return !!document.querySelector('[data-dashboard="producer"]');`);
  report("Telephone : tableau de bord producteur sans debordement", await noOverflow());
  await shot("dashboard-producer-mobile");

  // Page Tarifs (visiteur)
  await loginAs(null);
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });
  await go("/fr/pricing", `return document.querySelectorAll("[data-plan]").length === 3;`);
  const prices = () => run(`return [...document.querySelectorAll("[data-plan] [data-price]")].map((e) => e.dataset.price).join(",");`);
  report("Tarifs : Algerie 20 000 / 50 000 / 120 000 DZD", (await prices()) === "20000,50000,120000", await prices());
  await run(`document.querySelector('[data-zone="eu"]').click(); return true;`);
  report("Tarifs : Europe 290 / 790 EUR / sur devis", await waitFor(`return [...document.querySelectorAll("[data-plan] [data-price]")].map((e) => e.dataset.price).join(",") === "290,790,quote" && document.body.innerText.includes("Sur devis");`, 10));
  report("Tarifs : commission 10 / 7 / 5 %, pas de success fee ni de studio packaging", await run(`const t = document.body.innerText; return t.includes("10 %") && t.includes("7 %") && t.includes("5 %") && !/success|1,5 %|packaging/i.test(t);`));
  report("Tarifs : lien dans l'en-tete du site", await run(`return [...document.querySelectorAll("header a")].some((a) => a.getAttribute("href")?.endsWith("/pricing") && a.innerText.trim() === "Tarifs");`));
  report("Ordinateur : l'en-tete a 7 liens ne deborde pas", await noOverflow());
  await shot("pricing");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await go("/fr/pricing", `return document.querySelectorAll("[data-plan]").length === 3;`);
  report("Telephone : page Tarifs sans debordement", await noOverflow());
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });
  await go("/ar/pricing", `return document.querySelectorAll("[data-plan]").length === 3;`);
  report("Arabe : page Tarifs traduite", await run(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("باقات للتصدير");`));
  await shot("pricing-ar");
  await loginAs(producer);
  await go("/ar/dashboard", `return !!document.querySelector('[data-dashboard="producer"]');`);
  report("Arabe : tableau de bord producteur traduit", await run(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("فضاء المنتج");`));
  ws.close();
} catch (e) {
  failed++;
  console.error("ERREUR", e);
} finally {
  chrome.kill();
  for (const r of rfqIds) await admin.from("rfqs").delete().eq("id", r);
  for (const u of users) {
    const { data: cs } = await admin.from("companies").select("id").eq("owner_profile_id", u);
    for (const c of cs ?? []) { await admin.from("products").delete().eq("company_id", c.id); await admin.from("companies").delete().eq("id", c.id); }
  }
  await admin.from("audit_log").delete().in("actor_profile_id", users);
  for (const u of users) await admin.auth.admin.deleteUser(u);
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
