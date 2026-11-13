// Test de bout en bout du catalogue producteur dans Chrome sans fenetre.
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
const PNG = `${OUT}/test-produit.png`;
writeFileSync(PNG, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let failed = 0;
const report = (label, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "OK    " : "ECHEC "} ${label}${detail ? ` (${detail})` : ""}`); };

const users = [];
async function makeUser(role) {
  const email = `test-catalog-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Test ${role}`, role, locale: "fr", phone: "+213551234567" } });
  if (error) throw error;
  users.push(data.user.id);
  const jar = new Map();
  const client = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, jar, client };
}
async function makeCompany(u, name) {
  const { error } = await u.client.from("companies").insert({ company_name: name, kind: "producer", slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${Date.now()}`, owner_profile_id: u.id, visibility: "draft", sector: "C10", wilaya: "19", city: "Setif", legal_form: "SARL" });
  if (error) throw error;
  return (await admin.from("companies").select("id").eq("owner_profile_id", u.id).single()).data.id;
}

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9340", `--user-data-dir=${OUT}/profile-catalog`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
const companies = [];
try {
  const producer = await makeUser("producer");
  const rival = await makeUser("producer");
  const buyer = await makeUser("buyer");
  const companyId = await makeCompany(producer, "Huilerie Test Setif");
  const rivalId = await makeCompany(rival, "Concurrent Test");
  companies.push(companyId, rivalId);
  const { data: rivalProduct, error: rpErr } = await rival.client.from("products").insert({ company_id: rivalId, product_name: "Produit concurrent", status: "draft", source: "producer" }).select("id").single();
  if (rpErr) throw rpErr;

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9340/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); if (u) for (const [name, value] of u.jar) await send("Network.setCookie", { name, value, url: BASE, path: "/" }); };
  const go = async (path) => { await send("Page.navigate", { url: BASE + path }); await sleep(1000); for (let i = 0; i < 60; i++) { const r = await send("Runtime.evaluate", { expression: "document.readyState === 'complete' && !!document.querySelector('h1')", returnByValue: true }); if (r.result?.value) break; await sleep(300); } await sleep(700); };
  const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  const waitFor = async (cond, tries = 80) => { for (let i = 0; i < tries; i++) { await sleep(500); try { if (await run(cond)) return true; } catch {} } return false; };
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("DOM.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1400, deviceScaleFactor: 1, mobile: false });
  const SET = `const setV = (el, v) => { const p = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
    const submit = () => document.querySelector("main form button[type=submit]:not([form])") && [...document.querySelectorAll("button[type=submit]")].at(-1).click();`;

  // Acces
  await loginAs(null); await go("/fr/catalog");
  report("Deconnecte : renvoye a la connexion", await run(`return location.pathname === "/fr/login";`));
  await loginAs(buyer); await go("/fr/catalog");
  report("Acheteur : renvoye a son tableau de bord", await run(`return location.pathname === "/fr/dashboard";`));

  // Catalogue vide
  await loginAs(producer); await go("/fr/catalog");
  console.log("   page :", await run(`return location.pathname + " | " + document.body.innerText.slice(0, 200).replace(/\\s+/g, " ");`));
  report("Catalogue vide affiche", await run(`return document.body.innerText.includes("Votre catalogue est vide") && document.body.innerText.includes("Aucun produit");`));
  report("Lien Catalogue dans le menu", await run(`return [...document.querySelectorAll("aside a")].some((a) => a.getAttribute("href") === "/fr/catalog");`));

  // Nouveau produit avec une erreur : la saisie doit etre conservee
  await go("/fr/catalog/new");
  report("Editeur nouveau produit", await run(`return document.querySelector("h1")?.textContent === "Nouveau produit";`));
  await run(`${SET}
    setV(document.getElementById("pe-name"), "Huile d'olive extra vierge");
    setV(document.getElementById("pe-hs"), "12");
    setV(document.getElementById("pe-desc-Fr"), "Huile de premiere pression a froid, recolte 2026.");
    setV(document.getElementById("pe-price"), "9,20");
    setV(document.getElementById("pe-unit"), "l");
    setV(document.getElementById("pe-moq"), "2000");
    setV(document.getElementById("pe-pack"), "Bidons de 5 l, 4 par carton");
    setV(document.getElementById("pe-upc"), "20");
    setV(document.getElementById("pe-cl"), "abc");
    setV(document.getElementById("pe-cw"), "26");
    setV(document.getElementById("pe-ch"), "32");
    setV(document.getElementById("pe-cwt"), "18,5");
    setV(document.getElementById("pe-stack"), "5");
    document.querySelector("button[name=status][value=draft]").click(); return true;`);
  const kept = await waitFor(`return document.body.innerText.includes("Nombre positif attendu.");`);
  report("Erreurs affichees (code SH, capacite 40 pieds)", kept);
  report("Saisie conservee apres l'erreur", await run(`return document.getElementById("pe-name").value === "Huile d'olive extra vierge" && document.getElementById("pe-pack").value.startsWith("Bidons") && document.getElementById("pe-unit").value === "l"`));
  await shot("catalog-errors");

  // Correction + photo + publication
  await run(`${SET} setV(document.getElementById("pe-hs"), "150920"); setV(document.getElementById("pe-cl"), "38"); return true;`);
  report("Estimation en direct : 13 500 L en 20 pieds, 27 900 L en 40 pieds", await waitFor(`return document.querySelector("[data-container='20']")?.innerText.includes("13" + String.fromCharCode(8239) + "500") || document.querySelector("[data-container='20']")?.innerText.replace(/\\s/g, "").includes("13500");`), await run(`return [...document.querySelectorAll("[data-container]")].map((e) => e.innerText.replace(/\\s+/g, " ")).join(" | ");`));
  const { root } = await send("DOM.getDocument");
  const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[type=file][name=photo]" });
  await send("DOM.setFileInputFiles", { nodeId, files: [PNG.replace(/\//g, "\\")] });
  await sleep(300);
  report("Apercu de la photo affiche", await run(`return [...document.querySelectorAll("img")].some((i) => i.src.startsWith("blob:"));`));
  report("Panneau Pret a publier : bouton Publier actif", await run(`return !document.querySelector("button[name=status][value=published]").disabled;`));
  await run(`document.querySelector("button[name=status][value=published]").click(); return true;`);
  report("Enregistre : retour au catalogue avec message", await waitFor(`return location.pathname === "/fr/catalog" && document.body.innerText.includes("Produit enregistré.");`));
  await sleep(1000);
  const { data: p1 } = await admin.from("products").select("*").eq("company_id", companyId).single();
  report("Produit en base : SH, prix, MOQ, logistique, publie", p1?.hs_code === "1509.20" && Number(p1.unit_price_ht) === 9.2 && Number(p1.min_order_quantity) === 2000 && p1.container_capacity_20ft === 13500 && p1.container_capacity_40ft === 27900 && Number(p1.units_per_carton) === 20 && p1.storage_condition === "ambient" && p1.packaging?.startsWith("Bidons") && p1.status === "published", JSON.stringify({ hs: p1?.hs_code, price: p1?.unit_price_ht, status: p1?.status, c20: p1?.container_capacity_20ft, c40: p1?.container_capacity_40ft }));
  report("Une photo enregistree dans le stockage", Array.isArray(p1?.images) && p1.images.length === 1 && p1.images[0].path.startsWith(`${companyId}/`));
  await sleep(800); const row = await run(`return document.querySelector("tbody tr")?.innerText ?? "";`);
  report("Ligne du tableau : nom, SH, prix, MOQ, statut", row.includes("Huile d'olive extra vierge") && row.includes("1509.20") && /9,20/.test(row) && row.includes("FOB") && /publié/i.test(row), row.replace(/\s+/g, " "));
  report("Resume : 1 produit, 1 publie", await run(`return document.body.innerText.includes("1 produit, 1 publié");`));
  await shot("catalog-list");

  // Modification : prix + retrait de la photo
  await go(`/fr/catalog/${p1.id}`);
  report("Editeur pre-rempli", await run(`return document.querySelector("h1")?.textContent === "Huile d'olive extra vierge" && document.getElementById("pe-price").value === "9.2" && document.getElementById("pe-cl").value === "38" && document.getElementById("pe-cwt").value === "18.5";`));
  await shot("catalog-edit");
  await run(`${SET} setV(document.getElementById("pe-price"), "8,75"); document.querySelector("input[name=removePhoto]").click(); [...document.querySelectorAll("button[type=submit]")].at(-1).click(); return true;`);
  report("Modification enregistree", await waitFor(`return location.search.includes("saved=1");`));
  await sleep(1000);
  const { data: p2 } = await admin.from("products").select("unit_price_ht, images").eq("id", p1.id).single();
  report("Prix modifie et photo retiree en base", Number(p2.unit_price_ht) === 8.75 && p2.images.length === 0, JSON.stringify(p2));
  const { data: files } = await admin.storage.from("product-images").list(companyId);
  report("Fichier photo supprime du stockage", (files ?? []).length === 0, `${(files ?? []).length} fichier(s)`);

  // Isolation
  await go(`/fr/catalog/${rivalProduct.id}`);
  report("Produit d'un concurrent : page introuvable", await run(`return !document.getElementById("pe-name") && !document.body.innerText.includes("Produit concurrent");`));
  await go(`/fr/catalog/pas-un-uuid`);
  report("Identifiant invalide : page introuvable", await run(`return !document.getElementById("pe-name");`));

  // Arabe
  await go("/ar/catalog");
  const arOk = await waitFor(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("الكتالوج");`); report("Version arabe en RTL", arOk, arOk ? "" : await run(`return location.pathname + " | dir=" + document.documentElement.dir + " | " + document.body.innerText.replace(/\\s+/g, " ").slice(0, 300);`));
  await shot("catalog-ar");

  // Suppression (confirmation acceptee)
  await go("/fr/catalog");
  await run(`window.confirm = () => true; [...document.querySelectorAll("tbody button[type=submit]")][0].click(); return true;`);
  report("Suppression : message affiche", await waitFor(`return location.search.includes("deleted=1") && document.body.innerText.includes("Produit supprimé.");`));
  const { count } = await admin.from("products").select("id", { count: "exact", head: true }).eq("company_id", companyId);
  report("Produit supprime en base", count === 0);
  const { count: rivalCount } = await admin.from("products").select("id", { count: "exact", head: true }).eq("company_id", rivalId);
  report("Produit du concurrent intact", rivalCount === 1);
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  for (const cid of companies) {
    const { data: f } = await admin.storage.from("product-images").list(cid);
    if (f?.length) await admin.storage.from("product-images").remove(f.map((x) => `${cid}/${x.name}`));
  }
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  console.log(`Nettoyage : ${users.length} comptes, leurs entreprises, produits et photos supprimes`);
  await sleep(500);
  try { rmSync(`${OUT}/profile-catalog`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);

