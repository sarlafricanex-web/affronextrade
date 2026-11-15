// Test de bout en bout de la page "Mon entreprise" dans Chrome sans fenetre.
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
  const email = `test-company-${role}-${Date.now()}@example.com`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Test ${role}`, role, locale: "fr", phone: "+213551234567" } });
  if (error) throw error;
  users.push(data.user.id);
  const jar = new Map();
  const client = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, jar, client };
}

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9339", `--user-data-dir=${OUT}/profile-company`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
try {
  const producer = await makeUser("producer");
  const newbie = await makeUser("producer");
  const buyer = await makeUser("buyer");
  const { error: insErr } = await producer.client.from("companies").insert({ company_name: "Conserverie Test Setif", kind: "producer", slug: `conserverie-test-${Date.now()}`, owner_profile_id: producer.id, visibility: "draft", sector: "C10", wilaya: "19", city: "El Eulma", legal_form: "SARL" });
  if (insErr) throw insErr;
  const { data: company } = await admin.from("companies").select("id").eq("owner_profile_id", producer.id).single();
  await admin.from("companies").update({ description_fr: "Conserverie familiale de tomates et de piments, fondee a El Eulma, qui exporte deja vers le Senegal et la Mauritanie." }).eq("id", company.id);
  await admin.from("company_private").update({ tax_id: String(Date.now()).padStart(20, "7").slice(-20), nis: "001919012345678", tax_article: "19016054321", rc_number: "19/00-7654321 B 20", address: "Zone d'activite El Eulma", contact_phone: "+21336123456", contact_whatsapp: "+213551234567" }).eq("company_id", company.id);

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9339/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); if (u) for (const [name, value] of u.jar) await send("Network.setCookie", { name, value, url: BASE, path: "/" }); };
  const go = async (path) => { await send("Page.navigate", { url: BASE + path }); await sleep(1000); for (let i = 0; i < 60; i++) { const r = await send("Runtime.evaluate", { expression: "document.readyState === 'complete' && !!document.querySelector('h1')", returnByValue: true }); if (r.result?.value) break; await sleep(300); } await sleep(700); };
  const waitFor = async (cond, tries = 40) => { for (let i = 0; i < tries; i++) { await sleep(400); try { if (await run(cond)) return true; } catch {} } return false; };
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1500, deviceScaleFactor: 1, mobile: false });
  const SET = `const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setV = (el, v) => { const p = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
    const save = () => [...document.querySelectorAll("button[type=submit]")].find((b) => b.value === "save").click();`;

  await loginAs(null);
  await go("/fr/company");
  report("Deconnecte : renvoye a la connexion", await run(`return location.pathname === "/fr/login";`));
  await loginAs(buyer);
  await go("/fr/company");
  report("Acheteur sans profil : renvoye a sa configuration", await run(`return location.pathname === "/fr/onboarding";`));
  await loginAs(newbie);
  await go("/fr/company");
  report("Producteur sans entreprise : renvoye a la configuration", await run(`return location.pathname === "/fr/onboarding";`));

  await loginAs(producer);
  await go("/fr/company");
  await sleep(2000); const head = await run(`return { title: document.querySelector("h1")?.textContent, text: document.body.innerText };`);
  report("En-tete : nom, ville et wilaya, brouillon, non verifiee", head.title === "Conserverie Test Setif · fiche producteur" && /El Eulma, Sétif/.test(head.text) && /brouillon/i.test(head.text) && /non vérifiée/i.test(head.text) && /fiche non publiée/i.test(head.text), head.title);
  const extra = await run(`const t = document.body.innerText; return { stats: /Vues \\(30 jours\\)/i.test(t) && /Produits en ligne/i.test(t), tabs: [...document.querySelectorAll("nav[aria-label] a")].map((a) => a.textContent).filter((x) => /^\\d\\./.test(x)).length, labels: /Aucun document vérifié/i.test(t), contact: /sarlafricanex@gmail\\.com/.test(t), invented: /ALGEX|ZLECAf|REG-|98 ?%/i.test(t), overflow: document.documentElement.scrollWidth > innerWidth };`);
  report("Bandeau chiffres, 3 onglets numerotes, labels vides, contact reel", extra.stats && extra.tabs === 3 && extra.labels && extra.contact, JSON.stringify(extra));
  report("Aucun contenu invente par Stitch, pas de debordement", !extra.invented && !extra.overflow);
  report("Completion honnete : 2 elements sur 8 (identite, presentation FR)", head.text.includes("25 %"), (head.text.match(/\d+ %/) ?? [""])[0]);
  report("Lien Mon entreprise actif dans le menu", await run(`return [...document.querySelectorAll("aside a, nav a")].some((a) => a.getAttribute("href") === "/fr/company");`));
  writeFileSync(`${OUT}/company-presentation.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));

  await run(`${SET} setV(document.getElementById("ob-desc-en"), "Family-run cannery of tomatoes and peppers exporting to West Africa."); save(); return true;`);
  for (let i = 0; i < 40; i++) { await sleep(500); if (await run(`return location.search.includes("saved=1");`)) break; }
  await sleep(1000);
  report("Présentation modifiee : reste sur la page, message affiche", await run(`return location.pathname === "/fr/company" && location.search.includes("tab=presentation") && document.body.innerText.includes("Modifications enregistrées.");`));
  const { data: c1 } = await admin.from("companies").select("description_en").eq("id", company.id).single();
  report("Présentation anglaise enregistree en base", c1.description_en?.startsWith("Family-run cannery"));
  report("Completion mise a jour : 38 %", await run(`return document.body.innerText.includes("38 %");`));

  await go("/fr/company?tab=identity"); for (let i = 0; i < 30 && !(await run(`return !!document.getElementById("ob-city");`)); i++) await sleep(300);
  report("Onglet identite pre-rempli", await run(`return document.getElementById("ob-city").value === "El Eulma" && document.getElementById("ob-rc").value === "19/00-7654321 B 20";`));
  // Code d'activite : conserverie de fruits et legumes (107601) -> secteur impose C10.
  await run(`${SET} setV(document.getElementById("ob-activity"), "107601"); return true;`);
  await waitFor(`return !!document.querySelector("[data-activity-card='ok']");`, 20);
  await run(`${SET} setV(document.getElementById("ob-city"), "Setif"); save(); return true;`);
  for (let i = 0; i < 40; i++) { await sleep(500); if (await run(`return location.search.includes("saved=1");`)) break; }
  await sleep(1000);
  report("Identite modifiee : reste sur l'onglet identite", await run(`return location.search.includes("tab=identity") && document.body.innerText.includes("Modifications enregistrées.");`));
  const { data: act } = await admin.from("companies").select("activity_code, activity_description, sector").eq("id", company.id).single();
  report("Code d'activite enregistre, secteur impose C10, description proposee", act.activity_code === "107601" && act.sector === "C10" && (act.activity_description ?? "").length > 5, JSON.stringify(act));
  const { error: forced } = await producer.client.from("companies").update({ sector: "C29" }).eq("id", company.id);
  const { data: still } = await admin.from("companies").select("sector").eq("id", company.id).single();
  report("Base : le secteur reste celui du code (C29 force ignore)", still.sector === "C10", forced?.message ?? still.sector);
  const { error: refused } = await producer.client.from("companies").update({ activity_code: "604616" }).eq("id", company.id);
  report("Base : code bloque refuse", Boolean(refused), refused?.code);
  const { data: c2 } = await admin.from("companies").select("city, verified, visibility").eq("id", company.id).single();
  report("Ville mise a jour, sans toucher au badge ni a la visibilite", c2.city === "Setif" && c2.verified === false && c2.visibility === "draft", JSON.stringify(c2));
  writeFileSync(`${OUT}/company-identity.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));

  // Commune : la liste suit la wilaya
  await go("/fr/company?tab=identity"); for (let i = 0; i < 30 && !(await run(`return !!document.getElementById("ob-city");`)); i++) await sleep(300);
  const follow = await run(`${SET}
    const c = document.getElementById("ob-city"), names = () => [...c.options].map((o) => o.value);
    const before = { n: c.options.length - 1, eulma: names().includes("El Eulma"), value: c.value };
    setV(document.getElementById("ob-wilaya"), "06"); await sleep(400);
    return { before, after: { n: c.options.length - 1, akbou: names().includes("Akbou"), eulma: names().includes("El Eulma"), value: c.value } };`);
  report("Setif : 60 communes ; Bejaia : 52, commune remise a zero", follow.before.n === 60 && follow.before.eulma && follow.after.n === 52 && follow.after.akbou && !follow.after.eulma && follow.after.value === "", JSON.stringify(follow));

  // 69 wilayas, nouvelles wilayas avec leurs communes, 33 secteurs CITI groupes par section
  await go("/fr/company?tab=identity"); for (let i = 0; i < 30 && !(await run(`return !!document.getElementById("ob-city");`)); i++) await sleep(300);
  const ref = await run(`${SET}
    const w = document.getElementById("ob-wilaya");
    const nW = w.options.length - 1, last = w.options[w.options.length - 1].textContent;
    setV(w, "68"); await sleep(400);
    const c = document.getElementById("ob-city"), bs = [...c.options].slice(1).map((o) => o.value);
    return { nW, last, nBS: bs.length, hasMcif: bs.includes("M'cif"), noMaadid: !bs.includes("Maadid") };`);
  report("69 wilayas, Bou Saada : 23 communes (M'Cif oui, Maadid non)", ref.nW === 69 && /69 El Abiodh Sidi Cheikh/.test(ref.last) && ref.nBS === 23 && ref.hasMcif && ref.noMaadid, JSON.stringify(ref));

  // Code d'activite CNRC : il impose le secteur ; codes bloques et non exportateurs refuses.
  const card = () => run(`return document.querySelector("[data-activity-card]")?.dataset.activityCard + " | " + (document.querySelector("[data-activity-card]")?.innerText.replace(/\\s+/g, " ") ?? "");`);
  await run(`${SET} setV(document.getElementById("ob-activity"), "604616"); return true;`);
  report("Code bloque (604616) : refuse", await waitFor(`return document.querySelector("[data-activity-card='refused']")?.innerText.includes("bloqué");`, 20), await card());
  await run(`${SET} setV(document.getElementById("ob-activity"), "618038"); return true;`);
  report("Code de detail (618038) : non exportateur, refuse", await waitFor(`return document.querySelector("[data-activity-card='refused']")?.innerText.includes("Activité non exportatrice");`, 20), await card());
  await run(`[...document.querySelectorAll("button[aria-controls=activity-search]")][0].click(); return true;`);
  await run(`${SET} setV(document.querySelector("#activity-search input"), "huilerie"); return true;`);
  report("Recherche 'huilerie' : 107301 propose", await waitFor(`return [...document.querySelectorAll("#activity-search [role=option]")].some((o) => o.innerText.includes("107301"));`, 20));
  await run(`[...document.querySelectorAll("#activity-search [role=option]")].find((o) => o.innerText.includes("107301")).click(); return true;`);
  report("107301 choisi : activite libre, secteur Industries alimentaires, description proposee", await waitFor(`const k = document.querySelector("[data-activity-card='ok']"); return !!k && k.innerText.includes("Industries alimentaires") && /libre/i.test(k.innerText) && document.getElementById("ob-activity-desc").value.length > 5;`, 20), await card());
  report("Source CNRC / UpGrowth citee (CC BY 4.0)", await run(`return document.body.innerText.includes("CC BY 4.0") && document.body.innerText.includes("UpGrowth");`));

  // Serveur : NIS et article d'imposition au mauvais format refuses
  await go("/fr/company?tab=identity"); for (let i = 0; i < 30 && !(await run(`return !!document.getElementById("ob-city");`)); i++) await sleep(300);
  await run(`${SET} setV(document.getElementById("ob-nis"), "12345"); setV(document.getElementById("ob-article"), "999"); document.getElementById("ob-nis").form.noValidate = true; save(); return true;`);
  for (let i = 0; i < 30; i++) { await sleep(400); if (await run(`return !!document.getElementById("nis-error");`)) break; }
  const idErr = await run(`return [document.getElementById("nis-error")?.textContent, document.getElementById("taxArticle-error")?.textContent];`);
  report("NIS (15) et article d'imposition (11) controles par le serveur", /15 chiffres/.test(idErr[0] ?? "") && /11 chiffres/.test(idErr[1] ?? ""), JSON.stringify(idErr));

  // Serveur : une commune d'une autre wilaya est refusee (option forgee dans la page)
  await go("/fr/company?tab=identity"); for (let i = 0; i < 30 && !(await run(`return !!document.getElementById("ob-city");`)); i++) await sleep(300);
  await run(`${SET} const c = document.getElementById("ob-city"); const o = new Option("Akbou", "Akbou"); c.add(o); o.selected = true; c.form.noValidate = true; save(); return true;`);
  for (let i = 0; i < 30; i++) { await sleep(400); if (await run(`return !!document.getElementById("city-error");`)) break; }
  const forged = await run(`return document.getElementById("city-error")?.textContent ?? null;`);
  const { data: c3 } = await admin.from("companies").select("city").eq("id", company.id).single();
  report("Serveur : Akbou refusee pour la wilaya de Setif", /commune de la wilaya/.test(forged ?? "") && c3.city === "Setif", `${forged} / base : ${c3.city}`);

  // Anciennes saisies libres : rattachees si possible, sinon signalees
  await admin.from("companies").update({ city: "el-eulma" }).eq("id", company.id);
  await go("/fr/company?tab=identity"); for (let i = 0; i < 30 && !(await run(`return !!document.getElementById("ob-city");`)); i++) await sleep(300);
  report("Ancienne saisie 'el-eulma' reconnue comme El Eulma", await run(`return document.getElementById("ob-city").value === "El Eulma";`));
  await admin.from("companies").update({ city: "Setif centre ville" }).eq("id", company.id);
  await go("/fr/company?tab=identity"); for (let i = 0; i < 30 && !(await run(`return !!document.getElementById("ob-city");`)); i++) await sleep(300);
  report("Ancienne saisie inconnue : a choisir, valeur rappelee", await run(`return document.getElementById("ob-city").value === "" && document.body.innerText.includes("Setif centre ville");`));

  // Arabe : noms des communes en arabe, valeur envoyee inchangee
  await go("/ar/company?tab=identity"); for (let i = 0; i < 30 && !(await run(`return !!document.getElementById("ob-city");`)); i++) await sleep(300);
  report("Arabe : communes affichees en arabe", await run(`const c = document.getElementById("ob-city"); const o = [...c.options].find((x) => x.value === "El Eulma"); return o?.textContent === "العلمة";`), await run(`return [...document.getElementById("ob-city").options].find((x) => x.value === "El Eulma")?.textContent ?? "absente";`));
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  console.log(`Nettoyage : ${users.length} comptes et leurs entreprises supprimes`);
  await sleep(500);
  try { rmSync(`${OUT}/profile-company`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
