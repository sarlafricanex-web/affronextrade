// Test de bout en bout de l'espace connecte, structure Europages (23 novembre 2026) : barre et menu
// propres a l'espace (plus de menu vitrine), bouton de couleur memorise, menu sur telephone, arabe,
// poste de pilotage admin (demande a qualifier dans la file, chiffres du mois, objectif).
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
const TAG = `ZZ${randomBytes(2).toString("hex")}`;

const users = [];
async function makeUser(role, name) {
  const email = `test-shell-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role: role === "admin" ? "buyer" : role, locale: "fr" } });
  if (error) throw error;
  users.push(data.user.id);
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const jar = new Map();
  const client = createServerClient(url, pub, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value: v }) => (v ? jar.set(n, v) : jar.delete(n))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, jar, client };
}

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9363", `--user-data-dir=${OUT}/profile-shell`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
let rfqId = null;
try {
  const boss = await makeUser("admin", "Nadia Pilotage");
  const buyer = await makeUser("buyer", "Moussa Acheteur");
  const { data: rfq, error: rfqError } = await admin.from("rfqs").insert({ buyer_profile_id: buyer.id, title: `Semoule fine ${TAG}`, currency: "EUR", incoterm: "CIF", logistics: "africanex", destination_country: "SN", status: "submitted", created_at: new Date(Date.now() - 4 * 864e5).toISOString() }).select("id, reference").single();
  if (rfqError) throw rfqError;
  rfqId = rfq.id;

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9363/json/list")).json()).find((t) => t.type === "page"); } catch {} }
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
  await send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  const ready = `return !!document.querySelector("[data-dashboard=admin]");`;

  // Barre de l'espace, sans le menu vitrine
  await loginAs(boss);
  await go("/fr/dashboard", ready);
  report("Espace connecte : barre et menu propres, sans menu ni pied de page vitrine", await run(`return !!document.querySelector(".app-top") && !!document.querySelector(".app-side") && !document.querySelector("footer:not(.app-legal) a[href='/fr/about']") && ![...document.querySelectorAll("header a")].some((a) => a.textContent.trim() === "Commencer");`));
  report("Liens legaux en bas de l'espace", await run(`return ["/fr/legal", "/fr/privacy", "/fr/terms", "/fr/sales"].every((h) => !!document.querySelector(\`.app-legal a[href="\${h}"]\`));`));
  report("Menu admin : groupes Activite, Annuaire, Administration", await run(`const t = document.querySelector(".app-side").textContent; return ["Activité", "Annuaire", "Administration", "Formulaire de contact", "Réglages"].every((x) => t.includes(x));`));

  // Poste de pilotage
  const row = `document.querySelector('[data-queue-kind="rfq"][href="/fr/admin/rfqs/${rfqId}"]')`;
  report("Pilotage : la demande a qualifier est dans la file, avec son anciennete en retard", await run(`const r = ${row}; return !!r && r.textContent.includes("Semoule fine ${TAG}") && r.textContent.includes("${rfq.reference}") && r.textContent.includes("Sénégal") && !!r.querySelector("[data-late]");`));
  report("Pilotage : bandeau avec le total et le bouton du plus ancien", await run(`return Number(document.querySelector("[data-queue-total]").dataset.queueTotal) >= 1 && !!document.querySelector(".dash-banner-btn");`));
  await run(`document.querySelector('[data-group="moderation"]').click(); return true;`);
  report("Pilotage : filtre Moderation, la demande n'y figure plus", await waitFor(`return !${row};`, 10));
  await run(`document.querySelector('[data-group="all"]').click(); return true;`);
  report("Pilotage : chiffres du mois et objectif des 80 producteurs", await run(`return ["rfqs", "offers", "acceptance", "listed"].every((k) => !!document.querySelector(\`[data-kpi="\${k}"]\`)) && document.body.textContent.includes("80 producteurs");`));
  report("Cloche : compteur des elements a traiter", await run(`return Number(document.querySelector("[data-app-bell]").dataset.appBell) >= 0;`));
  await shot("shell-admin-emerald");

  // Couleur du menu : emeraude par defaut, clair au clic, garde apres rechargement
  report("Menu emeraude par defaut", await run(`return document.querySelector(".app-shell").dataset.theme === "emerald";`));
  await run(`document.querySelector("[data-theme-toggle]").click(); return true;`);
  report("Bouton : passage au menu clair", await waitFor(`return document.querySelector(".app-shell").dataset.theme === "light";`, 10));
  await go("/fr/admin/settings", `return !!document.querySelector(".app-shell");`);
  report("Choix garde d'une page a l'autre (cookie)", await run(`return document.querySelector(".app-shell").dataset.theme === "light";`));
  await shot("shell-light");
  await run(`document.querySelector("[data-theme-toggle]").click(); return true;`);
  await waitFor(`return document.querySelector(".app-shell").dataset.theme === "emerald";`, 10);

  // Telephone : menu replie, ouvert par le bouton
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await go("/fr/dashboard", ready);
  report("Telephone : menu replie, page sans debordement", await run(`return getComputedStyle(document.querySelector(".app-side")).visibility === "hidden" && document.documentElement.scrollWidth <= innerWidth + 1;`), await run(`return document.documentElement.scrollWidth + " / " + innerWidth;`));
  await run(`document.querySelector(".app-burger").click(); return true;`);
  report("Telephone : le bouton ouvre le menu", await waitFor(`return document.querySelector(".app-side[data-open]") && getComputedStyle(document.querySelector(".app-side")).visibility === "visible";`, 10));
  await shot("shell-mobile-menu");
  await send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });

  // Arabe
  await go("/ar/dashboard", ready);
  report("Arabe : sens de droite a gauche, poste de pilotage traduit", await run(`return document.documentElement.dir === "rtl" && document.querySelector(".dash-card h2")?.textContent === "للمعالجة";`));
  await shot("shell-admin-ar");

  // Acheteur : meme barre, ses propres liens
  await loginAs(buyer);
  await go("/fr/dashboard", `return !!document.querySelector(".app-side");`);
  report("Acheteur : menu Achats et raccourci Nouvelle demande", await run(`return document.querySelector(".app-side").textContent.includes("Achats") && !!document.querySelector('.app-topnav a[href="/fr/rfq/new"]');`));
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  if (rfqId) await admin.from("rfqs").delete().eq("id", rfqId);
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  console.log("Nettoyage :", users.length, "compte(s) supprime(s)");
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
