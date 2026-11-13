// Test de bout en bout de la revendication de fiche (producteur, admin, regles de la base).
import { site, OUT, CHROME } from "./_guard.mjs";
// Les fiches Ifri et Cevital sont remises dans leur etat d'origine a la fin.
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
const PDF = `${OUT}/registre-test.pdf`, FAKE = `${OUT}/faux.pdf`;
writeFileSync(PDF, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
writeFileSync(FAKE, "ceci n'est pas un pdf");
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let failed = 0;
const report = (label, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "OK    " : "ECHEC "} ${label}${detail ? ` (${detail})` : ""}`); };
const users = [];
async function makeUser(role, name) {
  const email = `test-claim-${role}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role: role === "admin" ? "buyer" : role, locale: "fr", phone: "+213551234567" } });
  if (error) throw error;
  users.push(data.user.id);
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const jar = new Map();
  const client = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value: v }) => (v ? jar.set(n, v) : jar.delete(n))) } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, email, jar, client };
}
const cookieHeader = (u) => [...u.jar].map(([n, v]) => `${n}=${v}`).join("; ");

// Etat d'origine des deux fiches utilisees
const snap = {};
for (const slug of ["ifri", "cevital"]) {
  const { data: c } = await admin.from("companies").select("id, owner_profile_id, claim_status").eq("slug", slug).single();
  const { data: p } = await admin.from("company_private").select("tax_id, contact_email, contact_phone").eq("company_id", c.id).single();
  snap[slug] = { ...c, private: p };
}
// Remet les deux fiches dans leur etat d'origine (demandes, membres, proprietaire, partie privee).
async function restoreCards() {
  for (const slug of ["ifri", "cevital"]) {
    const s = snap[slug];
    await admin.from("company_claims").delete().eq("company_id", s.id).in("profile_id", users);
    await admin.from("company_members").delete().eq("company_id", s.id).in("profile_id", users);
    await admin.from("companies").update({ owner_profile_id: s.owner_profile_id, claim_status: s.claim_status }).eq("id", s.id);
    await admin.from("company_private").update(s.private).eq("company_id", s.id);
  }
}

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9343", `--user-data-dir=${OUT}/profile-claim`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
try {
  const alice = await makeUser("producer", "Alice Ifri");
  const bob = await makeUser("producer", "Bob Autre");
  const carl = await makeUser("producer", "Carl Cevital");
  const buyer = await makeUser("buyer", "Acheteur Test");
  const boss = await makeUser("admin", "Admin Test");
  await bob.client.from("companies").insert({ company_name: "Bob SARL", kind: "producer", slug: `bob-${Date.now()}`, owner_profile_id: bob.id, visibility: "draft" });

  // Regles de la base
  const { error: bobClaim } = await bob.client.from("company_claims").insert({ company_id: snap.cevital.id, profile_id: bob.id, tax_id: "1".repeat(15) });
  report("Base : un compte qui gere deja une entreprise ne peut pas revendiquer", Boolean(bobClaim), bobClaim?.code);
  const { error: buyerClaim } = await buyer.client.from("company_claims").insert({ company_id: snap.cevital.id, profile_id: buyer.id });
  report("Base : un acheteur ne peut pas revendiquer", Boolean(buyerClaim), buyerClaim?.code);
  const { error: aliceApproveSelf } = await alice.client.rpc("approve_claim", { p_claim: "00000000-0000-0000-0000-000000000000" });
  report("Base : un producteur ne peut pas approuver", /only AFRICA NEX/.test(aliceApproveSelf?.message ?? ""), aliceApproveSelf?.message);

  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9343/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const waitFor = async (cond, tries = 80) => { for (let i = 0; i < tries; i++) { await sleep(400); try { if (await run(cond)) return true; } catch {} } return false; };
  const loginAs = async (u) => { await send("Network.clearBrowserCookies"); if (u) for (const [n, v] of u.jar) await send("Network.setCookie", { name: n, value: v, url: BASE, path: "/" }); };
  const go = async (path, ready) => { await send("Page.navigate", { url: BASE + path }); await sleep(1200); await waitFor(ready ?? "return document.readyState === 'complete';"); };
  const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  const attach = async (file) => { const { root } = await send("DOM.getDocument"); const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[name=evidence]" }); await send("DOM.setFileInputFiles", { nodeId, files: [file.replace(/\//g, "\\")] }); };
  const SET = `const setV = (el, v) => { const p = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };`;
  const submit = `[...document.querySelectorAll("main button[type=submit]")].at(-1).click();`;
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("DOM.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1400, deviceScaleFactor: 1, mobile: false });

  // Parcours : fiche publique -> revendication
  await loginAs(null);
  await go("/fr/producers/ifri", `return !!document.getElementById("devis");`);
  report("Fiche Ifri : lien Revendiquez-la vers /fr/claim/ifri", await run(`return [...document.querySelectorAll("a")].some((a) => a.getAttribute("href") === "/fr/claim/ifri");`));
  await go("/fr/claim/ifri", `return location.pathname === "/fr/login";`);
  report("Deconnecte : renvoye a la connexion", await run(`return location.pathname === "/fr/login";`));

  await loginAs(buyer);
  await go("/fr/claim/ifri", `return !!document.querySelector("h1");`);
  report("Acheteur : message compte producteur requis", await run(`return document.body.innerText.includes("Compte producteur requis") && !document.getElementById("cl-nif");`));
  await loginAs(bob);
  await go("/fr/claim/ifri", `return !!document.querySelector("h1");`);
  report("Producteur avec entreprise : message explicite", await run(`return document.body.innerText.includes("Vous gérez déjà une entreprise") && document.body.innerText.includes("Bob SARL");`));

  await loginAs(alice);
  await go("/fr/onboarding", `return !!document.querySelector("h1");`);
  report("Configuration : rappel de chercher dans l'annuaire", await run(`return document.body.innerText.includes("Chercher dans l'annuaire");`));
  await go("/fr/claim/ifri", `return !!document.getElementById("cl-nif");`);
  report("Formulaire : titre et telephone pre-rempli", await run(`return document.querySelector("h1").textContent === "Revendiquer la fiche Ifri" && document.querySelector("input[name=phone]").value === "+213551234567";`));
  await run(`${SET} setV(document.getElementById("cl-nif"), "0001 2345 6789 0123 4567"); setV(document.getElementById("cl-job"), "Directeur export"); setV(document.getElementById("cl-email"), "export@ifri.dz"); document.querySelector("input[name=consent]").click(); ${submit} return true;`);
  report("Sans justificatif : erreur", await waitFor(`return document.body.innerText.includes("Joignez l'extrait du registre de commerce.");`));
  report("Saisie conservee", await run(`return document.getElementById("cl-nif").value === "00012345678901234567" && document.getElementById("cl-email").value === "export@ifri.dz";`));
  await attach(FAKE);
  await run(`document.querySelector("input[name=consent]").click(); ${submit} return true;`);
  report("Faux PDF refuse (contenu verifie)", await waitFor(`return document.body.innerText.includes("Format refusé");`));
  await attach(PDF);
  await run(`document.querySelector("input[name=consent]").click(); ${submit} return true;`);
  report("Demande envoyee : message et statut en cours", await waitFor(`return location.search.includes("sent=1") && document.body.innerText.includes("Demande en cours d'examen");`));
  await shot("claim-sent");
  const { data: claimA } = await admin.from("company_claims").select("id, status, tax_id, evidence_path").eq("profile_id", alice.id).single();
  report("Demande en base avec justificatif prive", claimA?.status === "pending" && claimA.tax_id === "00012345678901234567" && claimA.evidence_path.startsWith(`claims/${alice.id}/`));
  const { data: ifri1 } = await admin.from("companies").select("claim_status").eq("id", snap.ifri.id).single();
  report("Fiche Ifri passee en revendication en cours", ifri1.claim_status === "claim_pending");
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data: leak } = await anon.storage.from("company-documents").download(claimA.evidence_path);
  const { data: leakB } = await bob.client.storage.from("company-documents").download(claimA.evidence_path);
  report("Justificatif illisible par un visiteur et par un autre producteur", !leak && !leakB);
  await go("/fr/onboarding", `return !!document.querySelector("h1");`);
  report("Configuration : demande en cours signalee", await run(`return document.body.innerText.includes("Votre demande de revendication de Ifri est en cours");`));
  await loginAs(null);
  await go("/fr/producers/ifri", `return !!document.getElementById("devis");`);
  report("Fiche publique : bandeau revendication en cours", await run(`return document.body.innerText.includes("en cours de vérification") && ![...document.querySelectorAll("a")].some((a) => a.getAttribute("href") === "/fr/claim/ifri");`));

  // Justificatif : reserve a l'admin
  const evid = (u) => fetch(`${BASE}/api/admin/claims/${claimA.id}/evidence`, { headers: { cookie: cookieHeader(u) }, redirect: "manual" });
  const rA = await evid(alice), rB = await evid(boss);
  report("Lien du justificatif : refuse au producteur, lien signe pour l'admin", rA.status === 403 && rB.status === 303 && /token=/.test(rB.headers.get("location") ?? ""), `${rA.status} / ${rB.status}`);

  // Admin : approbation
  await loginAs(boss);
  await go("/fr/admin/claims", `return document.body.innerText.includes("Revendications");`);
  report("Console admin : lien Revendications et demande affichee", await run(`return [...document.querySelectorAll("aside a")].some((a) => a.getAttribute("href") === "/fr/admin/claims") && document.body.innerText.includes("Alice Ifri") && document.body.innerText.includes("00012345678901234567");`));
  await shot("admin-claims");
  await run(`window.confirm = () => true; [...document.querySelectorAll("button[value=approve]")].find((b) => b.closest("article").innerText.includes("Alice Ifri")).click(); return true;`);
  report("Approuvee : message", await waitFor(`return location.search.includes("done=approve");`));
  const { data: ifri2 } = await admin.from("companies").select("owner_profile_id, claim_status").eq("id", snap.ifri.id).single();
  const { data: mem } = await admin.from("company_members").select("role").eq("company_id", snap.ifri.id).eq("profile_id", alice.id).maybeSingle();
  const { data: priv } = await admin.from("company_private").select("tax_id").eq("company_id", snap.ifri.id).single();
  report("Fiche rattachee : proprietaire, statut, membre, NIF", ifri2.owner_profile_id === alice.id && ifri2.claim_status === "claimed" && mem?.role === "owner" && priv.tax_id === (snap.ifri.private.tax_id ?? "00012345678901234567"), JSON.stringify({ ...ifri2, mem, priv }));
  const { count: audit } = await admin.from("audit_log").select("id", { count: "exact", head: true }).eq("action", "claim.approve").eq("entity_id", snap.ifri.id);
  report("Decision tracee dans le journal", audit >= 1);

  await loginAs(alice);
  await go("/fr/company", `return !!document.querySelector("h1");`);
  report("Alice gere maintenant la fiche Ifri", await run(`return document.querySelector("h1")?.textContent === "Ifri · fiche producteur";`));
  await loginAs(null);
  await go("/fr/producers/ifri", `return !!document.getElementById("devis");`);
  report("Fiche publique : plus de bandeau de revendication", await run(`return !document.body.innerText.includes("Vous êtes cette entreprise ?") && !document.body.innerText.includes("en cours de vérification");`));

  // Refus
  const { error: carlErr } = await carl.client.from("company_claims").insert({ company_id: snap.cevital.id, profile_id: carl.id, tax_id: "9".repeat(15), work_email: "x@cevital.dz", job_title: "Test" });
  report("Carl revendique Cevital", !carlErr, carlErr?.message);
  const { data: claimC } = await admin.from("company_claims").select("id").eq("profile_id", carl.id).single();
  await loginAs(boss);
  await go("/fr/admin/claims", `return document.body.innerText.includes("Carl Cevital");`);
  await run(`window.confirm = () => true; [...document.querySelectorAll("button[value=reject]")].find((b) => b.closest("article").innerText.includes("Carl Cevital")).click(); return true;`);
  report("Refusee : message", await waitFor(`return location.search.includes("done=reject");`));
  const { data: cev } = await admin.from("companies").select("claim_status, owner_profile_id").eq("id", snap.cevital.id).single();
  const { data: cc } = await admin.from("company_claims").select("status").eq("id", claimC.id).single();
  report("Cevital de nouveau revendicable, demande refusee", cev.claim_status === "unclaimed" && cev.owner_profile_id === snap.cevital.owner_profile_id && cc.status === "rejected");
  await loginAs(carl);
  await go("/fr/claim/cevital", `return !!document.querySelector("h1");`);
  report("Carl voit le refus", await run(`return document.body.innerText.includes("Demande refusée");`));

  await loginAs(alice);
  await go("/ar/claim/ifri", `return !!document.querySelector("h1");`);
  report("Version arabe (RTL)", await run(`return document.documentElement.dir === "rtl" && document.body.innerText.includes("تمت المطالبة بالملف");`));

  // Remise en etat AVANT de fermer le navigateur, puis une vraie action admin pour vider le cache
  // public (sinon la fiche Ifri resterait affichee "revendiquee" jusqu'a la prochaine reconstruction).
  await restoreCards();
  await loginAs(boss);
  await go("/fr/admin/producers", `return !!document.querySelector("h1");`);
  await run(`const f = [...document.querySelectorAll("form")].find((x) => x.querySelector("input[name=id]")?.value === ${JSON.stringify(snap.ifri.id)} && x.querySelector("input[name=op]")); f.querySelector("input[name=op]").value = "publish"; f.requestSubmit(); return true;`);
  await waitFor(`return location.search.includes("done=publish");`);
  await loginAs(null);
  await go("/fr/producers/ifri", `return !!document.getElementById("devis");`);
  report("Nettoyage : fiche publique Ifri de nouveau revendicable (cache vide)", await run(`return [...document.querySelectorAll("a")].some((a) => a.getAttribute("href") === "/fr/claim/ifri");`));
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  // Remise en etat des deux fiches, puis suppression des comptes de test
  const { data: files } = await admin.from("company_claims").select("evidence_path").in("profile_id", users);
  const paths = (files ?? []).map((f) => f.evidence_path).filter(Boolean);
  if (paths.length) await admin.storage.from("company-documents").remove(paths);
  await restoreCards(); // sans effet si deja fait dans le test, indispensable si le test a echoue avant
  await admin.from("audit_log").delete().in("actor_profile_id", users);
  for (const uid of users) { await admin.from("companies").delete().eq("owner_profile_id", uid); await admin.auth.admin.deleteUser(uid); }
  const { data: check } = await admin.from("companies").select("slug, owner_profile_id, claim_status").in("slug", ["ifri", "cevital"]);
  console.log("Nettoyage :", users.length, "comptes supprimes ; fiches remises :", JSON.stringify(check));
  await sleep(500);
  try { rmSync(`${OUT}/profile-claim`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
