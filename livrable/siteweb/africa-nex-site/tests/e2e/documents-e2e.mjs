// Test de bout en bout des documents d'entreprise : reduction des photos, depot, verification, affichage public.
import { site, OUT, CHROME } from "./_guard.mjs";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, statSync } from "node:fs";


const require = createRequire(`${site}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");



const BASE = `http://localhost:${process.argv[2] ?? 3000}`;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const BIG_JPG = `${OUT}/photo-certificat.jpg`, PDF = `${OUT}/registre.pdf`, BIG_PDF = `${OUT}/gros.pdf`, FAKE = `${OUT}/faux.pdf`;
writeFileSync(PDF, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
writeFileSync(BIG_PDF, Buffer.concat([Buffer.from("%PDF-1.4\n"), randomBytes(5 * 1024 * 1024)]));
writeFileSync(FAKE, "pas un pdf");
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let failed = 0;
const report = (label, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "OK    " : "ECHEC "} ${label}${detail ? ` (${detail})` : ""}`); };
const users = [];
async function makeUser(role, name) {
  const email = `test-doc-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role: role === "admin" ? "buyer" : role, locale: "fr" } });
  if (error) throw error;
  users.push(data.user.id);
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const jar = new Map();
  const client = createServerClient(url, pub, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value: v }) => (v ? jar.set(n, v) : jar.delete(n))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, jar, client };
}
const cookie = (u) => (u ? [...u.jar].map(([n, v]) => `${n}=${v}`).join("; ") : "");
const openDoc = (id, u) => fetch(`${BASE}/api/documents/${id}`, { headers: { cookie: cookie(u) }, redirect: "manual" }).then((r) => r.status);

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9346", `--user-data-dir=${OUT}/profile-docs`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
let companyId;
try {
  const producer = await makeUser("producer", "Producteur Docs");
  const rival = await makeUser("producer", "Concurrent Docs");
  const boss = await makeUser("admin", "Admin Docs");
  await producer.client.from("companies").insert({ company_name: "Conserverie Docs Test", kind: "producer", slug: `conserverie-docs-${Date.now()}`, owner_profile_id: producer.id, visibility: "draft", sector: "C10", wilaya: "19", city: "Setif" });
  ({ data: { id: companyId } } = await admin.from("companies").select("id").eq("owner_profile_id", producer.id).single());

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9346/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const waitFor = async (cond, tries = 80) => { for (let i = 0; i < tries; i++) { await sleep(300); try { if (await run(cond)) return true; } catch {} } return false; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); if (u) for (const [k, v] of u.jar) await send("Network.setCookie", { name: k, value: v, url: BASE, path: "/" }); };
  const go = async (path, ready) => { await send("Page.navigate", { url: BASE + path }); await sleep(800); await waitFor(ready ?? "return document.readyState === 'complete';"); };
  const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  const attach = async (file) => { const { root } = await send("DOM.getDocument"); const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[type=file][name=file]" }); await send("DOM.setFileInputFiles", { nodeId, files: [file.replace(/\//g, "\\")] }); };
  const SET = `const setV = (el, v) => { const p = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };`;
  const submit = `document.getElementById("doc-kind").form.querySelector("button[type=submit]").click();`;
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("DOM.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1400, deviceScaleFactor: 1, mobile: false });

  // Grosse photo "de telephone" (4000 x 3000, bruit) generee par Chrome
  await send("Page.navigate", { url: "about:blank" }); await sleep(300);
  const b64 = await run(`const c = document.createElement("canvas"); c.width = 4000; c.height = 3000; const x = c.getContext("2d"); const img = x.createImageData(4000, 3000); for (let i = 0; i < img.data.length; i += 4) { const v = (Math.random() * 255) | 0; img.data[i] = v; img.data[i + 1] = (v * 7) & 255; img.data[i + 2] = (v * 13) & 255; img.data[i + 3] = 255; } x.putImageData(img, 0, 0); x.fillStyle = "#000"; x.font = "200px sans-serif"; x.fillText("CERTIFICAT ISO 22000", 300, 1500); const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.95)); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode(...buf.subarray(i, i + 32768)); return btoa(s);`);
  writeFileSync(BIG_JPG, Buffer.from(b64, "base64"));
  const bigSize = statSync(BIG_JPG).size;
  report("Photo de test plus lourde que la limite de 4 Mo", bigSize > 4 * 1024 * 1024, `${(bigSize / 1048576).toFixed(1)} Mo`);

  await loginAs(producer);
  await go("/fr/company?tab=documents", `return !!document.getElementById("doc-kind");`);
  report("Carte Documents dans Mon entreprise", await run(`return document.body.innerText.includes("Documents et certifications") && document.body.innerText.includes("Aucun document");`));
  // Photo lourde : reduite dans le navigateur avant l'envoi
  await run(`${SET} setV(document.getElementById("doc-kind"), "iso"); setV(document.getElementById("doc-title"), "ISO 22000:2018"); setV(document.getElementById("doc-expires"), "2028-06-30"); document.querySelector("input[name=isPublic]").click(); return true;`);
  await attach(BIG_JPG);
  const reducedOk = await waitFor(`return /photo réduite de .* à /.test(document.body.innerText);`);
  report("Photo reduite automatiquement avant l'envoi", reducedOk, reducedOk ? await run(`return document.body.innerText.match(/photo réduite de [^\\n]*/)[0];`) : "");
  await run(`${submit} return true;`);
  report("Envoi : message de confirmation", await waitFor(`return location.search.includes("doc=added") && document.body.innerText.includes("Document envoyé");`));
  // Registre de commerce en PDF, prive
  await run(`${SET} setV(document.getElementById("doc-kind"), "registration"); return true;`);
  await attach(PDF);
  await sleep(300);
  await run(`${submit} return true;`);
  await waitFor(`return document.querySelectorAll("main li").length >= 2;`);
  // PDF trop lourd : refuse dans le navigateur ; faux PDF : refuse par le serveur
  await run(`${SET} setV(document.getElementById("doc-kind"), "other"); return true;`);
  await attach(BIG_PDF);
  report("PDF de plus de 4 Mo : refuse avant l'envoi", await waitFor(`return document.body.innerText.includes("Fichier trop lourd");`));
  await go("/fr/company?tab=documents", `return !!document.getElementById("doc-kind");`);
  await run(`${SET} setV(document.getElementById("doc-kind"), "other"); return true;`);
  await attach(FAKE);
  await sleep(500);
  await run(`${submit} return true;`);
  const fakeOk = await waitFor(`return document.body.innerText.includes("Format refusé");`);
  report("Faux PDF : refuse par le serveur", fakeOk, fakeOk ? "" : await run(`return location.search + " | " + [...document.querySelectorAll("[role=alert]")].map((e) => e.innerText).join(" / ") + " | fichier=" + (document.querySelector("input[name=file]").files[0]?.name ?? "aucun") + " | valide=" + document.getElementById("doc-kind").form.checkValidity();`));
  await shot("documents-producer");

  const { data: docs } = await admin.from("company_documents").select("id, kind, is_public, review_status, file_type, storage_path, expires_on").eq("company_id", companyId);
  const iso = docs.find((d) => d.kind === "iso"), reg = docs.find((d) => d.kind === "registration");
  report("En base : 2 documents a verifier", docs.length === 2 && docs.every((d) => d.review_status === "pending"));
  report("ISO : public, JPEG, expiration", iso?.is_public && iso.file_type === "jpg" && iso.expires_on === "2028-06-30");
  const { data: files } = await admin.storage.from("company-documents").list(`${companyId}/docs`);
  const isoFile = files?.find((f) => iso && iso.storage_path.endsWith(f.name));
  report("Fichier stocke sous 4 Mo", isoFile && isoFile.metadata.size < 4 * 1024 * 1024, isoFile ? `${(isoFile.metadata.size / 1048576).toFixed(2)} Mo` : "absent");
  // Bandeau du profil (structure Europages) : seuls les elements manquants sont listes.
  await go("/fr/company", `return !!document.querySelector(".profile-missing");`);
  report("Completion : registre de commerce n'est plus a completer", await run(`return ![...document.querySelectorAll(".profile-missing li")].some((li) => /Registre de commerce/.test(li.textContent));`), await run(`return [...document.querySelectorAll(".profile-missing li")].map((li) => li.textContent).join(" / ");`));

  // Regles de la base
  const forged = await producer.client.from("company_documents").insert({ company_id: companyId, kind: "halal", storage_path: `${companyId}/docs/x.pdf`, review_status: "accepted", is_public: true });
  report("Base : un producteur ne peut pas se valider un document", Boolean(forged.error), forged.error?.code);
  const selfOk = await producer.client.from("company_documents").update({ review_status: "accepted" }).eq("id", iso.id).select("id");
  report("Base : ni le modifier en verifie", (selfOk.data ?? []).length === 0);
  const { data: rivalSees } = await rival.client.from("company_documents").select("id").eq("company_id", companyId);
  report("Base : un concurrent ne voit pas les documents", rivalSees.length === 0);
  report("Ouverture : proprietaire oui, concurrent et visiteur non", (await openDoc(iso.id, producer)) === 303 && (await openDoc(iso.id, rival)) === 404 && (await openDoc(iso.id, null)) === 404);

  // Verification par l'admin
  await loginAs(boss);
  await go("/fr/admin/producers", `return document.body.innerText.includes("Conserverie Docs Test");`);
  report("Console : 2 documents a verifier signales", await run(`return document.body.innerText.includes("2 documents à vérifier");`));
  await go(`/fr/admin/producers/${companyId}`, `return document.body.innerText.includes("2 documents");`);
  report("Admin ouvre le document", (await openDoc(iso.id, boss)) === 303);
  await run(`[...document.querySelectorAll("aside li")].find((li) => li.innerText.includes("ISO 22000")).querySelector("input[value=acceptDoc]").form.querySelector("button").click(); return true;`);
  await waitFor(`return location.search.includes("done=acceptDoc");`);
  await run(`[...document.querySelectorAll("aside li")].find((li) => li.innerText.includes("Registre de commerce")).querySelector("input[value=rejectDoc]").form.querySelector("button").click(); return true;`);
  await waitFor(`return location.search.includes("done=rejectDoc");`);
  const { data: after } = await admin.from("company_documents").select("kind, review_status, reviewed_by").eq("company_id", companyId);
  report("Decisions enregistrees (ISO valide, registre refuse)", after.find((d) => d.kind === "iso")?.review_status === "accepted" && after.find((d) => d.kind === "registration")?.review_status === "rejected" && after.every((d) => d.reviewed_by === boss.id));
  await shot("documents-admin");

  // Fiche publique (une fois en ligne)
  await go(`/fr/admin/producers/${companyId}`, `return !!document.querySelector("input[value=publish]");`);
  await run(`document.querySelector("input[name=op][value=publish]").form.querySelector("button").click(); return true;`);
  await waitFor(`return location.search.includes("done=publish");`);
  const { data: comp } = await admin.from("companies").select("slug").eq("id", companyId).single();
  await loginAs(null);
  await go(`/fr/producers/${comp.slug}`, `return !!document.getElementById("devis");`);
  report("Fiche publique : document verifie affiche, registre absent", await run(`const t = document.body.innerText.toLowerCase(); return t.includes("certifications et conformité") && t.includes("iso 22000:2018") && t.includes("valable jusqu'au") && !t.includes("registre de commerce");`));
  report("Visiteur : ouvre le document public verifie, pas le registre", (await openDoc(iso.id, null)) === 303 && (await openDoc(reg.id, null)) === 404);
  await shot("documents-public");

  // Suppression par le producteur
  await loginAs(producer);
  await go("/fr/company?tab=documents", `return document.querySelectorAll("main li").length >= 2;`);
  await run(`[...document.querySelectorAll("main li")].find((li) => li.innerText.includes("ISO 22000") && li.querySelector("button")).querySelector("button").click(); return true;`);
  report("Suppression : message", await waitFor(`return location.search.includes("doc=deleted");`));
  const { data: left } = await admin.storage.from("company-documents").list(`${companyId}/docs`);
  report("Fichier supprime du stockage", !left?.some((f) => iso.storage_path.endsWith(f.name)));
  await loginAs(null);
  await go(`/fr/producers/${comp.slug}`, `return !!document.getElementById("devis");`);
  report("Fiche publique : document retire", await run(`return !document.body.innerText.includes("ISO 22000:2018");`));
  await loginAs(producer);
  await go("/ar/company?tab=documents", `return !!document.getElementById("doc-kind");`);
  report("Carte en arabe (RTL)", await run(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("الوثائق والشهادات");`));
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  if (companyId) {
    const { data: f } = await admin.storage.from("company-documents").list(`${companyId}/docs`);
    if (f?.length) await admin.storage.from("company-documents").remove(f.map((x) => `${companyId}/docs/${x.name}`));
  }
  await admin.from("audit_log").delete().in("actor_profile_id", users);
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  console.log(`Nettoyage : ${users.length} comptes, entreprise et fichiers supprimes`);
  await sleep(500);
  try { rmSync(`${OUT}/profile-docs`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
