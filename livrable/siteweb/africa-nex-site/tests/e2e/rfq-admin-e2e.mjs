// Test de bout en bout du lot 5b : console AFRICA NEX des demandes (qualification, brief anonymise, envoi).
import { site, OUT, CHROME, openDispatches } from "./_guard.mjs";
import { waitEmails, delivered } from "./_emails.mjs";
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
  const email = `test-rfqadm-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role: role === "admin" ? "buyer" : role, locale: "fr", phone: "+2348031234567" } });
  if (error) throw error;
  users.push(data.user.id);
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const jar = new Map();
  const client = createServerClient(url, pub, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value: v }) => (v ? jar.set(n, v) : jar.delete(n))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, email, jar, client };
}

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9348", `--user-data-dir=${OUT}/profile-rfqadm`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
try {
  const buyer = await makeUser("buyer", "Chidi Buyer");
  const boss = await makeUser("admin", "Admin Test");
  const producer = await makeUser("producer", "Karim Producteur");
  const buyerName = `Lagos Foods ${TAG}`, producerName = `Huilerie Dispatch ${TAG}`;
  await buyer.client.from("companies").insert({ company_name: buyerName, kind: "buyer", slug: `test-rfqadm-b-${TAG}`.toLowerCase(), owner_profile_id: buyer.id, country: "NG", city: "Lagos", buyer_type: "importer", interests: ["C10"] });
  await admin.from("profiles").update({ onboarding_completed: true }).eq("id", buyer.id);
  const { data: bc } = await admin.from("companies").select("id").eq("owner_profile_id", buyer.id).single();
  await admin.from("company_private").update({ contact_phone: "+2348031234567" }).eq("company_id", bc.id);
  await producer.client.from("companies").insert({ company_name: producerName, kind: "producer", slug: `test-rfqadm-p-${TAG}`.toLowerCase(), owner_profile_id: producer.id, sector: "C10", wilaya: "06", city: "Akbou" });
  const { data: pc } = await admin.from("companies").select("id").eq("owner_profile_id", producer.id).single();
  const { data: ifri } = await admin.from("companies").select("id").eq("slug", "ifri").single();
  const { data: rfq, error: re } = await buyer.client.from("rfqs").insert({ buyer_profile_id: buyer.id, buyer_company_id: bc.id, title: `Huile d'olive 5 L ${TAG}`, description: "Bidons métal 5 L, acidité < 0,8 %.", quantity: 2000, unit: "l", incoterm: "CIF", destination_country: "CI", destination_port: "Abidjan" }).select("id").single();
  if (re) throw re;

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9348/json/list")).json()).find((t) => t.type === "page"); } catch {} }
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
  const tick = (cid) => `{ const c = document.querySelector("input[name=companies][value='${cid}']"); if (c && !c.checked) c.click(); }`;
  const sendBrief = `[...document.querySelectorAll("main button[type=submit]")].find((b) => /Envoyer le brief/i.test(b.textContent)).click();`;

  // Acces
  await loginAs(buyer);
  await go("/fr/admin/rfqs", `return location.pathname === "/fr/dashboard";`);
  report("Acheteur : console refusee", await run(`return location.pathname === "/fr/dashboard";`));

  // File et fiche
  await loginAs(boss);
  await go("/fr/admin/rfqs?f=todo", `return !!document.querySelector("main table");`);
  report("File : demande a qualifier visible avec l'acheteur", await run(`return document.body.innerText.includes(${JSON.stringify(`Huile d'olive 5 L ${TAG}`)}) && document.body.innerText.includes(${JSON.stringify(buyerName)});`));
  report("Menu admin : compteur des demandes a qualifier", await run(`const a = [...document.querySelectorAll("aside a")].find((x) => x.getAttribute("href") === "/fr/admin/rfqs"); return Number(a?.querySelector(".app-count")?.textContent) >= 1;`));
  await go(`/fr/admin/rfqs/${rfq.id}`, `return !!document.getElementById("d-title");`);
  report("Fiche : acheteur et contact visibles par AFRICA NEX, marques confidentiels", await run(`const t = document.body.innerText; return t.includes(${JSON.stringify(buyerName)}) && t.includes("+2348031234567") && /jamais communiqué aux producteurs/i.test(t);`));
  report("Brief prerempli sans le nom de l'acheteur", await run(`return !document.getElementById("d-specs").value.includes(${JSON.stringify(buyerName)}) && document.getElementById("d-title").value.includes("Huile d'olive");`));

  // Qualification
  await run(`[...document.querySelectorAll("main button[type=submit]")].find((b) => /prendre en charge/i.test(b.textContent)).click(); return true;`);
  report("Prise en charge : message", await waitFor(`return location.search.includes("done=qualify");`));
  const { data: s1 } = await admin.from("rfqs").select("status").eq("id", rfq.id).single();
  report("En base : qualifiee", s1.status === "qualified");
  await buyer.client.from("rfqs").update({ status: "cancelled" }).eq("id", rfq.id);
  const { data: s2 } = await admin.from("rfqs").select("status").eq("id", rfq.id).single();
  report("Acheteur : ne peut plus annuler une demande prise en charge", s2.status === "qualified", s2.status);

  // Garde-fou d'anonymat
  await run(`${SET} setV(document.getElementById("d-specs"), "Pour le client ${buyerName}, bidons 5 L."); ${tick(pc.id)} return true;`);
  await sleep(300);
  // Le formulaire est remonte a chaque reponse : on le marque, puis on attend qu'il soit remplace.
  const MARK = `document.getElementById("d-specs").closest("form").dataset.old = "1";`;
  const REMOUNTED = `!document.querySelector("form[data-old]") && !!document.getElementById("d-specs")`;
  await run(`${MARK} ${sendBrief} return true;`);
  report("Brief avec le nom de l'acheteur : refuse", await waitFor(`return ${REMOUNTED} && document.body.innerText.includes("Le brief contient le nom, l'email ou le téléphone de l'acheteur");`));
  await run(`${SET} setV(document.getElementById("d-specs"), "Rappeler le 0803 123 4567 pour details."); ${tick(pc.id)} return true;`);
  await sleep(300);
  await run(`${MARK} ${sendBrief} return true;`);
  report("Brief avec le telephone de l'acheteur : refuse", await waitFor(`return ${REMOUNTED} && document.body.innerText.includes("Le brief contient le nom, l'email ou le téléphone de l'acheteur");`));
  const { count: none } = await admin.from("rfq_dispatches").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id);
  report("Aucun envoi apres les refus", none === 0, String(none));

  // Envoi valide a 2 producteurs (dont une fiche non revendiquee)
  await run(`${SET} setV(document.getElementById("d-specs"), "Bidons métal 5 L, acidité < 0,8 %. Port : Abidjan."); ${tick(pc.id)} ${tick(ifri.id)} return true;`);
  await sleep(300);
  report("Fiche non revendiquee signalee (contact hors ligne)", await run(`return document.body.innerText.includes("Fiche non revendiquée : à contacter hors ligne");`));
  await shot("rfq-admin-dispatch");
  await run(`${sendBrief} return true;`);
  report("Envoi : message 2 producteurs", await waitFor(`return location.search.includes("done=dispatch") && document.body.innerText.includes("Brief envoyé à 2 producteurs");`));
  const { data: ds } = await admin.from("rfq_dispatches").select("company_id, status, respond_by, brief_title, brief_specs, requested_incoterm, destination_country, quantity, unit").eq("rfq_id", rfq.id);
  report("En base : 2 envois, statut envoye, date de reponse, FOB, CI, 2000 L", ds?.length === 2 && ds.every((d) => d.status === "sent" && d.respond_by && d.requested_incoterm === "FOB" && d.destination_country === "CI" && Number(d.quantity) === 2000 && d.unit === "l"), JSON.stringify(ds?.map((d) => d.status)));
  // Emails : un par personne des entreprises consultees (une fiche non revendiquee n'a personne).
  const { data: members } = await admin.from("company_members").select("profile_id").in("company_id", (ds ?? []).map((d) => d.company_id));
  const mails = await waitEmails(admin, { rfq_id: rfq.id, kind: "new_request" }, { count: members?.length ?? 0 });
  report("Emails aux producteurs consultes : journalises, sans le nom de l'acheteur", (members?.length ?? 0) > 0 && mails.length === members.length && delivered(mails) && mails.every((m) => !m.subject.includes(buyerName) && members.some((x) => x.profile_id === m.recipient_profile_id)), `${mails.length} email(s) pour ${members?.length} personne(s)`);
  const { data: s3 } = await admin.from("rfqs").select("status").eq("id", rfq.id).single();
  report("En base : demande passee 'producteurs consultes'", s3.status === "dispatched");
  const { count: audit } = await admin.from("audit_log").select("id", { count: "exact", head: true }).eq("action", "rfq.dispatch").eq("entity_id", rfq.id);
  report("Envoi trace dans le journal", audit === 1);
  report("Producteurs deja consultes : cases desactivees", await run(`return document.querySelector("input[name=companies][value='${pc.id}']")?.disabled === true;`));
  await shot("rfq-admin-detail");

  // Passeport : la demande n'est visible du producteur que 48 h apres l'envoi.
  const { data: early } = await producer.client.from("rfq_dispatches").select("id");
  report("Passeport : demande pas encore visible du producteur gratuit", (early ?? []).length === 0, String(early?.length));
  const { data: timing } = await admin.from("rfq_dispatches").select("id, created_at, visible_from").eq("rfq_id", rfq.id);
  report("En base : visible 48 h apres l'envoi", timing?.length === 2 && timing.every((d) => Math.abs(new Date(d.visible_from) - new Date(d.created_at) - 48 * 3600e3) < 120e3), JSON.stringify(timing?.[0]));
  report("Console : date d'ouverture affichee pour les 2 producteurs gratuits", await run(`return document.querySelectorAll("[data-opens-at]").length === 2;`));
  await openDispatches(admin, (timing ?? []).map((d) => d.id));

  // Ce que voit chaque partie
  const { data: mine } = await producer.client.from("rfq_dispatches").select("id, brief_title, brief_specs, company_id");
  report("Producteur : voit uniquement son envoi", mine?.length === 1 && mine[0].company_id === pc.id, String(mine?.length));
  report("Producteur : le brief ne contient pas l'acheteur", mine?.[0] && !`${mine[0].brief_title} ${mine[0].brief_specs}`.includes(buyerName));
  const { data: rawForProducer } = await producer.client.from("rfqs").select("id");
  report("Producteur : 0 demande brute visible", rawForProducer?.length === 0);
  const { data: buyerSeesDispatch } = await buyer.client.from("rfq_dispatches").select("id");
  report("Acheteur : ne voit aucun envoi aux producteurs", buyerSeesDispatch?.length === 0);
  await loginAs(buyer);
  await go(`/fr/rfq/${rfq.id}`);
  report("Acheteur : etape 'producteurs consultes', sans nom de producteur", await run(`const t = document.body.innerText; return /producteurs consultés/i.test(t) && !t.includes(${JSON.stringify(producerName)}) && !t.includes("Ifri");`));

  // Cloture et arabe
  await loginAs(boss);
  await go(`/fr/admin/rfqs/${rfq.id}`);
  await run(`[...document.querySelectorAll("main button[type=submit]")].find((b) => /clôturer/i.test(b.textContent)).click(); return true;`);
  report("Cloture : message", await waitFor(`return location.search.includes("done=close");`));
  const { data: s4 } = await admin.from("rfqs").select("status").eq("id", rfq.id).single();
  report("En base : cloturee", s4.status === "closed");
  await go(`/ar/admin/rfqs/${rfq.id}`);
  report("Console en arabe (RTL)", await run(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("طلبات عروض الأسعار");`));
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  await admin.from("audit_log").delete().in("actor_profile_id", users);
  await admin.from("rfqs").delete().in("buyer_profile_id", users);
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  console.log("Nettoyage :", users.length, "comptes supprimes");
  await sleep(300);
  try { rmSync(`${OUT}/profile-rfqadm`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
