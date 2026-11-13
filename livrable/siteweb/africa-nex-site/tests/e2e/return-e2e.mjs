// Parcours sans compte : revendication et demande de devis -> connexion -> inscription -> retour.
import { site, OUT, CHROME } from "./_guard.mjs";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";


const require = createRequire(`${site}/package.json`);
const { createClient } = require("@supabase/supabase-js");

const BASE = `http://localhost:${process.argv[2] ?? 3000}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
let failed = 0;
const report = (label, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "OK    " : "ECHEC "} ${label}${detail ? ` (${detail})` : ""}`); };
const emails = [];

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9352", `--user-data-dir=${OUT}/profile-return`, "--no-first-run", "--disable-extensions", "about:blank"], { stdio: "ignore" });
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch("http://127.0.0.1:9352/json/list")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async (body) => { const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const waitFor = async (cond, tries = 80) => { for (let i = 0; i < tries; i++) { await sleep(400); try { if (await run(cond)) return true; } catch {} } return false; };
  const go = async (path, ready) => { await send("Page.navigate", { url: BASE + path }); await sleep(1000); await waitFor(ready ?? "return document.readyState === 'complete';"); };
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  const SET = `const setV = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };`;
  const signUp = async (email) => {
    await run(`${SET}
      setV(document.getElementById("register-name"), "Test Retour");
      setV(document.getElementById("register-email"), ${JSON.stringify(email)});
      setV(document.getElementById("register-password"), "Retour-Test-2026!");
      setV(document.getElementById("register-confirm"), "Retour-Test-2026!");
      setV(document.getElementById("register-phone"), "0551234567");
      document.getElementById("register-consent").click(); return true;`);
    await sleep(300);
    await run(`document.querySelector("form button[type=submit]").click(); return true;`);
  };
  const pressedRole = `return [...document.querySelectorAll("button[aria-pressed=true]")].map((b) => b.innerText.split("\\n")[0]).join();`;

  // 1. Revendication sans compte
  await send("Network.clearBrowserCookies");
  await go("/fr/claim/cevital", `return location.pathname === "/fr/login";`);
  report("Revendication sans compte : connexion avec adresse de retour", await run(`return location.search.includes("next=%2Ffr%2Fclaim%2Fcevital");`));
  await run(`[...document.querySelectorAll("a")].find((a) => a.getAttribute("href")?.startsWith("/fr/register")).click(); return true;`);
  await waitFor(`return location.pathname === "/fr/register" && !!document.getElementById("register-name");`);
  report("Créer un compte : adresse de retour conservee", await run(`return new URLSearchParams(location.search).get("next") === "/fr/claim/cevital";`));
  report("Role Producteur preselectionne", /producteur/i.test(await run(pressedRole)), await run(pressedRole));
  const e1 = `test-return-p-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`; emails.push(e1);
  await signUp(e1);
  report("Apres inscription : retour sur la revendication", await waitFor(`return location.pathname === "/fr/claim/cevital" && !!document.getElementById("cl-nif");`), await run(`return location.pathname;`));

  // 2. Demande de devis sans compte
  await send("Network.clearBrowserCookies");
  await go("/fr/producers/cevital", `return !!document.getElementById("devis");`);
  await run(`document.querySelector("#devis a[href*='/register']").click(); return true;`);
  await waitFor(`return location.pathname === "/fr/register" && !!document.getElementById("register-name");`);
  report("Demander un devis : role Acheteur preselectionne", /acheteur/i.test(await run(pressedRole)), await run(pressedRole));
  const e2 = `test-return-b-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`; emails.push(e2);
  await signUp(e2);
  report("Apres inscription : retour sur la fiche", await waitFor(`return location.pathname === "/fr/producers/cevital";`), await run(`return location.pathname;`));
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const buyer = list.users.find((u) => u.email === e2);
  const { data: prof } = buyer ? await admin.from("profiles").select("role").eq("id", buyer.id).single() : { data: null };
  report("Compte cree en acheteur", prof?.role === "buyer", prof?.role);

  // 3. Avis : connexion depuis une fiche -> inscription proposee en acheteur
  await send("Network.clearBrowserCookies");
  await go("/fr/login?next=%2Ffr%2Fproducers%2Fcevital", `return !!document.getElementById("login-email");`);
  report("Connexion depuis une fiche : lien d'inscription en acheteur", await run(`const h = [...document.querySelectorAll("a")].find((a) => a.getAttribute("href")?.startsWith("/fr/register"))?.getAttribute("href") ?? ""; return h.includes("role=buyer") && h.includes("next=%2Ffr%2Fproducers%2Fcevital");`));
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of list.users.filter((x) => emails.includes(x.email))) await admin.auth.admin.deleteUser(u.id);
  console.log(`Nettoyage : ${emails.length} comptes de test supprimes`);
  await sleep(300);
  try { rmSync(`${OUT}/profile-return`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
