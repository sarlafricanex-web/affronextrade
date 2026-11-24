// Test de bout en bout de la console admin des producteurs.
import { site, OUT, CHROME } from "./_guard.mjs";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";


const require = createRequire(`${site}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");



const BASE = `http://localhost:${process.argv[2] ?? 3000}`;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let failed = 0;
const report = (label, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "OK    " : "ECHEC "} ${label}${detail ? ` (${detail})` : ""}`); };
const users = [];
const TAG = `ZZ${Date.now() % 100000}`;
async function makeUser(role) {
  const email = `test-adm-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Test ${role}`, role: role === "admin" ? "buyer" : role, locale: "fr" } });
  if (error) throw error;
  users.push(data.user.id);
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const jar = new Map();
  const client = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value: v }) => (v ? jar.set(n, v) : jar.delete(n))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, jar, client };
}

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9344", `--user-data-dir=${OUT}/profile-admprod`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
try {
  const boss = await makeUser("admin");
  const producer = await makeUser("producer");

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9344/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const waitFor = async (cond, tries = 80) => { for (let i = 0; i < tries; i++) { await sleep(300); try { if (await run(cond)) return true; } catch {} } return false; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); if (u) for (const [n, v] of u.jar) await send("Network.setCookie", { name: n, value: v, url: BASE, path: "/" }); };
  const go = async (path, ready) => { await send("Page.navigate", { url: BASE + path }); await sleep(800); await waitFor(ready ?? "return document.readyState === 'complete';"); };
  const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  const SET = `const setV = (el, v) => { const p = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };`;
  const clickOp = (company, op) => `[...document.querySelectorAll("tbody tr")].find((tr) => tr.innerText.includes(${JSON.stringify(company)})).querySelector("input[name=op][value=${op}]").form.querySelector("button").click(); return true;`;
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1400, deviceScaleFactor: 1, mobile: false });

  // Acces
  await loginAs(producer);
  await go("/fr/admin/producers", `return location.pathname === "/fr/dashboard";`);
  report("Producteur : console refusee", await run(`return location.pathname === "/fr/dashboard";`));
  const { error: selfPub } = await producer.client.from("companies").insert({ company_name: "Pirate", kind: "producer", slug: `pirate-${Date.now()}`, claim_status: "unclaimed", created_by_admin: true, visibility: "published" });
  report("Producteur : creation d'une fiche 'AFRICA NEX' refusee par la base", Boolean(selfPub), selfPub?.code);

  // Creation de 3 producteurs, chronometree
  await loginAs(boss);
  await go("/fr/admin/producers", `return !!document.querySelector("h1");`);
  console.log("   page :", await run(`return location.pathname + " | " + document.body.innerText.replace(/\\s+/g, " ").slice(0, 400);`));
  report("Console : liste et bouton Ajouter", await run(`return document.querySelector("h1").textContent === "Producteurs" && document.querySelectorAll("tbody tr").length >= 16;`));
  const specs = [
    { name: `Dattes ${TAG} Biskra`, sector: "C10", wilaya: "07", city: "Tolga", products: "Deglet Nour\nDattes Ghars\nPate de dattes", desc: "Conditionneur de dattes Deglet Nour a Tolga, export vers l'Afrique de l'Ouest." },
    { name: `Ceramique ${TAG} Nabeul`, sector: "C32", wilaya: "16", city: "Alger Centre", products: "Plats en ceramique", desc: "" },
    { name: `Pieces ${TAG} Setif`, sector: "C29", wilaya: "19", city: "El Eulma", products: "Filtres a huile\nPlaquettes", desc: "" },
  ];
  const t0 = Date.now();
  for (const s of specs) {
    await go("/fr/admin/producers/new", `return !!document.getElementById("ap-name");`);
    await run(`${SET}
      setV(document.getElementById("ap-name"), ${JSON.stringify(s.name)});
      setV(document.getElementById("ap-sector"), ${JSON.stringify(s.sector)});
      setV(document.getElementById("ap-wilaya"), ${JSON.stringify(s.wilaya)});
      await new Promise((r) => setTimeout(r, 300));
      setV(document.getElementById("ap-city"), ${JSON.stringify(s.city)});
      setV(document.getElementById("ap-products"), ${JSON.stringify(s.products)});
      setV(document.getElementById("ap-desc-Fr"), ${JSON.stringify(s.desc)});
      document.getElementById("ap-name").form.querySelector("button[type=submit]").click(); return true;`);
    await waitFor(`return location.search.includes("saved=create");`);
  }
  const seconds = Math.round((Date.now() - t0) / 1000);
  report("3 fiches creees (machine)", await run(`return document.body.innerText.includes("Fiche créée.");`), `${seconds} s hors saisie humaine`);
  const { data: created } = await admin.from("companies").select("id, slug, company_name, visibility, claim_status, created_by_admin, verified, brand_initials, owner_profile_id, products(product_name, status, source)").ilike("company_name", `%${TAG}%`);
  const dattes = created.find((c) => c.company_name.startsWith("Dattes"));
  report("En base : 3 fiches non revendiquees, en ligne, creees par AFRICA NEX", created.length === 3 && created.every((c) => c.visibility === "published" && c.claim_status === "unclaimed" && c.created_by_admin && !c.verified && !c.owner_profile_id));
  report("Produits crees et publies (source admin)", dattes.products.length === 3 && dattes.products.every((p) => p.status === "published" && p.source === "admin"), dattes.products.map((p) => p.product_name).join(", "));
  report("Initiales et adresse generees", dattes.brand_initials === "DZ" || /^[A-Z]{2}$/.test(dattes.brand_initials), `${dattes.brand_initials} / ${dattes.slug}`);

  // Visible dans l'annuaire public
  await loginAs(null);
  await go(`/fr/producers/${dattes.slug}`, `return !!document.getElementById("devis");`);
  report("Fiche publique : nom, produits, bandeau de revendication", await run(`return document.querySelector("h1")?.textContent.startsWith("Dattes") && document.body.innerText.includes("Deglet Nour") && document.body.innerText.includes("Revendiquez-la");`));

  // Actions
  await loginAs(boss);
  await go("/fr/admin/producers", `return document.body.innerText.includes(${JSON.stringify(dattes.company_name)});`);
  report("Badge verifie desactive sur une fiche non revendiquee", await run(`return [...document.querySelectorAll("tbody tr")].find((tr) => tr.innerText.includes(${JSON.stringify(dattes.company_name)})).querySelector("input[name=op][value=verify]").form.querySelector("button").disabled;`));
  await shot("admin-producers");
  await run(clickOp(dattes.company_name, "unpublish"));
  await waitFor(`return location.search.includes("done=unpublish");`);
  const { data: v1 } = await admin.from("companies").select("visibility").eq("id", dattes.id).single();
  report("Retirer : fiche en brouillon", v1.visibility === "draft");
  await run(clickOp(dattes.company_name, "suspend"));
  await waitFor(`return location.search.includes("done=suspend");`);
  const { data: v2 } = await admin.from("companies").select("visibility").eq("id", dattes.id).single();
  report("Suspendre : fiche suspendue", v2.visibility === "suspended");
  await loginAs(null);
  await go(`/fr/producers/${dattes.slug}`);
  report("Fiche suspendue introuvable publiquement", await run(`return !document.getElementById("devis");`));
  await loginAs(boss);
  await go("/fr/admin/producers", `return document.body.innerText.includes(${JSON.stringify(dattes.company_name)});`);
  await run(clickOp(dattes.company_name, "publish"));
  await waitFor(`return location.search.includes("done=publish");`);
  const { data: v3 } = await admin.from("companies").select("visibility").eq("id", dattes.id).single();
  report("Remettre en ligne", v3.visibility === "published");

  // Badge sur une fiche revendiquee : on simule la revendication
  const pieces = created.find((c) => c.company_name.startsWith("Pieces"));
  await admin.from("companies").update({ claim_status: "claimed" }).eq("id", pieces.id);
  await go("/fr/admin/producers", `return document.body.innerText.includes(${JSON.stringify(pieces.company_name)});`);
  await run(clickOp(pieces.company_name, "verify"));
  await waitFor(`return location.search.includes("done=verify");`);
  const { data: v4 } = await admin.from("companies").select("verified").eq("id", pieces.id).single();
  report("Badge verifie attribue a une fiche revendiquee", v4.verified === true);

  // Modification : ville, NIF interne, ajout et retrait de produit
  await go(`/fr/admin/producers/${dattes.id}`, `return !!document.getElementById("ap-name");`);
  report("Edition pre-remplie", await run(`return document.getElementById("ap-city").value === "Tolga" && document.body.innerText.includes("3 produits");`));
  await run(`${SET} setV(document.getElementById("ap-city"), "Biskra"); setV(document.getElementById("ap-nif"), "12345"); setV(document.getElementById("ap-products"), "Sirop de dattes"); document.getElementById("ap-name").form.querySelector("button[type=submit]").click(); return true;`);
  report("NIF invalide refuse, saisie conservee", await waitFor(`return document.body.innerText.includes("20 chiffres") && document.getElementById("ap-city").value === "Biskra";`));
  await run(`${SET} setV(document.getElementById("ap-nif"), "${String(Date.now()).padStart(20, "4").slice(-20)}"); document.getElementById("ap-name").form.querySelector("button[type=submit]").click(); return true;`);
  report("Modification enregistree", await waitFor(`return location.search.includes("saved=update");`));
  const { data: d2 } = await admin.from("companies").select("city, products(product_name)").eq("id", dattes.id).single();
  const { data: p2 } = await admin.from("company_private").select("tax_id").eq("company_id", dattes.id).single();
  report("Ville, NIF prive et produit ajoute", d2.city === "Biskra" && p2.tax_id?.length === 20 && d2.products.length === 4, `${d2.city} / ${d2.products.length} produits`);
  await go(`/fr/admin/producers/${dattes.id}`, `return !!document.getElementById("ap-name");`);
  await run(`[...document.querySelectorAll("aside li")].find((li) => li.innerText.includes("Pate de dattes")).querySelector("button").click(); return true;`);
  await waitFor(`return location.search.includes("done=removeProduct");`);
  const { count: pc } = await admin.from("products").select("id", { count: "exact", head: true }).eq("company_id", dattes.id);
  report("Produit retire", pc === 3);
  const { count: audits } = await admin.from("audit_log").select("id", { count: "exact", head: true }).eq("actor_profile_id", boss.id);
  report("Actions tracees dans le journal", audits >= 9, `${audits} entrees`);

  // Essai gratuit de l'Agent Export ouvert depuis la fiche (migration 38).
  await go(`/fr/admin/producers/${dattes.id}`, `return !!document.querySelector("[data-admin-plan]");`);
  report("Fiche : offre Passeport et bouton d'essai", await run(`return document.querySelector("[data-admin-plan]").dataset.adminPlan === "vitrine" && !!document.querySelector('input[name=op][value=startTrial]');`));
  await run(`document.querySelector('input[name=op][value=startTrial]').form.querySelector("button").click(); return true;`);
  const trialOk = await waitFor(`return location.search.includes("done=startTrial") || location.search.includes("error=");`);
  const { data: trial } = await admin.from("subscriptions").select("plan_code, status, is_trial, price_charged_dzd").eq("company_id", dattes.id);
  report("Essai ouvert : Agent Export actif, gratuit, marque essai", trialOk && trial?.length === 1 && trial[0].plan_code === "agent_export" && trial[0].status === "active" && trial[0].is_trial && trial[0].price_charged_dzd === 0, await run("return location.search;") + " " + JSON.stringify(trial));
  report("Fiche : offre Agent Export, plus de bouton d'essai", await run(`return document.querySelector("[data-admin-plan]")?.dataset.adminPlan === "agent_export" && !document.querySelector('input[name=op][value=startTrial]');`));
  await go("/ar/admin/producers", `return !!document.querySelector("h1");`);
  report("Console en arabe (RTL)", await run(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("المنتجون");`));
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  const { data: mine } = await admin.from("companies").select("id").ilike("company_name", `%${TAG}%`);
  for (const c of mine ?? []) await admin.from("companies").delete().eq("id", c.id);
  await admin.from("audit_log").delete().in("actor_profile_id", users);
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  console.log(`Nettoyage : ${mine?.length ?? 0} fiches de test et ${users.length} comptes supprimes`);
  await sleep(500);
  try { rmSync(`${OUT}/profile-admprod`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
