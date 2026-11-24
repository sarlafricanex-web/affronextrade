// Test de bout en bout du lot 5c : demandes recues et devis cote producteur.
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
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const PDF = `${OUT}/fiche-technique.pdf`;
writeFileSync(PDF, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const users = [];
async function makeUser(role, name) {
  const email = `test-rfqprod-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role: role === "admin" ? "buyer" : role, locale: "fr", phone: "+2250701020304" } });
  if (error) throw error;
  users.push(data.user.id);
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const jar = new Map();
  const client = createServerClient(url, pub, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value: v }) => (v ? jar.set(n, v) : jar.delete(n))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, email, jar, client };
}

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9349", `--user-data-dir=${OUT}/profile-rfqprod`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
try {
  const buyer = await makeUser("buyer", "Awa Buyer");
  const producer = await makeUser("producer", "Karim Producteur");
  const rival = await makeUser("producer", "Rival Producteur");
  const boss = await makeUser("admin", "Admin Test");
  const buyerName = `Abidjan Foods ${TAG}`;
  await buyer.client.from("companies").insert({ company_name: buyerName, kind: "buyer", slug: `test-rfqprod-b-${TAG}`.toLowerCase(), owner_profile_id: buyer.id, country: "CI", city: "Abidjan", buyer_type: "importer", interests: ["C10"] });
  await admin.from("profiles").update({ onboarding_completed: true }).eq("id", buyer.id);
  const { data: bc } = await admin.from("companies").select("id").eq("owner_profile_id", buyer.id).single();
  for (const [u, n] of [[producer, `Huilerie Quote ${TAG}`], [rival, `Huilerie Rival ${TAG}`]]) {
    await u.client.from("companies").insert({ company_name: n, kind: "producer", slug: `test-${n}`.toLowerCase().replace(/\W+/g, "-"), owner_profile_id: u.id, sector: "C10", wilaya: "06", city: "Akbou" });
  }
  const { data: pc } = await admin.from("companies").select("id").eq("owner_profile_id", producer.id).single();
  const { data: rc } = await admin.from("companies").select("id").eq("owner_profile_id", rival.id).single();
  const { data: rfq } = await buyer.client.from("rfqs").insert({ buyer_profile_id: buyer.id, buyer_company_id: bc.id, title: `Huile d'olive ${TAG}`, quantity: 2000, unit: "l", incoterm: "CIF", destination_country: "CI" }).select("id").single();
  const brief = { rfq_id: rfq.id, brief_title: `Huile d'olive extra vierge 5 L ${TAG}`, brief_specs: "Bidons métal 5 L, acidité < 0,8 %.", quantity: 2000, unit: "l", destination_country: "CI", requested_incoterm: "FOB", respond_by: day(2), created_by: boss.id };
  const { data: d1, error: de } = await admin.from("rfq_dispatches").insert({ ...brief, company_id: pc.id }).select("id, reference").single();
  if (de) throw de;
  const { data: d2 } = await admin.from("rfq_dispatches").insert({ ...brief, company_id: rc.id }).select("id").single();
  await openDispatches(admin, [d1?.id, d2?.id]);
  await admin.from("rfqs").update({ status: "dispatched" }).eq("id", rfq.id);

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9349/json/list")).json()).find((t) => t.type === "page"); } catch {} }
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
  const SET = `const setV = (el, v) => { const p = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };`;
  const submit = `document.querySelector("main form").noValidate = true; [...document.querySelectorAll("main button[type=submit]")].find((b) => /devis/i.test(b.textContent)).click();`;
  const attach = async (file) => { const { root } = await send("DOM.getDocument"); const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[name=file]" }); await send("DOM.setFileInputFiles", { nodeId, files: [file.replace(/\//g, "\\")] }); await sleep(800); };

  // Acces
  await loginAs(buyer);
  await go("/fr/requests", `return location.pathname === "/fr/dashboard";`);
  report("Acheteur : demandes recues refusees", await run(`return location.pathname === "/fr/dashboard";`));

  // Liste et compteur
  await loginAs(producer);
  await go("/fr/requests", `return !!document.querySelector("main table");`);
  report("Menu producteur : compteur 1 nouvelle demande", await run(`const a = [...document.querySelectorAll("aside a")].find((x) => x.getAttribute("href") === "/fr/requests"); return a?.querySelector(".app-count")?.textContent === "1";`));
  report("Liste : reference, Nouvelle, delai urgent", await run(`const t = document.body.innerText; return t.includes(${JSON.stringify(d1.reference)}) && /nouvelle/i.test(t) && /reste \\d+ h \\(urgent\\)/i.test(t);`));
  report("Liste : aucune trace de l'acheteur", await run(`return !document.body.innerText.includes(${JSON.stringify(buyerName)});`));
  await shot("requests-list");

  // Detail : vue, brief, pas d'acheteur
  await go(`/fr/requests/${d1.id}`, `return !!document.getElementById("q-price");`);
  report("Detail : brief, volume, destination, FOB", await run(`const t = document.body.innerText.replace(/\\s/g, " "); return t.includes("Bidons métal 5 L") && t.includes("2 000 L") && t.includes("Côte d") && t.includes("FOB");`));
  report("Detail : aucune trace de l'acheteur (nom, email)", await run(`const h = document.documentElement.outerHTML; return !h.includes(${JSON.stringify(buyerName)}) && !h.includes(${JSON.stringify(buyer.email)});`));
  await sleep(1500);
  const { data: v1 } = await admin.from("rfq_dispatches").select("status, viewed_at").eq("id", d1.id).single();
  report("Premiere ouverture : demande marquee vue", v1.status === "viewed" && Boolean(v1.viewed_at), v1.status);

  // Devis invalide puis valide
  await run(`${SET} setV(document.getElementById("q-price"), "0"); ${submit} return true;`);
  report("Prix nul, delai et validite manquants : refuses", await waitFor(`const t = document.body.innerText; return t.includes("Prix invalide") && t.includes("Indiquez un nombre de jours") && t.includes("Date de validité requise");`));
  await run(`${SET} setV(document.getElementById("q-price"), "4,85"); setV(document.getElementById("q-qty"), "2000"); setV(document.getElementById("q-lead"), "25"); setV(document.getElementById("q-port"), "Béjaïa"); setV(document.getElementById("q-valid"), "${day(30)}"); setV(document.getElementById("q-pay"), "30 % à la commande, 70 % contre documents"); setV(document.getElementById("q-notes"), "Palettes Europe 80x120."); document.querySelector("input[name=priceBasis][value=FOB]").click(); return true;`);
  await sleep(300);
  report("Total calcule en direct : 9 700 USD", await run(`return document.body.innerText.replace(/\\s/g, "").includes("9700USD");`));
  await attach(PDF);
  await shot("requests-quote-form");
  await run(`${submit} return true;`);
  report("Devis envoye : message", await waitFor(`return location.search.includes("sent=new") && document.body.innerText.includes("Devis envoyé à AFRICA NEX");`));
  const { data: q1 } = await admin.from("quotes").select("*").eq("dispatch_id", d1.id).single();
  report("En base : devis 4,85 USD FOB, 2000, 25 j, auteur et entreprise", q1 && Number(q1.unit_price_ht) === 4.85 && q1.currency === "USD" && q1.price_basis === "FOB" && Number(q1.quantity) === 2000 && q1.production_lead_days === 25 && q1.company_id === pc.id && q1.author_profile_id === producer.id && q1.status === "submitted");
  report("Piece jointe rangee sous dispatch/<envoi>/", Array.isArray(q1?.attachments) && q1.attachments[0]?.path?.startsWith(`dispatch/${d1.id}/`));
  const { data: v2 } = await admin.from("rfq_dispatches").select("status").eq("id", d1.id).single();
  report("Envoi passe 'devis recu'", v2.status === "quoted", v2.status);
  const quoteMails = await waitEmails(admin, { rfq_id: rfq.id, kind: "admin_new_quote" });
  report("Email a AFRICA NEX : devis recu, avec le producteur et le prix", quoteMails.length === 1 && delivered(quoteMails) && quoteMails[0].subject.startsWith("Devis reçu") && quoteMails[0].subject.includes(`Huilerie Quote ${TAG}`), JSON.stringify(quoteMails.map((m) => `${m.status} ${m.subject}`)));

  // Mise a jour
  await run(`${SET} setV(document.getElementById("q-price"), "4,70"); ${submit} return true;`);
  report("Mise a jour : message", await waitFor(`return location.search.includes("sent=update") && document.body.innerText.includes("Devis mis à jour.");`));
  const { data: q2 } = await admin.from("quotes").select("unit_price_ht").eq("dispatch_id", d1.id).single();
  const updateMails = await waitEmails(admin, { rfq_id: rfq.id, kind: "admin_new_quote" }, { count: 2 });
  report("Email a AFRICA NEX : devis mis a jour", updateMails.length === 2 && updateMails[1].subject.startsWith("Devis mis à jour"), JSON.stringify(updateMails.map((m) => m.subject)));
  report("En base : prix mis a jour 4,70", Number(q2.unit_price_ht) === 4.7);
  await go("/fr/requests", `return !!document.querySelector("main [role=tablist]");`);
  report("Compteur disparu apres ouverture", await run(`const a = [...document.querySelectorAll("aside a")].find((x) => x.getAttribute("href") === "/fr/requests"); return !a?.querySelector(".app-count");`));

  // Cloisonnement
  const { data: rivalSees } = await rival.client.from("quotes").select("id");
  report("Concurrent : ne voit pas le devis", rivalSees?.length === 0);
  const { data: rivalDispatches } = await rival.client.from("rfq_dispatches").select("id, company_id");
  report("Concurrent : ne voit que son propre envoi", rivalDispatches?.length === 1 && rivalDispatches[0].company_id === rc.id);
  const { error: forged } = await rival.client.from("quotes").insert({ dispatch_id: d1.id, company_id: rc.id, author_profile_id: rival.id, unit_price_ht: 1, currency: "USD", quantity: 1 });
  report("Concurrent : impossible de deposer un devis sur l'envoi d'un autre", Boolean(forged), forged?.code);
  const { data: buyerSees } = await buyer.client.from("quotes").select("id");
  report("Acheteur : ne voit aucun devis producteur", buyerSees?.length === 0);
  const { data: prodSeesRfq } = await producer.client.from("rfqs").select("id");
  report("Producteur : ne voit pas la demande brute", prodSeesRfq?.length === 0);

  // Le concurrent decline
  await loginAs(rival);
  await go(`/fr/requests/${d2.id}`, `return !!document.getElementById("q-price");`);
  await run(`[...document.querySelectorAll("main button[type=submit]")].find((b) => /décliner/i.test(b.textContent)).click(); return true;`);
  report("Declinee : message", await waitFor(`return location.search.includes("declined=1") && !document.getElementById("q-price");`));
  const { data: v3 } = await admin.from("rfq_dispatches").select("status").eq("id", d2.id).single();
  report("En base : envoi decline", v3.status === "declined");

  // Devis retenu : verrouille
  await admin.from("quotes").update({ status: "selected" }).eq("dispatch_id", d1.id);
  await loginAs(producer);
  await go(`/fr/requests/${d1.id}`);
  report("Devis retenu : formulaire ferme, message", await run(`return !document.getElementById("q-price") && document.body.innerText.includes("AFRICA NEX a retenu votre devis");`));
  await producer.client.from("quotes").update({ unit_price_ht: 1 }).eq("dispatch_id", d1.id);
  const { data: q3 } = await admin.from("quotes").select("unit_price_ht").eq("dispatch_id", d1.id).single();
  report("Base : devis retenu non modifiable par le producteur", Number(q3.unit_price_ht) === 4.7);

  // Console admin et arabe
  await loginAs(boss);
  await go(`/fr/admin/rfqs/${rfq.id}`);
  report("Console admin : devis resume sous le producteur", await run(`return document.body.innerText.replace(/\\s/g, " ").includes("Devis : 4,7 USD/L FOB");`));
  await loginAs(producer);
  await go(`/ar/requests`);
  report("Demandes recues en arabe (RTL)", await run(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("الطلبات الواردة");`));
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  const { data: ds } = await admin.from("rfq_dispatches").select("id, rfq_id, rfqs!inner(buyer_profile_id)").in("rfqs.buyer_profile_id", users);
  for (const d of ds ?? []) {
    const { data: files } = await admin.storage.from("rfq-files").list(`dispatch/${d.id}`);
    if (files?.length) await admin.storage.from("rfq-files").remove(files.map((f) => `dispatch/${d.id}/${f.name}`));
  }
  await admin.from("rfqs").delete().in("buyer_profile_id", users);
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  console.log("Nettoyage :", users.length, "comptes supprimes");
  await sleep(300);
  try { rmSync(`${OUT}/profile-rfqprod`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
