// Test de bout en bout des avis acheteurs : depot, anonymat, regles de la base, moderation.
import { site, OUT, CHROME } from "./_guard.mjs";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";


const require = createRequire(`${site}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");



const BASE = `http://localhost:${process.argv[2] ?? 3000}`;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let failed = 0;
const report = (label, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "OK    " : "ECHEC "} ${label}${detail ? ` (${detail})` : ""}`); };
const users = [];
async function makeUser(role, name) {
  const email = `test-rev-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role: role === "admin" ? "buyer" : role, locale: "fr" } });
  if (error) throw error;
  users.push(data.user.id);
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const jar = new Map();
  const client = createServerClient(url, pub, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value: v }) => (v ? jar.set(n, v) : jar.delete(n))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, jar, client };
}

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9345", `--user-data-dir=${OUT}/profile-reviews`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
let testCompany;
try {
  const amadou = await makeUser("buyer", "Amadou Diallo");
  const newbie = await makeUser("buyer", "Sans Profil");
  const producer = await makeUser("producer", "Producteur Test");
  const boss = await makeUser("admin", "Admin Test");
  // Profil acheteur complet pour Amadou (entreprise au Senegal)
  await amadou.client.from("companies").insert({ company_name: "Dakar Negoce SARL", kind: "buyer", slug: `dakar-negoce-${Date.now()}`, owner_profile_id: amadou.id, visibility: "draft", country: "SN", buyer_type: "importer" });
  await amadou.client.from("profiles").update({ onboarding_completed: true }).eq("id", amadou.id);
  // Fiche producteur publiee (par l'admin) appartenant au producteur de test
  await producer.client.from("companies").insert({ company_name: "Producteur Avis Test", kind: "producer", slug: `prod-avis-${Date.now()}`, owner_profile_id: producer.id, visibility: "draft", sector: "C10" });
  ({ data: testCompany } = await admin.from("companies").select("id, slug").eq("owner_profile_id", producer.id).single());
  await admin.from("companies").update({ visibility: "published" }).eq("id", testCompany.id);
  const { data: cevital } = await admin.from("companies").select("id").eq("slug", "cevital").single();

  // Regles de la base
  const anon = createClient(url, pub, { auth: { persistSession: false } });
  const a = await anon.from("reviews").insert({ producer_company_id: cevital.id, author_name: "Anonyme", rating: 5 });
  report("Base : avis anonyme refuse", Boolean(a.error), a.error?.code);
  const p = await producer.client.from("reviews").insert({ producer_company_id: cevital.id, author_profile_id: producer.id, author_name: "x", rating: 5 });
  report("Base : avis d'un producteur refuse", Boolean(p.error), p.error?.code);
  const n = await newbie.client.from("reviews").insert({ producer_company_id: cevital.id, author_profile_id: newbie.id, author_name: "x", rating: 5 });
  report("Base : acheteur sans profil complet refuse", /buyer_profile_incomplete/.test(n.error?.message ?? ""), n.error?.message);
  const forged = await amadou.client.from("reviews").insert({ producer_company_id: testCompany.id, author_profile_id: amadou.id, author_name: "Grand Groupe Officiel", author_company: "Dakar Negoce SARL", author_country: "FR", rating: 3, comment: "Avis depose directement par l'API pour verifier l'anonymat." });
  const { data: fr } = await admin.from("reviews").select("author_name, author_company, author_country, status").eq("producer_company_id", testCompany.id).eq("author_profile_id", amadou.id).single();
  report("Base : identite remplie par la base (pas de falsification)", !forged.error && fr.author_name === "Amadou D." && fr.author_company === null && fr.author_country === "SN" && fr.status === "pending", JSON.stringify(fr));
  const { data: seenByProducer } = await producer.client.from("reviews").select("id").eq("producer_company_id", testCompany.id);
  report("Base : le producteur ne voit pas l'avis en attente", seenByProducer.length === 0);
  const dup = await amadou.client.from("reviews").insert({ producer_company_id: testCompany.id, author_profile_id: amadou.id, author_name: "x", rating: 2 });
  report("Base : un seul avis par acheteur et par fiche", dup.error?.code === "23505", dup.error?.code);
  const self = await amadou.client.from("reviews").update({ status: "approved" }).eq("producer_company_id", testCompany.id).select("id");
  report("Base : l'acheteur ne peut pas publier son avis", (self.data ?? []).length === 0);

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9345/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const waitFor = async (cond, tries = 80) => { for (let i = 0; i < tries; i++) { await sleep(300); try { if (await run(cond)) return true; } catch {} } return false; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); if (u) for (const [k, v] of u.jar) await send("Network.setCookie", { name: k, value: v, url: BASE, path: "/" }); };
  const go = async (path, ready) => { await send("Page.navigate", { url: BASE + path }); await sleep(800); await waitFor(ready ?? "return document.readyState === 'complete';"); };
  const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  const avis = `(document.getElementById("avis")?.innerText ?? "")`;
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1400, deviceScaleFactor: 1, mobile: false });

  // Bloc avis selon le visiteur
  await loginAs(null);
  await go("/fr/producers/cevital", `return ${avis}.includes("Connectez-vous");`);
  report("Visiteur : invitation a se connecter", await run(`return ${avis}.includes("Connectez-vous à votre compte acheteur") && [...document.querySelectorAll("#avis a")].some((a) => a.getAttribute("href").startsWith("/fr/login?next=%2Ffr%2Fproducers%2Fcevital") || a.getAttribute("href").startsWith("/fr/login?next=/fr/producers/cevital"));`));
  await loginAs(producer);
  await go("/fr/producers/cevital", `return ${avis}.includes("Seuls les acheteurs");`);
  report("Producteur : avis reserves aux acheteurs", await run(`return ${avis}.includes("Seuls les acheteurs") && !document.querySelector("#avis textarea");`));
  await loginAs(newbie);
  await go("/fr/producers/cevital", `return ${avis}.includes("profil");`);
  report("Acheteur sans profil : invitation a le completer", await run(`return ${avis}.includes("complétez d'abord votre profil");`));

  // Depot dans le navigateur
  await loginAs(amadou);
  await go("/fr/producers/cevital", `return !!document.querySelector("#avis textarea");`);
  report("Acheteur complet : formulaire avec etoiles", await run(`return document.querySelectorAll("#avis input[name=rating]").length === 5;`));
  await run(`document.querySelector("#avis textarea").removeAttribute("minlength"); document.querySelector("#avis input[name=rating][value='4']").click(); const ta = document.querySelector("#avis textarea"); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(ta, "Trop court"); document.querySelector("#avis button[type=submit]").click(); return true;`);
  report("Commentaire trop court refuse par le serveur, note conservee", await waitFor(`return ${avis}.includes("entre 20 et 1 000") && document.querySelector("#avis input[name=rating][value='4']").checked;`));
  await shot("review-form");
  await run(`const ta = document.querySelector("#avis textarea"); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(ta, "Huile de table livree a Dakar dans les delais, conditionnement soigne, documents export complets."); document.querySelector("#avis button[type=submit]").click(); return true;`);
  report("Avis envoye : en attente de validation", await waitFor(`return ${avis}.includes("en attente de validation");`));
  const { data: rv } = await admin.from("reviews").select("id, rating, status, author_name, author_country").eq("producer_company_id", cevital.id).eq("author_profile_id", amadou.id).single();
  report("En base : 4 etoiles, en attente, Amadou D., SN", rv?.rating === 4 && rv.status === "pending" && rv.author_name === "Amadou D." && rv.author_country === "SN");
  await loginAs(null);
  await go("/fr/producers/cevital", `return !!document.getElementById("avis");`);
  report("Avis en attente invisible du public", await run(`return !${avis}.includes("Huile de table livree a Dakar");`));

  // Moderation
  await loginAs(boss);
  await go("/fr/admin/reviews", `return !!document.querySelector("h1");`);
  report("Console : lien Avis et avis en attente", await run(`return [...document.querySelectorAll("aside a")].some((a) => a.getAttribute("href") === "/fr/admin/reviews") && document.body.innerText.includes("Amadou D.") && document.body.innerText.includes("2 avis en attente");`));
  await shot("admin-reviews");
  await run(`[...document.querySelectorAll("article")].find((a) => a.innerText.includes("Huile de table livree")).querySelector("button[value=approved]").click(); return true;`);
  report("Publie : message", await waitFor(`return location.search.includes("done=approved");`));
  await run(`[...document.querySelectorAll("article")].find((a) => a.innerText.includes("verifier l'anonymat")).querySelector("button[value=rejected]").click(); return true;`);
  report("Refuse : message", await waitFor(`return location.search.includes("done=rejected");`));
  const { data: after } = await admin.from("reviews").select("status, moderated_by").in("author_profile_id", [amadou.id]);
  report("Statuts et moderateur en base", after.length === 2 && after.every((r) => r.moderated_by === boss.id) && after.some((r) => r.status === "approved") && after.some((r) => r.status === "rejected"));

  await loginAs(null);
  await go("/fr/producers/cevital", `return ${avis}.toLowerCase().includes("amadou d.");`);
  report("Avis publie : visible, prenom + initiale et pays, sans entreprise", await run(`const t = ${avis}.toLowerCase(); return t.includes("amadou d.") && t.includes("sénégal") && !t.includes("dakar negoce") && t.includes("huile de table livree");`));
  report("Note de la fiche mise a jour", await run(`return document.body.innerText.includes("4,0 / 5");`));
  await go("/fr/producers", `return document.querySelectorAll("main ul > li").length > 0;`);
  report("Annuaire : note de Cevital mise a jour", await run(`return [...document.querySelectorAll("main ul > li")].find((li) => li.innerText.includes("Cevital"))?.innerText.includes("4,0");`));
  await shot("review-public");
  await loginAs(amadou);
  await go("/ar/producers/cevital", `return !!document.getElementById("avis");`);
  const arOk = await waitFor(`return document.documentElement.dir === "rtl" && ${avis}.includes("تم نشر رأيك");`); report("Arabe : statut de son avis", arOk, arOk ? "" : await run(`return ${avis}.replace(/\\s+/g, " ").slice(-300);`));
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  await admin.from("reviews").delete().in("author_profile_id", users);
  await admin.from("audit_log").delete().in("actor_profile_id", users);
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  const { count } = await admin.from("reviews").select("id", { count: "exact", head: true });
  console.log(`Nettoyage : ${users.length} comptes supprimes, ${count} avis restants en base`);
  await sleep(500);
  try { rmSync(`${OUT}/profile-reviews`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
