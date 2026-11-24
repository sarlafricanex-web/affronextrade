// Test de bout en bout du lot 5d : comparatif des devis, saisie hors ligne et composition de l'offre.
import { site, OUT, CHROME, openDispatches } from "./_guard.mjs";
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
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const users = [];
let offlineId = null;
async function makeUser(role, name) {
  const email = `test-rfqoffer-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role: role === "admin" ? "buyer" : role, locale: "fr", phone: "+2250701020304" } });
  if (error) throw error;
  users.push(data.user.id);
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const jar = new Map();
  const client = createServerClient(url, pub, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value: v }) => (v ? jar.set(n, v) : jar.delete(n))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, email, jar, client };
}

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9351", `--user-data-dir=${OUT}/profile-rfqoffer`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
try {
  const buyer = await makeUser("buyer", "Awa Buyer");
  const producer = await makeUser("producer", "Karim Producteur");
  const boss = await makeUser("admin", "Admin Test");
  await buyer.client.from("companies").insert({ company_name: `Abidjan Foods ${TAG}`, kind: "buyer", slug: `test-rfqoffer-b-${TAG}`.toLowerCase(), owner_profile_id: buyer.id, country: "CI", city: "Abidjan", buyer_type: "importer", interests: ["C10"] });
  await admin.from("profiles").update({ onboarding_completed: true }).eq("id", buyer.id);
  const { data: bc } = await admin.from("companies").select("id").eq("owner_profile_id", buyer.id).single();
  const producerName = `Huilerie Soummam ${TAG}`;
  await producer.client.from("companies").insert({ company_name: producerName, kind: "producer", slug: `test-rfqoffer-p-${TAG}`.toLowerCase(), owner_profile_id: producer.id, sector: "C10", wilaya: "06", city: "Akbou" });
  const { data: pc } = await admin.from("companies").select("id").eq("owner_profile_id", producer.id).single();
  const offlineName = `Moulin Hors Ligne ${TAG}`;
  const { data: oc, error: oe } = await admin.from("companies").insert({ company_name: offlineName, kind: "producer", slug: `test-rfqoffer-o-${TAG}`.toLowerCase(), claim_status: "unclaimed", created_by_admin: true, visibility: "draft", sector: "C10", wilaya: "15", city: "Tizi Ouzou" }).select("id").single();
  if (oe) throw oe;
  offlineId = oc.id;

  const { data: rfq } = await buyer.client.from("rfqs").insert({ buyer_profile_id: buyer.id, buyer_company_id: bc.id, title: `Huile d'olive ${TAG}`, quantity: 2000, unit: "l", incoterm: "CIF", destination_country: "CI", destination_port: "Abidjan" }).select("id").single();
  const brief = { rfq_id: rfq.id, brief_title: `Huile d'olive extra vierge 5 L ${TAG}`, brief_specs: "Bidons métal 5 L.", quantity: 2000, unit: "l", destination_country: "CI", requested_incoterm: "FOB", respond_by: day(5), created_by: boss.id };
  const { data: d1 } = await admin.from("rfq_dispatches").insert({ ...brief, company_id: pc.id }).select("id").single();
  const { data: d2 } = await admin.from("rfq_dispatches").insert({ ...brief, company_id: offlineId }).select("id").single();
  await openDispatches(admin, [d1?.id, d2?.id]);
  await admin.from("rfqs").update({ status: "dispatched" }).eq("id", rfq.id);
  const { data: qA, error: qe } = await producer.client.from("quotes").insert({ dispatch_id: d1.id, company_id: pc.id, author_profile_id: producer.id, unit_price_ht: 4.7, currency: "USD", price_basis: "FOB", port_of_loading: "Béjaïa", quantity: 2000, production_lead_days: 25, payment_terms: "30 % à la commande", valid_until: day(30) }).select("id").single();
  if (qe) throw qe;

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9351/json/list")).json()).find((t) => t.type === "page"); } catch {} }
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
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1300, deviceScaleFactor: 1, mobile: false });
  const SET = `const setV = (el, v) => { const p = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };`;
  const RFQ_PAGE = `/fr/admin/rfqs/${rfq.id}`;
  const clickButton = (re) => `document.querySelector("main form") && (document.querySelectorAll("main form").forEach((f) => (f.noValidate = true))); [...document.querySelectorAll("main button[type=submit]")].find((b) => ${re}.test(b.textContent)).click();`;
  // Le formulaire d'offre est remonte a chaque reponse : on le marque, puis on attend qu'il soit remplace.
  const MARK = `document.getElementById("o-price").closest("form").dataset.old = "1";`;
  const REMOUNTED = `!document.querySelector("form[data-old]") && !!document.getElementById("o-price")`;
  const calc = (line) => `document.querySelector('[data-line="${line}"]')?.textContent.replace(/\\s/g, "")`;

  // Acces
  await loginAs(producer);
  await go(`/fr/admin/rfqs/${rfq.id}/offer?quote=${qA.id}`, `return location.pathname === "/fr/dashboard";`);
  report("Producteur : composeur d'offre refuse", await run(`return location.pathname === "/fr/dashboard";`));

  // Fiche admin : comparatif et lien de saisie hors ligne
  await loginAs(boss);
  await go(RFQ_PAGE, `return !!document.getElementById("quotes-title");`);
  report("Comparatif : 1 devis recu", await run(`return document.getElementById("quotes-title").textContent.includes("(1)") && !!document.querySelector('[data-quote="${qA.id}"]');`));
  report("Producteur hors ligne : lien 'Saisir son devis'", await run(`return !!document.querySelector('a[href$="/quote/${d2.id}"]');`));

  // Saisie du devis hors ligne
  await go(`/fr/admin/rfqs/${rfq.id}/quote/${d2.id}`, `return !!document.getElementById("q-price");`);
  report("Saisie : titre au nom du producteur", await run(`return document.querySelector("h1").textContent.includes(${JSON.stringify(offlineName)});`));
  await run(`${SET} setV(document.getElementById("q-price"), "4,50"); setV(document.getElementById("q-qty"), "2000"); setV(document.getElementById("q-lead"), "30"); setV(document.getElementById("q-valid"), "${day(20)}"); document.querySelector("input[name=priceBasis][value=FOB]").click(); return true;`);
  await sleep(300);
  await run(`${clickButton("/enregistrer le devis/i")} return true;`);
  report("Saisie : retour a la fiche avec message", await waitFor(`return location.pathname === "${RFQ_PAGE}" && document.body.innerText.includes("Devis enregistré.");`));
  const { data: qB } = await admin.from("quotes").select("id, company_id, author_profile_id, unit_price_ht, status").eq("dispatch_id", d2.id).single();
  report("En base : devis au nom du producteur hors ligne, saisi par l'admin", qB?.company_id === offlineId && qB.author_profile_id === boss.id && Number(qB.unit_price_ht) === 4.5 && qB.status === "submitted");
  const { data: d2s } = await admin.from("rfq_dispatches").select("status").eq("id", d2.id).single();
  report("Envoi hors ligne passe 'devis recu'", d2s.status === "quoted", d2s.status);
  report("Comparatif : 2 devis, meilleur prix sur 4,50, saisi par AFRICA NEX", await run(`const row = document.querySelector('[data-quote="${qB.id}"]'); return document.getElementById("quotes-title").textContent.includes("(2)") && /meilleur prix/i.test(row.innerText) && row.innerText.includes("Saisi par AFRICA NEX") && !/meilleur prix/i.test(document.querySelector('[data-quote="${qA.id}"]').innerText);`));
  await shot("offer-compare");

  // Composeur : valeurs par defaut et grille
  await run(`document.querySelector('[data-quote="${qA.id}"] a').click(); return true;`);
  report("Composeur ouvert depuis le comparatif", await waitFor(`return location.search.includes("quote=${qA.id}") && !!document.getElementById("o-price");`));
  report("Defauts : offre A, prix 4.7, CIF, commission 7 (9 400 USD), assurance 1", await run(`const g = (i) => document.getElementById(i).value; return g("o-label") === "A" && g("o-price") === "4.7" && g("o-incoterm") === "CIF" && g("o-commission") === "7" && g("o-insurance") === "1" && g("o-place") === "Abidjan";`), await run(`return ["o-label","o-price","o-incoterm","o-commission","o-insurance","o-place"].map((i) => document.getElementById(i).value).join("|");`));
  report("CIF : fret demande et rappel 110 %", await run(`return !!document.getElementById("o-freight") && document.body.innerText.includes("110 %");`));
  await run(`${SET} setV(document.getElementById("o-qty"), "1000"); return true;`);
  report("Grille : 4 700 USD -> 10 %", await waitFor(`return document.getElementById("o-commission").value === "10";`, 10));
  await run(`${SET} setV(document.getElementById("o-qty"), "200000"); return true;`);
  report("Grille : 940 000 USD -> 5 %", await waitFor(`return document.getElementById("o-commission").value === "5";`, 10));
  await run(`${SET} setV(document.getElementById("o-qty"), "2000"); return true;`);
  report("Grille : 9 400 USD -> 7 %", await waitFor(`return document.getElementById("o-commission").value === "7";`, 10));

  // Refus : fret manquant en CIF, puis nom du producteur dans l'offre
  await run(`${MARK} ${clickButton("/brouillon/i")} return true;`);
  report("CIF sans fret : refuse", await waitFor(`return ${REMOUNTED} && document.body.innerText.includes("Indiquez le fret");`));
  await run(`${SET} setV(document.getElementById("o-freight"), "1200"); setV(document.getElementById("o-notes"), "Produit par ${producerName}, Akbou."); setV(document.getElementById("o-packaging"), "Bidons métal 5 L"); return true;`);
  await sleep(300);
  report("Apercu : 5,68 USD le litre, total 11 360, commission 666, assurance 94", await run(`return ${calc("unit")}.includes("5,68USD") && ${calc("total")}.includes("11360,00USD") && ${calc("commission")}.includes("666,00USD") && ${calc("insurance")}.includes("94,00USD");`), await run(`return [${calc("unit")}, ${calc("total")}, ${calc("commission")}, ${calc("insurance")}].join(" | ");`));
  await shot("offer-composer");
  await run(`${MARK} ${clickButton("/brouillon/i")} return true;`);
  report("Offre citant le producteur : refusee", await waitFor(`return ${REMOUNTED} && document.body.innerText.includes("L'offre cite le nom du producteur");`));
  const { count: noOffer } = await admin.from("offers").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id);
  report("Aucune offre apres les refus", noOffer === 0, String(noOffer));

  // Brouillon valide
  await run(`${SET} setV(document.getElementById("o-notes"), "Lot homogène, analyses disponibles."); return true;`);
  await sleep(300);
  await run(`${clickButton("/brouillon/i")} return true;`);
  report("Brouillon : message", await waitFor(`return location.pathname === "${RFQ_PAGE}" && document.body.innerText.includes("Offre enregistrée en brouillon.");`));
  const { data: offer } = await admin.from("offers").select("*, offer_margins(*)").eq("rfq_id", rfq.id).single();
  const m = Array.isArray(offer?.offer_margins) ? offer.offer_margins[0] : offer?.offer_margins;
  report("En base : offre A brouillon 5,68 USD CIF Abidjan, total 11 360", offer?.status === "draft" && offer.label === "A" && Number(offer.unit_price) === 5.68 && Number(offer.total_amount) === 11360 && offer.currency === "USD" && offer.incoterm === "CIF" && offer.incoterm_place === "Abidjan", JSON.stringify({ s: offer?.status, u: offer?.unit_price, t: offer?.total_amount }));
  report("Marge : 4,70 fournisseur, 7 % = 666, assurance 1 % = 94, fret 1 200", m && Number(m.producer_unit_price) === 4.7 && Number(m.commission_rate) === 7 && Number(m.commission_amount) === 666 && Number(m.insurance_rate) === 1 && Number(m.insurance_cost) === 94 && Number(m.freight_cost) === 1200 && m.source_quote_id === qA.id, JSON.stringify(m));
  const { data: buyerDraft } = await buyer.client.from("offers").select("id");
  report("Acheteur : brouillon invisible", buyerDraft?.length === 0);
  report("Fiche : offre A en brouillon avec la marge interne", await run(`const o = document.querySelector('[data-offer="A"]'); return !!o && /brouillon/i.test(o.innerText) &&o.innerText.replace(/\\s/g, " ").includes("commission 666");`));

  // Publication
  await run(`[...document.querySelectorAll('[data-offer="A"] button[type=submit]')].find((b) => /publier/i.test(b.textContent)).click(); return true;`);
  report("Publication : message", await waitFor(`return location.search.includes("done=offerPublished");`));
  const { data: pubOffer } = await admin.from("offers").select("status, published_at").eq("id", offer.id).single();
  const { data: rfqState } = await admin.from("rfqs").select("status").eq("id", rfq.id).single();
  const { data: qAState } = await admin.from("quotes").select("status").eq("id", qA.id).single();
  report("En base : offre publiee, demande 'offres pretes', devis A retenu", pubOffer.status === "published" && Boolean(pubOffer.published_at) && rfqState.status === "offered" && qAState.status === "selected", `${pubOffer.status} ${rfqState.status} ${qAState.status}`);
  const { data: buyerSees } = await buyer.client.from("offers").select("unit_price, currency");
  report("Acheteur : voit l'offre publiee a 5,68 USD", buyerSees?.length === 1 && Number(buyerSees[0].unit_price) === 5.68);
  const { data: buyerMargins } = await buyer.client.from("offer_margins").select("offer_id");
  report("Acheteur : aucune marge visible", buyerMargins?.length === 0);
  const { data: prodOffers } = await producer.client.from("offers").select("id");
  const { data: prodMargins } = await producer.client.from("offer_margins").select("offer_id");
  report("Producteur : ni offre ni marge visibles", prodOffers?.length === 0 && prodMargins?.length === 0);
  await loginAs(buyer);
  await go("/fr/rfq", `return !!document.querySelector("aside");`);
  report("Acheteur : compteur 'offre prete' dans le menu", await waitFor(`const a = [...document.querySelectorAll("aside a")].find((x) => x.getAttribute("href") === "/fr/rfq"); return a?.querySelector(".app-count")?.textContent === "1";`, 20));

  // Retrait
  await loginAs(boss);
  await go(RFQ_PAGE, `return !!document.querySelector('[data-offer="A"]');`);
  await run(`[...document.querySelectorAll('[data-offer="A"] button[type=submit]')].find((b) => /retirer/i.test(b.textContent)).click(); return true;`);
  report("Retrait : message", await waitFor(`return location.search.includes("done=offerWithdrawn");`));
  const { data: w1 } = await admin.from("offers").select("status").eq("id", offer.id).single();
  const { data: w2 } = await admin.from("rfqs").select("status").eq("id", rfq.id).single();
  const { data: w3 } = await admin.from("quotes").select("status").eq("id", qA.id).single();
  report("En base : offre en brouillon, demande revenue 'producteurs consultes', devis A rouvert", w1.status === "draft" && w2.status === "dispatched" && w3.status === "submitted", `${w1.status} ${w2.status} ${w3.status}`);

  // Deuxieme offre depuis le devis hors ligne, puis suppression du brouillon
  await go(`/fr/admin/rfqs/${rfq.id}/offer?quote=${qB.id}`, `return !!document.getElementById("o-price");`);
  report("Offre B : lettre suivante proposee", await run(`return document.getElementById("o-label").value === "B";`));
  await run(`${SET} setV(document.getElementById("o-incoterm"), "FOB"); return true;`);
  await sleep(300);
  report("FOB : pas de fret", await run(`return !document.getElementById("o-freight");`));
  await run(`${clickButton("/brouillon/i")} return true;`);
  report("Offre B enregistree", await waitFor(`return location.search.includes("done=offerSaved") && !!document.querySelector('[data-offer="B"]');`));
  await run(`[...document.querySelectorAll('[data-offer="B"] button[type=submit]')].find((b) => /supprimer/i.test(b.textContent)).click(); return true;`);
  report("Brouillon B supprime", await waitFor(`return location.search.includes("done=offerDeleted") && !document.querySelector('[data-offer="B"]');`));
  const { count: left } = await admin.from("offers").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id);
  report("En base : il reste l'offre A", left === 1, String(left));

  // Arabe
  await go(`/ar/admin/rfqs/${rfq.id}/offer?quote=${qA.id}`, `return !!document.getElementById("o-price");`);
  report("Composeur en arabe (RTL)", await run(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("حساب العرض");`));
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  await admin.from("rfqs").delete().in("buyer_profile_id", users);
  if (offlineId) await admin.from("companies").delete().eq("id", offlineId);
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  console.log("Nettoyage :", users.length, "comptes supprimes");
  await sleep(300);
  try { rmSync(`${OUT}/profile-rfqoffer`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
