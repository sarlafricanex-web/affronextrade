// Test de bout en bout des reglages admin (lot 6b) : taux de reference et mode d'affaire des fournisseurs.
import { site, OUT, CHROME } from "./_guard.mjs";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";

const require = createRequire(`${site}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");

const BASE = `http://localhost:${process.argv[2] ?? 3000}`;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let failed = 0;
const report = (label, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "OK    " : "ECHEC "} ${label}${detail ? ` (${detail})` : ""}`); };
const TAG = `ZZ${randomBytes(2).toString("hex")}`;

const users = [];
async function makeUser(role, name) {
  const email = `test-settings-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role: role === "admin" ? "buyer" : role, locale: "fr" } });
  if (error) throw error;
  users.push(data.user.id);
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const jar = new Map();
  const client = createServerClient(url, pub, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value: v }) => (v ? jar.set(n, v) : jar.delete(n))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, jar, client };
}

// Taux existants (base de dev partagee) : remis en etat a la fin.
const { data: ratesBefore } = await admin.from("fx_rates").select("*");
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9355", `--user-data-dir=${OUT}/profile-settings`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
let supplierId = null;
try {
  const boss = await makeUser("admin", "Admin Reglages");
  const producer = await makeUser("producer", "Producteur Reglages");
  const supplierName = `Huilerie Reglages ${TAG}`;
  await producer.client.from("companies").insert({ company_name: supplierName, kind: "producer", slug: `test-settings-${TAG}`.toLowerCase(), owner_profile_id: producer.id, sector: "C10", wilaya: "19", city: "Setif" });
  const { data: co } = await admin.from("companies").select("id").eq("owner_profile_id", producer.id).single();
  supplierId = co.id;

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9355/json/list")).json()).find((t) => t.type === "page"); } catch {} }
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
  const SET = `const setV = (el, v) => { const p = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };`;

  // Acces et confidentialite
  await loginAs(producer);
  await go("/fr/admin/settings", `return location.pathname === "/fr/dashboard";`);
  report("Producteur : reglages refuses", await run(`return location.pathname === "/fr/dashboard";`));
  const { data: prodRates } = await producer.client.from("fx_rates").select("currency");
  const { data: prodModes } = await producer.client.from("supplier_settings").select("company_id");
  report("Producteur : ni taux ni modes lisibles (RLS)", prodRates?.length === 0 && prodModes?.length === 0);

  // Taux de reference
  await loginAs(boss);
  await go("/fr/admin/settings", `return !!document.getElementById("rate-EUR");`);
  report("Menu admin : lien Reglages", await run(`return [...document.querySelectorAll("aside a")].some((a) => a.getAttribute("href") === "/fr/admin/settings");`));
  await run(`${SET} setV(document.getElementById("rate-EUR"), "abc"); setV(document.getElementById("rate-USD"), "136,5"); [...document.querySelectorAll("button[type=submit]")].find((b) => /taux/i.test(b.textContent)).click(); return true;`);
  report("Taux invalide refuse", await waitFor(`return document.body.innerText.includes("Taux invalide");`));
  await run(`${SET} setV(document.getElementById("rate-EUR"), "150,25"); setV(document.getElementById("rate-USD"), "136,5"); [...document.querySelectorAll("button[type=submit]")].find((b) => /taux/i.test(b.textContent)).click(); return true;`);
  report("Taux enregistres : message", await waitFor(`return location.search.includes("saved=rates");`));
  const { data: rates } = await admin.from("fx_rates").select("currency, dzd_per_unit, updated_by");
  const r = Object.fromEntries((rates ?? []).map((x) => [x.currency, x]));
  report("En base : 1 EUR = 150,25 DZD, 1 USD = 136,5 DZD, auteur", Number(r.EUR?.dzd_per_unit) === 150.25 && Number(r.USD?.dzd_per_unit) === 136.5 && r.EUR.updated_by === boss.id, JSON.stringify(rates));
  report("Date de mise a jour affichee", await run(`return document.body.innerText.includes("Mis à jour le");`));

  // Mode d'affaire du fournisseur
  report("Fournisseur sans mode : 'A definir'", await run(`const li = document.querySelector('[data-supplier="${supplierName}"]'); return !!li && li.querySelector("select").value === "";`));
  report("Sans accord du fournisseur : export AFRICA NEX indisponible", await run(`const li = document.querySelector('[data-supplier="${supplierName}"]'); return li.querySelector("[data-consent]").dataset.consent === "no" && li.querySelector("option[value=africanex]").disabled;`));
  // Le fournisseur donne son accord (case de "Mon entreprise", ecrite ici avec ses propres droits).
  const { error: consentError } = await producer.client.from("companies").update({ africanex_export_consent: true }).eq("id", supplierId);
  report("Le fournisseur donne son accord lui-meme", !consentError, consentError?.message);
  await go("/fr/admin/settings", `return !!document.querySelector('[data-supplier="${supplierName}"] [data-consent="yes"]');`);
  report("Accord visible pour AFRICA NEX, option disponible", await run(`const li = document.querySelector('[data-supplier="${supplierName}"]'); return li.querySelector("[data-consent]").dataset.consent === "yes" && !li.querySelector("option[value=africanex]").disabled;`));
  await run(`${SET} setV(document.querySelector('[data-supplier="${supplierName}"] select'), "africanex"); [...document.querySelectorAll("button[type=submit]")].find((b) => /modes/i.test(b.textContent)).click(); return true;`);
  report("Mode enregistre : message", await waitFor(`return location.search.includes("saved=modes") && document.body.innerText.includes("1 fournisseur(s) modifié(s)");`));
  const { data: mode } = await admin.from("supplier_settings").select("export_mode, updated_by").eq("company_id", supplierId).maybeSingle();
  report("En base : AFRICA NEX exporte pour ce fournisseur", mode?.export_mode === "africanex" && mode.updated_by === boss.id, JSON.stringify(mode));
  await shot("admin-settings");
  await producer.client.from("companies").update({ africanex_export_consent: false }).eq("id", supplierId);
  const { data: back } = await admin.from("supplier_settings").select("export_mode").eq("company_id", supplierId).maybeSingle();
  report("Retrait de l'accord : le fournisseur repasse en intermediation", back?.export_mode === "self", JSON.stringify(back));
  await go("/fr/admin/settings", `return !!document.querySelector('[data-supplier="${supplierName}"]');`);
  await run(`${SET} setV(document.querySelector('[data-supplier="${supplierName}"] select'), ""); [...document.querySelectorAll("button[type=submit]")].find((b) => /modes/i.test(b.textContent)).click(); return true;`);
  await waitFor(`return location.search.includes("saved=modes");`);
  const { data: unset } = await admin.from("supplier_settings").select("company_id").eq("company_id", supplierId);
  report("Remis a 'A definir' : reglage supprime", unset?.length === 0);

  await go("/ar/admin/settings", `return !!document.getElementById("rate-EUR");`);
  report("Reglages en arabe (RTL)", await run(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("الإعدادات");`));
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  // Remise en etat des taux de la base de dev.
  await admin.from("fx_rates").delete().in("currency", ["EUR", "USD"]);
  if (ratesBefore?.length) await admin.from("fx_rates").insert(ratesBefore);
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  console.log("Nettoyage :", users.length, "comptes supprimes, taux remis en etat");
  await sleep(300);
  try { rmSync(`${OUT}/profile-settings`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
