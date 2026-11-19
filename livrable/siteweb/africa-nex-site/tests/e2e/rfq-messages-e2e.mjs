// Test de bout en bout du lot 5f : fils de messages acheteur <-> AFRICA NEX et producteur <-> AFRICA NEX,
// jamais acheteur <-> producteur. Garde-fous d'anonymat des messages d'AFRICA NEX, messages lus et
// non lus (listes, menus), question sur une offre, fil ferme, cloisonnement entre producteurs.
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
  const email = `test-msg-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role: role === "admin" ? "buyer" : role, locale: "fr", phone: "+2250701020304" } });
  if (error) throw error;
  users.push(data.user.id);
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const jar = new Map();
  const client = createServerClient(url, pub, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value: v }) => (v ? jar.set(n, v) : jar.delete(n))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, email, jar, client };
}

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9359", `--user-data-dir=${OUT}/profile-messages`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
let rfqId = null;
try {
  const buyer = await makeUser("buyer", `Awa Messages ${TAG}`);
  const producer = await makeUser("producer", "Karim Messages");
  const rival = await makeUser("producer", "Rival Messages");
  const boss = await makeUser("admin", "Admin Messages");
  const buyerName = `Abidjan Foods ${TAG}`;
  await buyer.client.from("companies").insert({ company_name: buyerName, kind: "buyer", slug: `test-msg-b-${TAG}`.toLowerCase(), owner_profile_id: buyer.id, country: "CI", city: "Abidjan", buyer_type: "importer", interests: ["C10"] });
  await admin.from("profiles").update({ onboarding_completed: true }).eq("id", buyer.id);
  const { data: bc } = await admin.from("companies").select("id").eq("owner_profile_id", buyer.id).single();
  const producerName = `Huilerie Message ${TAG}`;
  for (const [u, n] of [[producer, producerName], [rival, `Huilerie Rivale ${TAG}`]]) {
    await u.client.from("companies").insert({ company_name: n, kind: "producer", slug: `test-${n}`.toLowerCase().replace(/\W+/g, "-"), owner_profile_id: u.id, sector: "C10", wilaya: "06", city: "Akbou" });
  }
  const { data: pc } = await admin.from("companies").select("id").eq("owner_profile_id", producer.id).single();
  const { data: rc } = await admin.from("companies").select("id").eq("owner_profile_id", rival.id).single();
  const { data: rfq } = await buyer.client.from("rfqs").insert({ buyer_profile_id: buyer.id, buyer_company_id: bc.id, title: `Huile d'olive ${TAG}`, quantity: 2000, unit: "l", incoterm: "CIF", destination_country: "CI" }).select("id").single();
  rfqId = rfq.id;
  const brief = { rfq_id: rfqId, brief_title: `Huile d'olive 5 L ${TAG}`, quantity: 2000, unit: "l", destination_country: "CI", requested_incoterm: "FOB", respond_by: day(5), created_by: boss.id };
  const { data: d1, error: de } = await admin.from("rfq_dispatches").insert({ ...brief, company_id: pc.id }).select("id").single();
  if (de) throw de;
  const { data: d2 } = await admin.from("rfq_dispatches").insert({ ...brief, company_id: rc.id }).select("id").single();
  await admin.from("rfqs").update({ status: "offered" }).eq("id", rfqId);
  await admin.from("offers").insert({ rfq_id: rfqId, label: "A", currency: "EUR", incoterm: "CIF", unit_price: 4.5, quantity: 2000, total_amount: 9000, status: "published", published_at: new Date().toISOString(), valid_until: day(10) });
  const msgs = async () => (await admin.from("messages").select("dispatch_id, sender_role, body, read_at").eq("rfq_id", rfqId).order("created_at")).data ?? [];

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9359/json/list")).json()).find((t) => t.type === "page"); } catch { /* Chrome demarre */ } }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); if (m.error) reject(new Error(m.error.message)); else resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); if (u) for (const [name, value] of u.jar) await send("Network.setCookie", { name, value, url: BASE, path: "/" }); };
  const waitFor = async (cond, tries = 60) => { for (let i = 0; i < tries; i++) { await sleep(400); try { if (await run(cond)) return true; } catch { /* page en chargement */ } } return false; };
  const go = async (path, ready = `return document.readyState === "complete" && !!document.querySelector("#messages");`) => { await send("Page.navigate", { url: BASE + path }); await sleep(800); await waitFor(ready); };
  const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  const SET = `const setV = (el, v) => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };`;
  // Ecrit et envoie un message dans le formulaire choisi (fil acheteur "buyer" ou id d'envoi).
  const post = (form, body) => run(`${SET} const f = document.querySelector('[data-message-form="${form}"]'); setV(f.querySelector("textarea"), ${JSON.stringify(body)}); f.querySelector("button[type=submit]").click(); return true;`);
  const until = async (cond, tries = 25) => { for (let i = 0; i < tries; i++) { if (await cond()) return true; await sleep(400); } return false; };
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });
  const buyerPage = `/fr/rfq/${rfqId}`, adminPage = `/fr/admin/rfqs/${rfqId}`;

  // Acheteur : premier message, depuis le bouton de question de l'offre A
  await loginAs(buyer);
  await go(buyerPage);
  report("Acheteur : fil vide avec invitation a ecrire", await run(`return document.querySelector("#messages").innerText.includes("Aucun message pour l'instant");`));
  await run(`document.querySelector('[data-ask="A"]').click(); return true;`);
  report("Question sur l'offre A : message prerempli", await waitFor(`return location.search.includes("about=A") && document.querySelector('[data-message-form="buyer"] textarea').value.startsWith("À propos de l'offre A");`));
  await post("buyer", `À propos de l'offre A : le bidon de 5 L est-il en fer-blanc ? ${TAG}`);
  report("Acheteur : message envoye et affiche (non lu)", await waitFor(`const m = document.querySelector('#messages [data-message="buyer"]'); return !!m && m.textContent.includes("fer-blanc") && m.textContent.includes("Non lu");`));
  const { data: buyerLeak } = await buyer.client.from("messages").insert({ rfq_id: rfqId, dispatch_id: d1.id, sender_profile_id: buyer.id, sender_role: "buyer", body: "Intrusion" }).select("id");
  report("Acheteur : impossible d'ecrire dans le fil d'un producteur", !buyerLeak?.length);

  // Console : message non lu signale, fil ouvert d'office, puis marque lu
  await loginAs(boss);
  await go("/fr/admin/rfqs", `return !!document.querySelector("h1");`);
  report("Console : la demande porte le repere \"message non lu\"", await run(`return [...document.querySelectorAll("tr, li")].some((r) => r.innerText.includes("Huile d'olive ${TAG}") && r.querySelector("[data-unread]"));`));
  await go(adminPage);
  report("Fiche admin : fil acheteur ouvert avec 1 non lu", await run(`const t = document.querySelector('[data-thread="buyer"]'); return t.open && t.querySelector('[data-thread-unread="1"]') && t.innerText.includes("fer-blanc");`));
  report("Le message de l'acheteur passe lu apres l'ouverture", await until(async () => (await msgs()).find((m) => m.sender_role === "buyer")?.read_at));
  await post("buyer", `Oui, en fer-blanc, chez ${producerName}.`);
  report("Garde-fou : AFRICA NEX ne peut pas nommer le producteur a l'acheteur", await waitFor(`return !!document.querySelector('[data-message-error="errorLeakProducer"]') && document.querySelector('[data-message-form="buyer"] textarea').value.includes("fer-blanc");`));
  await post("buyer", "Oui, bidons en fer-blanc vernis, palettisés.");
  report("Reponse a l'acheteur envoyee", await waitFor(`return location.search.includes("msg=sent") && document.querySelector('[data-thread="buyer"]').innerText.includes("palettisés");`));

  await go(`${adminPage}?thread=${d1.id}`);
  await post(d1.id, `L'acheteur ${buyerName} demande du fer-blanc.`);
  report("Garde-fou : AFRICA NEX ne peut pas nommer l'acheteur au producteur", await waitFor(`return !!document.querySelector('[data-message-error="errorLeakBuyer"]');`));
  await post(d1.id, "Pouvez-vous confirmer des bidons 5 L en fer-blanc vernis ?");
  report("Message au producteur envoye, fil du producteur ouvert", await waitFor(`const t = document.querySelector('[data-thread="${d1.id}"]'); return location.search.includes("msg=sent") && t.open && t.innerText.includes("fer-blanc vernis");`));

  // Acheteur : reponse non lue signalee dans la liste, puis lue a l'ouverture
  await loginAs(buyer);
  await go("/fr/rfq", `return !!document.querySelector("h1");`);
  report("Acheteur : \"Nouveau message\" dans Mes demandes", await run(`return [...document.querySelectorAll("tr, li")].some((r) => r.innerText.includes("Huile d'olive ${TAG}") && r.querySelector('[data-unread="1"]'));`));
  await go(buyerPage);
  report("Acheteur : reponse d'AFRICA NEX affichee, son message marque lu", await run(`const t = document.querySelector("#messages"); return t.querySelector('[data-message="admin"]')?.innerText.includes("palettisés") && t.querySelector('[data-message="buyer"]').textContent.includes("Lu") && !t.querySelector('[data-message="buyer"]').textContent.includes("Non lu");`));
  report("La reponse passe lue pour l'acheteur", await until(async () => (await msgs()).filter((m) => !m.dispatch_id && m.sender_role === "admin").every((m) => m.read_at)));
  report("Acheteur : rien du fil producteur", await run(`return !document.body.innerText.includes("fer-blanc vernis ?");`));
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await go(buyerPage);
  report("Telephone : la page ne deborde pas", await run(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`), await run(`return document.documentElement.scrollWidth + " / " + window.innerWidth;`));
  await run(`document.querySelector("#messages").scrollIntoView(); return true;`);
  await shot("messages-buyer-mobile");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });

  // Producteur : message d'AFRICA NEX, reponse ; le producteur rival ne voit rien
  await loginAs(producer);
  await go("/fr/requests", `return !!document.querySelector("h1");`);
  report("Producteur : \"Nouveau message\" dans Demandes recues", await run(`return !!document.querySelector('[data-unread="1"]');`));
  await go(`/fr/requests/${d1.id}`);
  report("Producteur : message d'AFRICA NEX affiche, rien de l'acheteur", await run(`const t = document.querySelector("#messages"); return t.innerText.includes("fer-blanc vernis ?") && !document.body.innerText.includes("${buyerName}") && !t.innerText.includes("palettisés");`));
  await post(d1.id, "Confirmé : fer-blanc vernis, 4 bidons par carton.");
  report("Producteur : reponse envoyee", await waitFor(`return location.search.includes("msg=sent") && document.querySelector("#messages").innerText.includes("4 bidons par carton");`));
  const { data: rivalSees } = await rival.client.from("messages").select("id").eq("rfq_id", rfqId);
  const { data: rivalLeak } = await rival.client.from("messages").insert({ rfq_id: rfqId, dispatch_id: d1.id, sender_profile_id: rival.id, sender_role: "producer", body: "Intrusion" }).select("id");
  report("Producteur rival : ne lit pas le fil et ne peut pas y ecrire", !rivalSees?.length && !rivalLeak?.length);
  await loginAs(rival);
  await go(`/fr/requests/${d2.id}`);
  report("Producteur rival : son propre fil est vide", await run(`return document.querySelector("#messages").innerText.includes("Aucun message") && !document.body.innerText.includes("4 bidons");`));

  // Console : la reponse du producteur est signalee dans son fil
  await loginAs(boss);
  await go(adminPage);
  report("Console : fil du producteur ouvert avec sa reponse non lue", await run(`const t = document.querySelector('[data-thread="${d1.id}"]'); return t.open && !!t.querySelector('[data-thread-unread="1"]') && t.innerText.includes("4 bidons");`));
  await shot("messages-admin");

  // Demande close : plus de nouveau message
  await admin.from("rfqs").update({ status: "closed" }).eq("id", rfqId);
  await loginAs(buyer);
  await go(buyerPage);
  report("Demande close : le fil est en lecture seule", await run(`return !document.querySelector('[data-message-form="buyer"]') && document.querySelector("#messages").innerText.includes("close");`));
  const { data: lateMsg } = await buyer.client.from("messages").insert({ rfq_id: rfqId, sender_profile_id: buyer.id, sender_role: "buyer", body: "Trop tard" }).select("id");
  report("Demande close : la base refuse le message", !lateMsg?.length);

  await go(`/ar/rfq/${rfqId}`);
  report("Arabe : fil traduit", await run(`return document.documentElement.dir === "rtl" && document.querySelector("#messages").innerText.includes("المراسلات مع AFRICA NEX");`));
  ws.close();
} catch (e) {
  failed++;
  console.error("ERREUR", e);
} finally {
  chrome.kill();
  if (rfqId) await admin.from("rfqs").delete().eq("id", rfqId);
  for (const u of users) await admin.from("companies").delete().eq("owner_profile_id", u);
  await admin.from("audit_log").delete().in("actor_profile_id", users);
  for (const u of users) await admin.auth.admin.deleteUser(u);
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
