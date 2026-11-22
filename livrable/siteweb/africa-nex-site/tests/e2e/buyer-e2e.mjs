// Test de bout en bout de l'inscription acheteur dans Chrome sans fenetre.
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
async function makeUser(role) {
  const email = `test-buyer-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Amadou ${role}`, role, locale: "fr", phone: "+221771234567" } });
  if (error) throw error;
  users.push(data.user.id);
  const jar = new Map();
  const client = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, jar, client };
}

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9341", `--user-data-dir=${OUT}/profile-buyer`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
try {
  const buyer = await makeUser("buyer");
  const producer = await makeUser("producer");

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9341/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); if (u) for (const [name, value] of u.jar) await send("Network.setCookie", { name, value, url: BASE, path: "/" }); };
  const waitFor = async (cond, tries = 80) => { for (let i = 0; i < tries; i++) { await sleep(500); try { if (await run(cond)) return true; } catch {} } return false; };
  const go = async (path, ready) => { await send("Page.navigate", { url: BASE + path }); await sleep(1500); if (ready) await waitFor(ready, 60); else await sleep(2000); };
  const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });
  const SET = `const setV = (el, v) => { const p = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };`;
  // Bouton du formulaire principal (l'encart "Supprimer mon compte" a aussi un bouton d'envoi).
  const submit = `[...document.querySelectorAll("main button[type=submit]")].filter((b) => !b.closest("#account-deletion")).at(-1).click();`;

  // Tableau de bord : invitation a completer le profil
  await loginAs(buyer);
  await go("/fr/dashboard", `return !!document.querySelector("h1");`);
  report("Tableau de bord : bouton Completer mon profil", await run(`return [...document.querySelectorAll("main a")].some((a) => a.getAttribute("href") === "/fr/onboarding" && /profil/i.test(a.textContent));`));
  report("Menu acheteur : lien Mon entreprise", await run(`return [...document.querySelectorAll("aside a")].some((a) => a.getAttribute("href") === "/fr/company");`));
  await go("/fr/company", `return location.pathname === "/fr/onboarding";`);
  report("Mon entreprise sans profil : renvoye a la configuration", await run(`return location.pathname === "/fr/onboarding";`));

  // Formulaire : telephone de l'inscription pre-rempli
  await go("/fr/onboarding", `return !!document.getElementById("b-name");`);
  report("Ecran acheteur affiche", await run(`return document.querySelector("h1")?.textContent === "Votre entreprise";`));
  report("Téléphone de l'inscription pre-rempli (Senegal)", await run(`return document.querySelector("input[name=phone]").value === "+221771234567";`));

  // Envoi incomplet : pays et secteurs manquants
  await run(`${SET}
    setV(document.getElementById("b-name"), "Dakar Import SARL");
    document.querySelector("input[name=buyerType][value=importer]").click();
    setV(document.getElementById("b-city"), "Dakar");
    setV(document.getElementById("b-whatsapp"), "+221 77 765 43 21");
    ${submit} return true;`);
  report("Erreurs : pays et secteurs", await waitFor(`return document.body.innerText.includes("Cochez de 1 à 12 activités.");`));
  report("Saisie conservee apres l'erreur", await run(`return document.getElementById("b-name").value === "Dakar Import SARL" && document.getElementById("b-city").value === "Dakar" && document.querySelector("input[name=buyerType][value=importer]").checked && document.querySelector("input[name=whatsapp]").value === "+221777654321";`));
  await shot("buyer-errors");

  // Choix du pays dans la liste, secteurs, site
  await run(`document.getElementById("b-country").click(); return true;`);
  await sleep(400);
  await run(`const o = [...document.querySelectorAll("[role=option]")].find((x) => x.textContent.includes("Sénégal")); o.click(); return true;`);
  await sleep(300);
  report("Pays choisi : Senegal", await run(`return document.querySelector("input[name=country]").value === "SN";`));
  await run(`${SET}
    document.querySelector("input[name=interests][value=C10]").click();
    document.querySelector("input[name=interests][value=C20]").click();
    setV(document.getElementById("b-website"), "dakar-import.sn");
    ${submit} return true;`);
  report("Terminé : tableau de bord avec message", await waitFor(`return location.pathname === "/fr/dashboard" && document.body.innerText.includes("votre profil est complet");`));
  report("Bouton Completer mon profil disparu", await run(`return ![...document.querySelectorAll("main a")].some((a) => a.getAttribute("href") === "/fr/onboarding");`));

  const { data: company } = await admin.from("companies").select("id, kind, company_name, buyer_type, country, city, interests, website, visibility, verified").eq("owner_profile_id", buyer.id).single();
  report("Entreprise acheteuse en base", company?.kind === "buyer" && company.buyer_type === "importer" && company.country === "SN" && company.city === "Dakar" && company.interests.join() === "C10,C20" && company.website === "https://dakar-import.sn/" && company.visibility === "draft" && !company.verified, JSON.stringify(company));
  const { data: priv } = await admin.from("company_private").select("contact_phone, contact_whatsapp").eq("company_id", company.id).single();
  report("Coordonnees dans la partie privee", priv?.contact_phone === "+221771234567" && priv.contact_whatsapp === "+221777654321", JSON.stringify(priv));
  const { data: prof } = await admin.from("profiles").select("onboarding_completed, whatsapp").eq("id", buyer.id).single();
  report("Profil marque complet", prof?.onboarding_completed === true && prof.whatsapp === "+221777654321");

  // Confidentialite : un producteur et un visiteur ne voient pas l'acheteur
  const { data: seenByProducer } = await producer.client.from("companies").select("id").eq("id", company.id);
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data: seenByAnon } = await anon.from("companies").select("id").eq("id", company.id);
  const { data: privByProducer } = await producer.client.from("company_private").select("company_id").eq("company_id", company.id);
  report("Producteur et visiteur ne voient pas l'entreprise acheteuse", seenByProducer?.length === 0 && seenByAnon?.length === 0 && privByProducer?.length === 0);

  // Modification depuis Mon entreprise
  await go("/fr/company", `return !!document.getElementById("b-name");`);
  report("Mon entreprise : nom, pays et formulaire pre-rempli", await run(`return document.querySelector("h1")?.textContent === "Dakar Import SARL" && document.body.innerText.includes("Sénégal · Dakar") && document.querySelector("input[name=interests][value=C20]").checked;`));
  await shot("buyer-company");
  await run(`${SET} setV(document.getElementById("b-city"), "Thies"); document.querySelector("input[name=buyerType][value=distributor]").click(); ${submit} return true;`);
  report("Modification : reste sur Mon entreprise avec message", await waitFor(`return location.pathname === "/fr/company" && location.search.includes("saved=1") && document.body.innerText.includes("Modifications enregistrées.");`));
  const { data: c2 } = await admin.from("companies").select("city, buyer_type").eq("id", company.id).single();
  report("Ville et type mis a jour", c2.city === "Thies" && c2.buyer_type === "distributor", JSON.stringify(c2));

  // Garde : un producteur ne peut pas utiliser l'action acheteur ; l'ecran producteur reste en 3 etapes
  await loginAs(producer);
  await go("/fr/onboarding", `return !!document.querySelector("ol");`);
  report("Producteur : configuration en 3 etapes inchangee", await run(`return !document.getElementById("b-name") && !!document.getElementById("ob-name");`));

  // Arabe
  await loginAs(buyer);
  await go("/ar/company", `return !!document.getElementById("b-name");`);
  report("Version arabe en RTL", await run(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("نوع المشتري");`));
  await shot("buyer-ar");
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  console.log(`Nettoyage : ${users.length} comptes et leurs entreprises supprimes`);
  await sleep(500);
  try { rmSync(`${OUT}/profile-buyer`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
