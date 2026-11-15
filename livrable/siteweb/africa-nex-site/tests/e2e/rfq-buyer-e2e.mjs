// Test de bout en bout du lot 5a : demande de devis cote acheteur (nouvelle demande, liste, detail).
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
const PDF = `${OUT}/cahier-des-charges.pdf`;
writeFileSync(PDF, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const users = [];
async function makeUser(role, withProfile) {
  const email = `test-rfq-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Aminata ${role}`, role, locale: "fr", phone: "+221771234567" } });
  if (error) throw error;
  users.push(data.user.id);
  const jar = new Map();
  const client = createServerClient(url, pub, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) } });
  await client.auth.signInWithPassword({ email, password });
  if (withProfile) {
    const { error: ce } = await client.from("companies").insert({ company_name: `Dakar Import ${role}`, kind: "buyer", slug: `test-rfq-${Date.now()}-${randomBytes(2).toString("hex")}`, owner_profile_id: data.user.id, country: "SN", city: "Dakar", buyer_type: "importer", interests: ["C10"] });
    if (ce) throw ce;
    await admin.from("profiles").update({ onboarding_completed: true }).eq("id", data.user.id);
  }
  return { id: data.user.id, jar, client };
}

const { data: product } = await admin.from("products").select("id, product_name, companies!inner(id, slug, visibility)").eq("status", "published").eq("companies.slug", "cevital").limit(1).single();
const { data: ifri } = await admin.from("companies").select("id").eq("slug", "ifri").single();

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9347", `--user-data-dir=${OUT}/profile-rfq`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
try {
  const buyer = await makeUser("buyer", true);
  const newBuyer = await makeUser("buyer", false);
  const otherBuyer = await makeUser("buyer", true);
  const producer = await makeUser("producer", false);

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9347/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); if (u) for (const [name, value] of u.jar) await send("Network.setCookie", { name, value, url: BASE, path: "/" }); };
  const waitFor = async (cond, tries = 80) => { for (let i = 0; i < tries; i++) { await sleep(400); try { if (await run(cond)) return true; } catch {} } return false; };
  const go = async (path, ready = "return document.readyState === 'complete' && !!document.querySelector('h1');") => { await send("Page.navigate", { url: BASE + path }); await sleep(800); await waitFor(ready); };
  const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("DOM.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });
  const SET = `const setV = (el, v) => { const p = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };`;
  const submit = `document.querySelector("form").noValidate = true; [...document.querySelectorAll("main button[type=submit]")].at(-1).click();`;
  const pickCountry = async (name) => { await run(`document.getElementById("rfq-country").click(); return true;`); await waitFor(`return [...document.querySelectorAll("[role=option]")].some((x) => x.textContent.includes(${JSON.stringify(name)}));`, 20); await run(`[...document.querySelectorAll("[role=option]")].find((x) => x.textContent.includes(${JSON.stringify(name)}))?.click(); return true;`); await sleep(300); };
  const attach = async (file) => { const { root } = await send("DOM.getDocument"); const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[name=file]" }); await send("DOM.setFileInputFiles", { nodeId, files: [file.replace(/\//g, "\\")] }); await sleep(800); };

  // Acces
  await loginAs(null);
  await go("/fr/rfq/new", `return location.pathname === "/fr/login";`);
  report("Visiteur : renvoye a la connexion", await run(`return location.pathname === "/fr/login" && location.search.includes("rfq");`));
  await go(`/fr/producers/ifri`, `return !!document.getElementById("devis");`);
  report("Fiche publique : Demander un devis mene au formulaire", await run(`return [...document.querySelectorAll("#devis a")].some((a) => decodeURIComponent(a.getAttribute("href")).includes("/fr/rfq/new?producer=ifri"));`));
  await loginAs(producer);
  await go("/fr/rfq/new");
  report("Producteur : reserve aux acheteurs", await waitFor(`return document.body.innerText.includes("Réservé aux acheteurs");`));
  // Nouvel acheteur : profil d'abord, puis retour automatique au formulaire (producteur conserve)
  await loginAs(newBuyer);
  await go("/fr/rfq/new?producer=ifri", `return !!document.getElementById("b-name");`);
  report("Acheteur sans profil : envoye a son profil avec message", await waitFor(`return location.pathname === "/fr/onboarding" && /Dernière étape avant votre demande de devis/.test(document.querySelector("main [role=note]")?.textContent ?? "");`), await run(`return location.pathname + " | " + (document.querySelector("main [role=note]")?.textContent ?? "aucun bandeau");`));
  await run(`${SET}
    setV(document.getElementById("b-name"), "Lagos Trading Ltd");
    document.querySelector("input[name=buyerType][value=importer]").click();
    setV(document.getElementById("b-city"), "Lagos");
    setV(document.getElementById("b-whatsapp"), "+221 77 765 43 21");
    document.querySelector("input[name=interests][value=C10]").click();
    document.getElementById("b-country").click(); return true;`);
  const NIGERIA = `[...document.querySelectorAll("[role=option]")].find((x) => x.textContent.includes("Nigéria") || x.textContent.includes("Nigeria"))`;
  await waitFor(`return !!${NIGERIA};`);
  await run(`${NIGERIA}.click(); return true;`);
  await sleep(300);
  await run(`[...document.querySelectorAll("main button[type=submit]")].at(-1).click(); return true;`);
  report("Profil enregistre : retour au formulaire, Ifri toujours selectionne", await waitFor(`return location.pathname === "/fr/rfq/new" && location.search.includes("producer=ifri") && document.body.innerText.includes("Profil enregistré.") && document.body.innerText.includes("Ifri");`), await run(`return location.pathname + location.search;`));
  await loginAs(buyer);
  await go(`/fr/register?role=buyer&next=${encodeURIComponent("/fr/rfq/new?producer=ifri")}`, `return location.pathname === "/fr/rfq/new";`);
  report("Deja connecte : l'inscription renvoie directement au formulaire", await run(`return location.pathname === "/fr/rfq/new" && location.search === "?producer=ifri";`));
  report("Producteur Ifri pre-selectionne", await waitFor(`return /producteur sélectionné/i.test(document.body.innerText) && document.body.innerText.includes("Ifri");`));

  // Demande 1 : depuis un produit, en unites, avec piece jointe
  await go(`/fr/rfq/new?product=${product.id}`, `return !!document.getElementById("rfq-title");`);
  report("Produit pre-selectionne et designation pre-remplie", await run(`return document.getElementById("rfq-title").value === ${JSON.stringify(product.product_name)};`), product.product_name);
  await run(`${SET} setV(document.getElementById("rfq-qty"), "0"); setV(document.getElementById("rfq-unit"), "t"); ${submit} return true;`);
  report("Quantite nulle, pays et incoterm manquants : refuses par le serveur", await waitFor(`return document.body.innerText.includes("Indiquez une quantité supérieure à zéro.") && document.body.innerText.includes("Faites un choix.");`));
  report("Devise obligatoire, sans valeur par defaut", await run(`const s = document.getElementById("rfq-currency"); return s.required && s.value === "";`));
  await run(`${SET} setV(document.getElementById("rfq-qty"), "20 000"); setV(document.getElementById("rfq-unit"), "t"); setV(document.getElementById("rfq-currency"), "USD"); document.querySelector("input[name=incoterm][value=CIF]").click(); setV(document.getElementById("rfq-port"), "Abidjan"); setV(document.getElementById("rfq-desc"), "Sacs de 50 kg, certificat d'origine."); return true;`);
  // Deuxieme produit dans la meme demande.
  await run(`[...document.querySelectorAll("main button")].find((b) => /ajouter un produit/i.test(b.textContent)).click(); return true;`);
  await waitFor(`return !!document.getElementById("rfq-title-2");`, 10);
  await run(`${SET} setV(document.getElementById("rfq-title-2"), "Sucre roux en vrac"); setV(document.getElementById("rfq-ref-2"), "SR-50"); setV(document.getElementById("rfq-qty-2"), "500"); setV(document.getElementById("rfq-unit-2"), "t"); return true;`);
  await pickCountry("Ivoire");
  report("Pays choisi : Cote d'Ivoire", await run(`return document.querySelector("input[name=country]").value === "CI";`));
  await attach(PDF);
  await shot("rfq-new-units");
  await run(`${submit} return true;`);
  report("Envoi : detail de la demande avec message", await waitFor(`return /\\/fr\\/rfq\\/[0-9a-f-]{36}$/.test(location.pathname) && document.body.innerText.includes("Demande envoyée.");`));
  const rfq1Id = await run(`return location.pathname.split("/").pop();`);
  const { data: rfq1 } = await admin.from("rfqs").select("*").eq("id", rfq1Id).single();
  report("En base : acheteur, entreprise, produit, producteur d'origine, CIF, CI, USD", rfq1?.buyer_profile_id === buyer.id && rfq1.buyer_company_id && rfq1.product_id === product.id && rfq1.source_company_id === product.companies.id && rfq1.incoterm === "CIF" && rfq1.destination_country === "CI" && rfq1.currency === "USD" && rfq1.status === "submitted" && rfq1.title.endsWith("(+1)"), JSON.stringify({ c: rfq1?.destination_country, cur: rfq1?.currency, s: rfq1?.status, t: rfq1?.title }));
  const { data: lines1 } = await admin.from("rfq_lines").select("position, description, reference, quantity, unit, product_id").eq("rfq_id", rfq1Id).order("position");
  report("2 lignes : produit de la fiche (20 000 t) puis sucre roux SR-50 (500 t)", lines1?.length === 2 && lines1[0].product_id === product.id && Number(lines1[0].quantity) === 20000 && lines1[0].unit === "t" && lines1[1].description === "Sucre roux en vrac" && lines1[1].reference === "SR-50" && Number(lines1[1].quantity) === 500 && !lines1[1].product_id, JSON.stringify(lines1));
  const { data: otherLines } = await otherBuyer.client.from("rfq_lines").select("id").eq("rfq_id", rfq1Id);
  report("Autre acheteur : lignes invisibles", otherLines?.length === 0);
  report("Piece jointe rangee sous buyer/<demande>/", Array.isArray(rfq1?.attachments) && rfq1.attachments[0]?.path?.startsWith(`buyer/${rfq1Id}/`));
  report("Detail : produits demandes, cahier des charges et jalons", await run(`const t = document.body.innerText.replace(/\\s/g, " "); return t.includes("20 000 t") && t.includes("Sucre roux en vrac") && t.includes("SR-50") && /devise souhaitée : USD/i.test(t) && t.includes("Abidjan") && t.includes("CIF") && t.includes("Demande envoyée") && t.includes("Qualification AFRICA NEX");`));
  const fileStatus = await run(`const r = await fetch("/api/rfq-files/${rfq1Id}?i=0", { redirect: "manual" }); return r.status || r.type;`);
  report("Piece jointe : lien signe pour l'acheteur", fileStatus === 303 || fileStatus === "opaqueredirect", String(fileStatus));
  await shot("rfq-detail");

  // Demande 2 : depuis la fiche Ifri, en conteneurs
  await go(`/fr/rfq/new?producer=ifri`, `return !!document.getElementById("rfq-title");`);
  await run(`${SET} setV(document.getElementById("rfq-title"), "Eau minérale 1,5 L, packs de 6"); [...document.querySelectorAll("button[role=radio]")].find((b) => b.textContent.includes("conteneurs")).click(); return true;`);
  await sleep(300);
  await run(`${SET} setV(document.getElementById("rfq-count"), "2"); setV(document.getElementById("rfq-currency"), "EUR"); document.querySelector("input[name=containerSize][value='40']").click(); document.querySelector("input[name=incoterm][value=FOB]").click(); return true;`);
  await pickCountry("Sénégal");
  await run(`${submit} return true;`);
  report("Demande en conteneurs envoyee", await waitFor(`return /\\/fr\\/rfq\\/[0-9a-f-]{36}$/.test(location.pathname) && document.body.innerText.includes("2 × 40 pieds");`));
  const rfq2Id = await run(`return location.pathname.split("/").pop();`);
  const { data: rfq2 } = await admin.from("rfqs").select("quantity_mode, container_count, container_size, container_reefer, source_company_id, product_id, quantity").eq("id", rfq2Id).single();
  report("En base : 2 x 40 pieds, Ifri, sans produit", rfq2?.quantity_mode === "containers" && rfq2.container_count === 2 && rfq2.container_size === "40" && rfq2.source_company_id === ifri.id && !rfq2.product_id && rfq2.quantity === null, JSON.stringify(rfq2));

  // Liste, filtres, compteur dans le menu
  await go("/fr/rfq", `return !!document.querySelector("main table, main ul");`);
  report("Mes demandes : 2 demandes", await run(`return document.querySelectorAll("main tbody tr").length === 2;`));
  report("Menu : pas de compteur sans offre prete", await run(`return ![...document.querySelectorAll("aside a")].find((a) => a.getAttribute("href") === "/fr/rfq")?.querySelector("span");`));
  await admin.from("rfqs").update({ status: "offered" }).eq("id", rfq2Id);
  await go("/fr/rfq", `return !!document.querySelector("main table");`);
  report("Offre prete : compteur 1 dans le menu et bouton Comparer", await run(`const a = [...document.querySelectorAll("aside a")].find((x) => x.getAttribute("href") === "/fr/rfq"); return a?.querySelector("span")?.textContent === "1" && document.body.innerText.includes("COMPARER LES OFFRES".toLowerCase()) || [...document.querySelectorAll("main a")].some((x) => /comparer les offres/i.test(x.textContent));`));
  await run(`[...document.querySelectorAll("button[aria-pressed]")].find((b) => b.textContent.startsWith("Offres prêtes")).click(); return true;`);
  await sleep(300);
  report("Filtre Offres pretes : 1 demande", await run(`return document.querySelectorAll("main tbody tr").length === 1;`));
  await shot("rfq-list");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await go("/fr/rfq", `return !!document.querySelector("main ul li");`);
  report("Telephone : cartes, pas de debordement", await run(`return document.querySelectorAll("main ul > li").length === 2 && document.documentElement.scrollWidth <= innerWidth;`));
  await shot("rfq-list-mobile");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });

  // Annulation
  await go(`/fr/rfq/${rfq1Id}`, `return !!document.querySelector("h1");`);
  await run(`[...document.querySelectorAll("main button[type=submit]")].find((b) => /annuler/i.test(b.textContent)).click(); return true;`);
  report("Annulation : message", await waitFor(`return location.search.includes("cancelled=1") && document.body.innerText.includes("Demande annulée.");`));
  const { data: c1 } = await admin.from("rfqs").select("status").eq("id", rfq1Id).single();
  report("En base : demande annulee", c1.status === "cancelled");

  // Isolement
  const { data: seenByOther } = await otherBuyer.client.from("rfqs").select("id").in("id", [rfq1Id, rfq2Id]);
  report("Autre acheteur : 0 demande visible", seenByOther?.length === 0, String(seenByOther?.length));
  const { data: seenByProducer } = await producer.client.from("rfqs").select("id");
  report("Producteur : 0 demande brute visible", seenByProducer?.length === 0, String(seenByProducer?.length));
  const { error: forged } = await otherBuyer.client.from("rfqs").insert({ buyer_profile_id: buyer.id, title: "Usurpation", quantity: 1, unit: "kg" });
  report("Base : impossible de deposer une demande au nom d'un autre", Boolean(forged), forged?.code);
  const { error: forgedStatus } = await buyer.client.from("rfqs").insert({ buyer_profile_id: buyer.id, title: "Statut force", quantity: 1, unit: "kg", status: "offered" });
  report("Base : impossible de creer une demande deja 'offres pretes'", Boolean(forgedStatus), forgedStatus?.code);
  await loginAs(otherBuyer);
  await go(`/fr/rfq/${rfq2Id}`);
  report("Autre acheteur : page introuvable", await run(`return !document.body.innerText.includes("Eau minérale 1,5 L");`));
  const otherFile = await run(`const r = await fetch("/api/rfq-files/${rfq1Id}?i=0", { redirect: "manual" }); return r.status;`);
  report("Autre acheteur : piece jointe refusee", otherFile === 404, String(otherFile));

  // Arabe
  await loginAs(buyer);
  await go("/ar/rfq/new");
  report("Formulaire en arabe (RTL)", await run(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("طلب عرض سعر");`));
  await shot("rfq-new-ar");
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  const { data: rfqs } = await admin.from("rfqs").select("id").in("buyer_profile_id", users);
  for (const r of rfqs ?? []) {
    const { data: files } = await admin.storage.from("rfq-files").list(`buyer/${r.id}`);
    if (files?.length) await admin.storage.from("rfq-files").remove(files.map((f) => `buyer/${r.id}/${f.name}`));
  }
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  console.log("Nettoyage :", users.length, "comptes et", rfqs?.length ?? 0, "demandes supprimes");
  await sleep(300);
  try { rmSync(`${OUT}/profile-rfq`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
