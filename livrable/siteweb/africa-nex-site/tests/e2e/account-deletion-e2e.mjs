// Test de bout en bout de la suppression de compte (audit legal, correction 3) : le producteur la
// demande depuis "Mon entreprise", peut l'annuler, AFRICA NEX la traite ; compte, entreprise,
// produits et fichiers sont effaces ; email journalise pour AFRICA NEX.
import { site, OUT, CHROME } from "./_guard.mjs";
import { waitEmails } from "./_emails.mjs";
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
const TAG = `ZZ${randomBytes(2).toString("hex")}`;

const users = [];
async function makeUser(role, name) {
  const email = `test-deletion-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role: role === "admin" ? "buyer" : role, locale: "fr" } });
  if (error) throw error;
  users.push(data.user.id);
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const jar = new Map();
  const client = createServerClient(url, pub, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value: v }) => (v ? jar.set(n, v) : jar.delete(n))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, email, jar, client };
}

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9361", `--user-data-dir=${OUT}/profile-deletion`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
let companyId = null;
try {
  const boss = await makeUser("admin", "Admin Suppression");
  const producer = await makeUser("producer", "Producteur Suppression");
  const { error: coErr } = await producer.client.from("companies").insert({ company_name: `Huilerie Suppression ${TAG}`, kind: "producer", slug: `test-deletion-${TAG}`.toLowerCase(), owner_profile_id: producer.id, sector: "C10", wilaya: "19", city: "Setif", legal_form: "SARL" });
  if (coErr) throw coErr;
  companyId = (await admin.from("companies").select("id").eq("owner_profile_id", producer.id).single()).data.id;
  await producer.client.from("products").insert({ company_id: companyId, product_name: `Huile ${TAG}`, unit: "carton", status: "draft" });
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const { error: upErr } = await producer.client.storage.from("producer-logos").upload(`${companyId}/logo-${TAG}.png`, PNG, { contentType: "image/png" });
  report("Fichier de l'entreprise depose (logo)", !upErr, upErr?.message);

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9361/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); if (u) for (const [name, value] of u.jar) await send("Network.setCookie", { name, value, url: BASE, path: "/" }); };
  const waitFor = async (cond, tries = 60) => { for (let i = 0; i < tries; i++) { await sleep(400); try { if (await run(cond)) return true; } catch {} } return false; };
  const go = async (path, ready) => { await send("Page.navigate", { url: BASE + path }); await sleep(800); await waitFor(ready); };
  const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });
  const box = `return !!document.querySelector("[data-account-deletion]");`;

  // Demande par le producteur
  await loginAs(producer);
  await go("/fr/company", box);
  report("Mon entreprise : encart 'Supprimer mon compte'", await run(`return document.querySelector("[data-account-deletion]").dataset.accountDeletion === "none" && document.querySelector("#account-deletion").textContent.includes("Supprimer mon compte");`));
  await run(`const d = document.querySelector("#account-deletion details"); d.open = true; document.getElementById("deletion-reason").value = "Fin d'activité"; document.querySelector("#account-deletion input[name=confirm]").click(); document.querySelector("#account-deletion form button[type=submit]").click(); return true;`);
  report("Demande enregistree : message et date", await waitFor(`return location.search.includes("deletion=requested") && document.querySelector("[data-account-deletion]")?.dataset.accountDeletion === "pending" && document.body.innerText.includes("traite sous un mois");`));
  await shot("account-deletion-pending");
  const adminMails = await waitEmails(admin, { kind: "admin_deletion_request", subject: "Demande de suppression de compte" });
  report("Email a AFRICA NEX journalise", adminMails.length >= 1, String(adminMails.length));

  // Annulation puis nouvelle demande
  await run(`document.querySelector("#account-deletion form button[type=submit]").click(); return true;`);
  report("Annulation : retour a l'etat initial", await waitFor(`return location.search.includes("deletion=cancelled") && document.querySelector("[data-account-deletion]")?.dataset.accountDeletion === "none";`));
  await run(`const d = document.querySelector("#account-deletion details"); d.open = true; document.querySelector("#account-deletion input[name=confirm]").click(); document.querySelector("#account-deletion form button[type=submit]").click(); return true;`);
  await waitFor(`return location.search.includes("deletion=requested");`);
  const { data: reqs } = await admin.from("account_deletion_requests").select("id, status, reason").eq("profile_id", producer.id).order("created_at");
  report("En base : une demande annulee (avec raison), une en attente", reqs?.length === 2 && reqs[0].status === "cancelled" && reqs[0].reason === "Fin d'activité" && reqs[1].status === "pending", JSON.stringify(reqs));

  // Traitement par AFRICA NEX
  await loginAs(boss);
  await go("/fr/admin/accounts", `return !!document.getElementById("deletion-requests");`);
  const row = `document.querySelector('[data-deletion="${producer.email}"]')`;
  report("Admin : demande listee avec l'email du compte", await run(`return !!${row};`));
  await shot("account-deletion-admin");
  await run(`${row}.querySelector("input[name=confirm]").click(); ${row}.querySelector("button[type=submit]").click(); return true;`);
  report("Admin : compte supprime (message)", await waitFor(`return location.search.includes("deletion=done") && document.body.innerText.includes("Compte supprimé.");`));
  const { data: authUser } = await admin.auth.admin.getUserById(producer.id);
  const { data: co } = await admin.from("companies").select("id").eq("id", companyId);
  const { data: prods } = await admin.from("products").select("id").eq("company_id", companyId);
  const { data: files } = await admin.storage.from("producer-logos").list(companyId);
  const { data: done } = await admin.from("account_deletion_requests").select("status, processed_by, profile_id").eq("id", reqs[1].id).single();
  report("Compte, entreprise, produits et fichiers effaces", !authUser?.user && co?.length === 0 && prods?.length === 0 && (files ?? []).length === 0, JSON.stringify({ user: !!authUser?.user, co: co?.length, prods: prods?.length, files: files?.length }));
  report("Demande marquee traitee, par l'admin", done?.status === "done" && done.processed_by === boss.id && done.profile_id === null, JSON.stringify(done));
  if (!authUser?.user) users.splice(users.indexOf(producer.id), 1);
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  if (companyId) { await admin.storage.from("producer-logos").remove([`${companyId}/logo-${TAG}.png`]); await admin.from("companies").delete().eq("id", companyId); }
  await admin.from("account_deletion_requests").delete().like("email", "test-deletion-%");
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  console.log("Nettoyage :", users.length, "compte(s) supprime(s)");
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
