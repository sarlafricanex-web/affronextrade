// Test de bout en bout de l'etape 1 de la premiere configuration producteur, dans Chrome sans fenetre.
import { site, OUT, CHROME } from "./_guard.mjs";
// Cree puis supprime un producteur, un acheteur et l'entreprise de test. N'affiche aucune cle.
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";


const require = createRequire(`${site}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");



const BASE = `http://localhost:${process.argv[2] ?? 3000}`;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let failed = 0;
const report = (label, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "OK    " : "ECHEC "} ${label}${detail ? ` (${detail})` : ""}`);
};

const users = [];
async function makeUser(role) {
  const email = `test-onb-${role}-${Date.now()}@example.com`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Test ${role}`, role, locale: "fr" } });
  if (error) throw error;
  users.push(data.user.id);
  const jar = new Map();
  const client = createServerClient(url, pub, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, jar, client };
}

const NIF = String(Date.now()).padStart(20, "9").slice(-20);
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9336", `--user-data-dir=${OUT}/profile-onb`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
try {
  const producer = await makeUser("producer");
  const buyer = await makeUser("buyer");

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9336/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); for (const [name, value] of u.jar) await send("Network.setCookie", { name, value, url: BASE, path: "/" }); };
  const go = async (path) => { await send("Page.navigate", { url: BASE + path }); await sleep(1000); for (let i = 0; i < 60; i++) { const r = await send("Runtime.evaluate", { expression: "document.readyState === 'complete' && !!document.querySelector('h1')", returnByValue: true }); if (r.result?.value) break; await sleep(300); } await sleep(700); };
  const shoot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1400, deviceScaleFactor: 1, mobile: false });

  // Acheteur : pas d'acces
  await loginAs(buyer);
  await go("/fr/onboarding");
  report("Acheteur sur /onboarding : son propre ecran acheteur", await run(`return location.pathname === "/fr/onboarding" && !!document.getElementById("b-name");`));

  // Producteur : tableau de bord puis formulaire
  await loginAs(producer);
  await go("/fr/dashboard");
  report("Tableau de bord producteur : bouton Configurer mon entreprise", await run(`return [...document.querySelectorAll("a")].some((a) => /Configurer mon entreprise/.test(a.textContent) && a.getAttribute("href") === "/fr/onboarding");`));
  await go("/fr/onboarding");
  await shoot("onboarding-step1-vide");
  const HELP = `
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const set = (el, v) => { const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
    const $ = (s) => document.querySelector(s);
    const fill = async (nif) => {
      set($("#ob-name"), "Huilerie Test Kabylie");
      $("input[name=legalForm][value=SARL]").click();
      set($("#ob-activity"), "107301");
      set($("#ob-nif"), nif);
      set($("#ob-nis"), "001906012345678");
      set($("#ob-article"), "19016012345");
      set($("#ob-rc"), "06/00-1234567 B 24");
      set($("#ob-wilaya"), "06");
      await sleep(300);
      set($("#ob-city"), "Akbou");
      set($("#ob-address"), "Zone industrielle Taharacht");
      for (const [id, num] of [["ob-phone", "34351280"], ["ob-whatsapp", "551234567"]]) { const i = document.getElementById(id); i.focus(); set(i, num); await sleep(50); i.blur(); }
      await sleep(200);
    };`;
  // NIF faux : contourne la validation du navigateur pour tester celle du serveur
  await run(`${HELP} await fill("12345"); $("form").noValidate = true; [...document.querySelectorAll("button[type=submit]")].find((b) => b.value === "continue").click(); for (let i = 0; i < 30 && !document.getElementById("nif-error"); i++) await sleep(300); return true;`);
  const nifError = await run(`return document.getElementById("nif-error")?.textContent ?? null;`);
  report("NIF de 5 chiffres refuse par le serveur", /20 chiffres/.test(nifError ?? ""), nifError ?? "aucun message");
  const { data: none } = await admin.from("companies").select("id").eq("owner_profile_id", producer.id);
  report("Aucune entreprise creee apres le refus", none.length === 0, `${none.length}`);

  await run(`${HELP} await fill("${NIF}"); [...document.querySelectorAll("button[type=submit]")].find((b) => b.value === "continue").click(); return true;`);
  const t0 = Date.now(); for (let i = 0; i < 60; i++) { await sleep(500); if (await run(`return location.search === "?step=2";`)) break; } console.log(`   (redirection apres ${Date.now() - t0} ms, adresse : ${await run("return location.pathname + location.search;")})`);
  report("Etape 1 validee : passage a l'etape 2", await run(`return location.pathname === "/fr/onboarding" && location.search === "?step=2";`));
  await shoot("onboarding-step2");

  const { data: company } = await admin.from("companies").select("id, company_name, kind, legal_form, sector, wilaya, city, visibility, verified, claim_status, owner_profile_id, slug").eq("owner_profile_id", producer.id).maybeSingle();
  report("Entreprise creee : brouillon, sans badge, au bon proprietaire", company && company.kind === "producer" && company.visibility === "draft" && company.verified === false && company.legal_form === "SARL" && company.wilaya === "06", JSON.stringify(company));
  const { data: priv } = await admin.from("company_private").select("tax_id, rc_number, address, contact_phone, contact_whatsapp").eq("company_id", company?.id).maybeSingle();
  report("Partie privee : NIF, RC, adresse et numeros internationaux", priv?.tax_id === NIF && priv?.contact_phone === "+21334351280" && priv?.contact_whatsapp === "+213551234567", JSON.stringify(priv));
  const { data: prof } = await admin.from("profiles").select("phone, whatsapp").eq("id", producer.id).single();
  report("Profil sans telephone complete avec celui de l'entreprise", prof.phone === "+21334351280" && prof.whatsapp === "+213551234567", JSON.stringify(prof));

  // Securite : RLS
  const anon = createClient(url, pub, { auth: { persistSession: false } });
  const { data: anonPriv } = await anon.from("company_private").select("tax_id");
  report("Visiteur anonyme : aucune donnee privee", !anonPriv || anonPriv.length === 0, `${anonPriv?.length ?? 0} ligne(s)`);
  const { data: buyerPriv } = await buyer.client.from("company_private").select("tax_id");
  report("Acheteur : aucune donnee privee d'un producteur", !buyerPriv || buyerPriv.length === 0, `${buyerPriv?.length ?? 0} ligne(s)`);
  const { data: anonCompany } = await anon.from("companies").select("id").eq("id", company.id);
  report("Fiche en brouillon invisible du public", anonCompany.length === 0);
  const { error: second } = await producer.client.from("companies").insert({ company_name: "Deuxieme", kind: "producer", slug: `deux-${Date.now()}`, owner_profile_id: producer.id });
  report("Une seule entreprise par compte (2e creation refusee)", Boolean(second), second?.message ?? "acceptee !");
  const { error: badge } = await producer.client.from("companies").update({ verified: true }).eq("id", company.id);
  report("Le producteur ne peut pas s'attribuer le badge verifie", Boolean(badge), badge?.message ?? "accepte !");

  // Reprise : le formulaire se re-remplit
  await go("/fr/onboarding?step=1");
  report("Retour a l'etape 1 : champs pre-remplis", await run(`return document.getElementById("ob-name").value === "Huilerie Test Kabylie" && document.getElementById("ob-nif").value === "${NIF}";`));
  await go("/fr/dashboard");
  report("Tableau de bord : Continuer la configuration", await run(`return [...document.querySelectorAll("a")].some((a) => /Continuer la configuration/.test(a.textContent));`));
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  for (const uid of users) {
    await admin.from("companies").delete().eq("owner_profile_id", uid);
    await admin.auth.admin.deleteUser(uid);
  }
  console.log(`Nettoyage : ${users.length} comptes et leurs entreprises supprimes`);
  await sleep(500);
  try { rmSync(`${OUT}/profile-onb`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
