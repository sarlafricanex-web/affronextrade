// Test de bout en bout de l'etape 2 (presentation et logo) dans Chrome sans fenetre.
import { site, OUT, CHROME } from "./_guard.mjs";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";


const require = createRequire(`${site}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");

const SCRATCH = OUT;


const BASE = `http://localhost:${process.argv[2] ?? 3000}`;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const REAL = `${SCRATCH}/logo-test.png`;
const FAKE = `${SCRATCH}/faux-logo.png`;
writeFileSync(REAL, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
writeFileSync(FAKE, "ceci n'est pas une image <script>alert(1)</script>");

let failed = 0;
const report = (label, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "OK    " : "ECHEC "} ${label}${detail ? ` (${detail})` : ""}`); };

const email = `test-step3-${Date.now()}@example.com`;
const password = randomBytes(12).toString("base64url");
const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Test Etape2", role: "producer", locale: "fr", phone: "+213551234567" } });
if (error) throw error;
const uid = created.user.id;
const jar = new Map();
const client = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) } });
await client.auth.signInWithPassword({ email, password });
const { error: insErr } = await client.from("companies").insert({ company_name: "Test Etape Deux", kind: "producer", slug: `test-etape-deux-${Date.now()}`, owner_profile_id: uid, visibility: "draft", sector: "C10" });
if (insErr) throw insErr;
const { data: company } = await admin.from("companies").select("id").eq("owner_profile_id", uid).single();

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9338", `--user-data-dir=${OUT}/profile-step3`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9338/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("DOM.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1600, deviceScaleFactor: 1, mobile: false });
  for (const [name, value] of jar) await send("Network.setCookie", { name, value, url: BASE, path: "/" });
  const go = async (path) => { await send("Page.navigate", { url: BASE + path }); await sleep(1000); for (let i = 0; i < 60; i++) { const r = await send("Runtime.evaluate", { expression: "document.readyState === 'complete' && !!document.querySelector('h1')", returnByValue: true }); if (r.result?.value) break; await sleep(300); } await sleep(700); };
  const setFile = async (path) => {
    let nodeId = 0;
    for (let i = 0; i < 20 && !nodeId; i++) {
      const { root } = await send("DOM.getDocument", { depth: -1 });
      ({ nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[name=logo]" }));
      if (!nodeId) await sleep(300);
    }
    try { await send("DOM.setFileInputFiles", { nodeId, files: [path] }); }
    catch { await sleep(500); const { root } = await send("DOM.getDocument", { depth: -1 }); const q = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[name=logo]" }); await send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [path] }); }
    await sleep(300);
  };
  const HELP = `const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setT = (el, v) => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };
    const submit = () => { document.querySelector("form").noValidate = true; [...document.querySelectorAll("button[type=submit]")].find((b) => b.value === "continue").click(); };`;
  const LONG = "Huilerie familiale fondee en Kabylie, nous produisons une huile d'olive extra vierge pressee a froid, exportee vers l'Afrique de l'Ouest.";

  await admin.from("companies").update({ description_fr: "Présentation de test suffisamment longue pour passer la validation de l etape deux du parcours." }).eq("id", company.id);
  await go("/fr/onboarding?step=3");
  report("Etape 3 affichee", await run(`return !!document.getElementById("ob-hs") && !!document.querySelector("input[name=photo]");`));
  const SET = `const setI = (el, v) => { const p = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
    const fin = () => { document.querySelector("form").noValidate = true; [...document.querySelectorAll("button[type=submit]")].find((b) => b.value === "finish").click(); };`;
  await run(`${HELP} ${SET} setI(document.getElementById("ob-product"), "Huile d olive extra vierge, bidon 5 L"); setI(document.getElementById("ob-hs"), "12"); setI(document.getElementById("ob-price"), "0"); setI(document.getElementById("ob-unit"), "l"); setI(document.getElementById("ob-moq"), "2000"); fin(); for (let i = 0; i < 30 && !document.body.innerText.includes("6, 8 ou 10 chiffres."); i++) await sleep(300); return true;`);
  report("Code SH et prix invalides refuses par le serveur", await run(`return document.body.innerText.includes("Le code SH compte 6, 8 ou 10 chiffres.") && document.body.innerText.includes("Indiquez un prix supérieur à zéro");`));
  const { data: none } = await admin.from("products").select("id").eq("company_id", company.id);
  report("Aucun produit cree apres le refus", none.length === 0, `${none.length}`);
  await go("/fr/onboarding?step=3");
  await sleep(1500);
  const { root } = await send("DOM.getDocument", { depth: -1 });
  const q = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[name=photo]" });
  await send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [REAL] });
  await sleep(300);
  await run(`${HELP} ${SET} setI(document.getElementById("ob-product"), "Huile d olive extra vierge, bidon 5 L"); setI(document.getElementById("ob-hs"), "1509 20 00"); setI(document.getElementById("ob-price"), "9,20"); setI(document.getElementById("ob-basis"), "FOB"); setI(document.getElementById("ob-unit"), "l"); setI(document.getElementById("ob-moq"), "2 000"); fin(); return true;`);
  for (let i = 0; i < 40; i++) { await sleep(500); if (await run(`return location.pathname === "/fr/dashboard";`)) break; }
  await sleep(1500);
  report("Configuration terminee : tableau de bord avec message", await run(`return location.pathname === "/fr/dashboard" && document.body.innerText.includes("votre entreprise est configurée");`));
  report("Tableau de bord : lien Mon entreprise (plus de Continuer)", await run(`return [...document.querySelectorAll("main a, section a")].some((a) => a.textContent.trim() === "Mon entreprise") && !document.body.innerText.includes("Continuer la configuration");`));
  const { data: prod } = await admin.from("products").select("product_name, hs_code, unit_price_ht, currency, price_basis, unit, min_order_quantity, status, source, images").eq("company_id", company.id).single();
  report("Produit enregistre en brouillon, valeurs normalisees", prod.hs_code === "1509.20.00" && Number(prod.unit_price_ht) === 9.2 && prod.currency === "USD" && prod.price_basis === "FOB" && prod.unit === "l" && Number(prod.min_order_quantity) === 2000 && prod.status === "draft" && prod.source === "producer", JSON.stringify({ ...prod, images: undefined }));
  const img = prod.images?.[0]?.url ?? "";
  report("Photo rangee dans le dossier de l entreprise", img.includes(`/product-images/${company.id}/produit-`), img);
  const ri = await fetch(img);
  report("Photo lisible publiquement", ri.status === 200, `${ri.status}`);
  const { data: prof } = await admin.from("profiles").select("onboarding_completed").eq("id", uid).single();
  report("Compte marque configure", prof.onboarding_completed === true);
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data: anonProd } = await anon.from("products").select("id").eq("company_id", company.id);
  report("Produit en brouillon invisible du public", (anonProd ?? []).length === 0, `${anonProd?.length}`);
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  for (const b of ["producer-logos", "product-images"]) { const { data: files } = await admin.storage.from(b).list(company.id); if (files?.length) await admin.storage.from(b).remove(files.map((f) => `${company.id}/${f.name}`)); }
  await admin.from("companies").delete().eq("id", company.id);
  await admin.auth.admin.deleteUser(uid);
  console.log("Nettoyage : compte, entreprise et logos de test supprimes");
  await sleep(500);
  try { rmSync(`${OUT}/profile-step3`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
