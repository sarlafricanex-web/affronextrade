// Test de bout en bout de l'annuaire public et de la fiche producteur.
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

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9342", `--user-data-dir=${OUT}/profile-directory`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
try {
  // Verrou : un producteur ne peut pas se publier lui-meme
  const email = `test-dir-${Date.now()}@example.com`; const password = randomBytes(12).toString("base64url");
  const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Test", role: "producer", locale: "fr" } });
  users.push(u.user.id);
  const jar = new Map();
  const client = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) } });
  await client.auth.signInWithPassword({ email, password });
  const base = { company_name: "Auto Publie Test", kind: "producer", owner_profile_id: u.user.id, sector: "C10" };
  const { error: pubInsert } = await client.from("companies").insert({ ...base, slug: `auto-publie-${Date.now()}`, visibility: "published" });
  report("Producteur : creation directement publiee refusee", Boolean(pubInsert), pubInsert?.code);
  const { error: draftInsert } = await client.from("companies").insert({ ...base, slug: `auto-brouillon-${Date.now()}`, visibility: "draft" });
  report("Producteur : creation en brouillon acceptee", !draftInsert, draftInsert?.message);
  const { data: mine } = await admin.from("companies").select("id").eq("owner_profile_id", u.user.id).single();
  const { error: pubUpdate } = await client.from("companies").update({ visibility: "published" }).eq("id", mine.id);
  const { data: after1 } = await admin.from("companies").select("visibility").eq("id", mine.id).single();
  report("Producteur : passage en publie refuse", Boolean(pubUpdate) && after1.visibility === "draft", pubUpdate?.message);
  const { error: nameUpdate } = await client.from("companies").update({ city: "Setif" }).eq("id", mine.id);
  report("Producteur : modification normale toujours possible", !nameUpdate, nameUpdate?.message);

  const { count: published } = await admin.from("companies").select("id", { count: "exact", head: true }).eq("kind", "producer").eq("visibility", "published");
  const { data: cevital } = await admin.from("companies").select("id").eq("slug", "cevital").single();
  const { count: viewsBefore } = await admin.from("profile_views").select("id", { count: "exact", head: true }).eq("company_id", cevital.id);

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9342/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const waitFor = async (cond, tries = 60) => { for (let i = 0; i < tries; i++) { await sleep(400); try { if (await run(cond)) return true; } catch {} } return false; };
  const go = async (path, ready) => { await send("Page.navigate", { url: BASE + path }); await sleep(1200); await waitFor(ready ?? "return document.readyState === 'complete';"); };
  const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Network.setUserAgentOverride", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36" });
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1400, deviceScaleFactor: 1, mobile: false });

  // Annuaire
  await go("/fr/producers", `return document.querySelectorAll("main ul > li").length > 0;`);
  const cards = await run(`return Number(document.querySelector("[aria-live=polite] span")?.textContent);`);
  report("Annuaire : autant de fiches que d'entreprises publiees en base", cards === published, `${cards} / ${published}`);
  report("Le brouillon du test n'apparait pas", !(await run(`return document.body.innerText.includes("Auto Publie Test");`)));
  report("Fiches non revendiquees signalees", await run(`return document.body.innerText.includes("Fiche établie par AFRICA NEX") && document.querySelectorAll("main ul > li").length === 12;`));
  await run(`const i = document.querySelector("input[type=search]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "BEJAIA"); i.dispatchEvent(new Event("input", { bubbles: true })); return true;`);
  await sleep(300);
  const bejaia = await run(`return [...document.querySelectorAll("main ul > li h2 a")].map((a) => a.textContent);`);
  report("Recherche « BEJAIA » : Ifri, Cevital, Toudja", bejaia.length === 3 && ["Ifri", "Cevital", "Toudja Olive Oil"].every((n) => bejaia.includes(n)), bejaia.join(", "));
  await run(`const i = document.querySelector("input[type=search]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, ""); i.dispatchEvent(new Event("input", { bubbles: true })); [...document.querySelectorAll("button[aria-pressed]")].find((b) => b.textContent.trim().toLowerCase() === "industrie").click(); return true;`);
  await sleep(300);
  const tabs = await run(`return [...document.querySelectorAll("button[aria-pressed]")].map((b) => b.textContent.trim());`);
  report("Onglets par section CITI (Tous, Industrie...)", tabs[0] === "Tous" && tabs.includes("Industrie"), tabs.join(" | "));
  await run(`const s = [...document.querySelectorAll("select")].find((x) => [...x.options].some((o) => o.value === "C29")); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, "C29"); s.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
  await sleep(300);
  const auto = await run(`return { n: document.querySelectorAll("main ul > li").length, label: document.querySelector("main ul > li span")?.textContent ?? "" };`);
  report("Activite « Industrie automobile » (C29) : 3 fiches", auto.n === 3 && /Industrie automobile/.test(auto.label), JSON.stringify(auto));
  await shot("directory");

  // Fiche
  await run(`location.href = [...document.querySelectorAll("a")].find((a) => a.getAttribute("href") === "/fr/producers/motrio-algerie").href; return true;`);
  await waitFor(`return location.pathname === "/fr/producers/motrio-algerie" && !!document.querySelector("h1");`);
  report("Clic sur une carte : fiche ouverte", await run(`return document.querySelector("h1")?.textContent === "MOTRIO Algerie";`));
  await go("/fr/producers/cevital", `return document.querySelector("h1")?.textContent === "Cevital";`);
  const page = await run(`return document.body.innerText;`);
  report("Fiche Cevital : bandeau de revendication", page.includes("Vous êtes cette entreprise ?") && page.includes("Revendiquez-la"));
  report("Fiche Cevital : produits du catalogue", page.includes("Huile de table") && page.includes("Sucre"));
  report("Bloc Demander un devis present", await run(`return !!document.getElementById("devis") && /demander un devis/i.test(document.getElementById("devis").innerText);`));
  report("Aucun prix affiche sur la fiche", !/\d\s?(\$|€|DZD|USD|EUR)|(\$|€)\s?\d/.test(page));
  report("Titre de l'onglet", await run(`return document.title.startsWith("Cevital");`));
  await shot("profile-cevital");
  await sleep(2500);
  const { count: viewsAfter } = await admin.from("profile_views").select("id", { count: "exact", head: true }).eq("company_id", cevital.id);
  report("Consultation enregistree", viewsAfter === viewsBefore + 1, `${viewsBefore} -> ${viewsAfter}`);

  // Un robot n'est pas compte
  await send("Network.setUserAgentOverride", { userAgent: "Googlebot/2.1 (+http://www.google.com/bot.html)" });
  await go("/fr/producers/cevital", `return document.querySelector("h1")?.textContent === "Cevital";`);
  await sleep(2500);
  const { count: viewsBot } = await admin.from("profile_views").select("id", { count: "exact", head: true }).eq("company_id", cevital.id);
  report("Robot non compte", viewsBot === viewsAfter, `${viewsAfter} -> ${viewsBot}`);
  await send("Network.setUserAgentOverride", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36" });

  // Introuvables : brouillon et slug inconnu
  const { data: draft } = await admin.from("companies").select("slug").eq("id", mine.id).single();
  await go(`/fr/producers/${draft.slug}`);
  report("Fiche en brouillon : introuvable", await run(`return document.querySelector("h1")?.textContent !== "Auto Publie Test";`));
  await go("/fr/producers/n-existe-pas");
  report("Slug inconnu : introuvable", await run(`return !document.getElementById("devis");`));

  // Arabe
  await go("/ar/producers/cevital", `return !!document.getElementById("devis");`);
  report("Fiche en arabe (RTL)", await run(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("طلب عرض سعر");`));
  await shot("profile-ar");
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  console.log(`Nettoyage : ${users.length} compte(s) supprime(s)`);
  await sleep(500);
  try { rmSync(`${OUT}/profile-directory`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
