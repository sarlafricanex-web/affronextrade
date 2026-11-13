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

const email = `test-step2-${Date.now()}@example.com`;
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

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9337", `--user-data-dir=${OUT}/profile-step2`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9337/json/list")).json()).find((t) => t.type === "page"); } catch {} }
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

  await go("/fr/onboarding?step=2");
  report("Etape 2 affichee", await run(`return !!document.getElementById("ob-desc-fr") && !!document.querySelector("input[name=logo]");`));

  await run(`${HELP} setT(document.getElementById("ob-desc-fr"), "Trop court"); submit(); for (let i = 0; i < 30 && !document.body.innerText.includes("80 caractères minimum."); i++) await sleep(300); return true;`);
  report("Description trop courte refusee par le serveur", await run(`return document.body.innerText.includes("Présentez votre entreprise en 80 caractères minimum.");`));

  await setFile(FAKE);
  await run(`${HELP} setT(document.getElementById("ob-desc-fr"), ${JSON.stringify(LONG)}); submit(); for (let i = 0; i < 30 && !document.body.innerText.includes("PNG, JPEG ou WebP."); i++) await sleep(300); return true;`);
  report("Faux logo (texte renomme en .png) refuse", await run(`return document.body.innerText.includes("Le logo doit être une image PNG, JPEG ou WebP.");`));
  const { data: filesAfterFake } = await admin.storage.from("producer-logos").list(company.id);
  report("Aucun fichier stocke apres le refus", (filesAfterFake ?? []).length === 0, `${filesAfterFake?.length}`);

  await go("/fr/onboarding?step=2");
  await setFile(REAL);
  await run(`${HELP} setT(document.getElementById("ob-desc-fr"), ${JSON.stringify(LONG)}); setT(document.getElementById("ob-desc-ar"), "معصرة زيت زيتون عائلية"); document.getElementById("ob-website").value = "www.huilerie-test.dz"; submit(); return true;`);
  for (let i = 0; i < 40; i++) { await sleep(500); if (await run(`return location.search === "?step=3";`)) break; }
  report("Etape 2 validee : passage a l'etape 3", await run(`return location.search === "?step=3";`));
  const { data: c1 } = await admin.from("companies").select("description_fr, description_ar, website, logo_url").eq("id", company.id).single();
  report("Présentation et site enregistres", c1.description_fr === LONG && c1.description_ar === "معصرة زيت زيتون عائلية" && c1.website === "https://www.huilerie-test.dz/", JSON.stringify({ website: c1.website }));
  report("Logo range dans le dossier de l'entreprise", (c1.logo_url ?? "").includes(`/producer-logos/${company.id}/logo-`), c1.logo_url);
  const r = await fetch(c1.logo_url);
  report("Logo lisible publiquement, en PNG", r.status === 200 && (r.headers.get("content-type") ?? "").includes("image/png"), `${r.status} ${r.headers.get("content-type")}`);

  await go("/fr/onboarding?step=2");
  await sleep(1500);
  await setFile(REAL);
  await run(`${HELP} submit(); return true;`);
  for (let i = 0; i < 40; i++) { await sleep(500); if (await run(`return location.search === "?step=3";`)) break; }
  const { data: c2 } = await admin.from("companies").select("logo_url").eq("id", company.id).single();
  const { data: files } = await admin.storage.from("producer-logos").list(company.id);
  report("Logo remplace : l'ancien fichier est supprime", c2.logo_url !== c1.logo_url && (files ?? []).length === 1, `${files?.length} fichier(s)`);

  // Un autre producteur ne peut pas deposer dans ce dossier
  const other = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error: anonUp } = await other.storage.from("producer-logos").upload(`${company.id}/intrus.png`, Buffer.from("x"), { contentType: "image/png" });
  report("Visiteur anonyme : depot dans le dossier refuse", Boolean(anonUp), anonUp?.message ?? "accepte !");
  writeFileSync(`${OUT}/onboarding-step2.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  const { data: files } = await admin.storage.from("producer-logos").list(company.id);
  if (files?.length) await admin.storage.from("producer-logos").remove(files.map((f) => `${company.id}/${f.name}`));
  await admin.from("companies").delete().eq("id", company.id);
  await admin.auth.admin.deleteUser(uid);
  console.log("Nettoyage : compte, entreprise et logos de test supprimes");
  await sleep(500);
  try { rmSync(`${OUT}/profile-step2`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
