// Test de bout en bout du champ telephone (inscription + contact) dans un Chrome sans fenetre.
import { site, OUT, CHROME } from "./_guard.mjs";
// Usage : node phone-e2e.mjs <port>. Cree puis supprime un compte et un message de test. N'affiche aucune cle.
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";


const require = createRequire(`${site}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const { getExampleNumber } = require("libphonenumber-js");
const examples = require("libphonenumber-js/mobile/examples");



const BASE = `http://localhost:${process.argv[2] ?? 3000}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const example = (c) => getExampleNumber(c, examples.default ?? examples).nationalNumber;
const SN = example("SN"), CI = example("CI"), NG = example("NG");

let failed = 0;
const report = (label, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "OK    " : "ECHEC "} ${label}${detail !== "" ? ` (${detail})` : ""}`);
};

const stamp = Date.now();
const signupEmail = `test-phone-${stamp}@example.com`;
const contactEmail = `test-contact-${stamp}@example.com`;
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9334", `--user-data-dir=${OUT}/profile-phone`, "--no-first-run",
  "--no-default-browser-check", "--disable-extensions", "--window-size=480,900", "about:blank"], { stdio: "ignore" });

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch("http://127.0.0.1:9334/json/list")).json()).find((t) => t.type === "page"); } catch {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  const consoleErrors = [];
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      listeners.forEach((l) => l(msg));
      if (msg.method === "Runtime.exceptionThrown") consoleErrors.push(msg.params.exceptionDetails.exception?.description?.split("\n")[0]);
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") consoleErrors.push(String(msg.params.args[0]?.value ?? msg.params.args[0]?.description).split("\n")[0]);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const waitFor = (method) => new Promise((resolve) => {
    const l = (m) => { if (m.method === method) { listeners.delete(l); resolve(m.params); } };
    listeners.add(l);
  });
  const HELPERS = `
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setValue = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };
    const $ = (s) => document.querySelector(s);
    const field = (id) => document.getElementById(id).closest("div[dir=ltr]");
    const trigger = (id) => field(id).querySelector("button");
    const key = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    const popup = () => document.querySelector("[role=listbox]")?.closest("div.fixed");
    const options = () => [...document.querySelectorAll("[role=option]")];
    async function pick(id, query) {
      trigger(id).click(); await sleep(250);
      const search = popup().querySelector("input");
      setValue(search, query); await sleep(200);
      const first = options()[0]?.textContent;
      key(search, "Enter"); await sleep(200);
      return first;
    }
    async function typeNumber(id, value) {
      const input = document.getElementById(id);
      input.focus(); setValue(input, value); await sleep(100); input.blur(); await sleep(200);
      return { shown: input.value, error: !!document.getElementById(id + "-error"), code: trigger(id).textContent.trim() };
    }`;
  const run = async (body) => {
    const { result, exceptionDetails } = await send("Runtime.evaluate", { expression: `(async () => { ${HELPERS} ${body} })()`, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  const go = async (path) => {
    const loaded = waitFor("Page.loadEventFired");
    await send("Page.navigate", { url: BASE + path });
    await loaded;
    await sleep(2500);
  };
  const shoot = async (name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));

  await send("Emulation.setDeviceMetricsOverride", { width: 480, height: 900, deviceScaleFactor: 1, mobile: false });
  // Sans fenetre, Chrome n'emet pas les evenements de focus (quitter un champ) : on simule une page active.
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Page.enable");
  await send("Runtime.enable");

  // 1. Selecteur de pays sur l'inscription
  await go("/fr/register");
  let r = await run(`const b = trigger("register-phone"); return { code: b.textContent.trim(), flag: b.querySelector("img").getAttribute("src"), placeholder: document.getElementById("register-phone").placeholder };`);
  report("Algerie par defaut (+213, drapeau DZ)", r.code === "+213" && r.flag === "/flags/DZ.svg", `${r.code} ${r.flag}`);
  report("Exemple de numero algerien affiche", Boolean(r.placeholder), r.placeholder);
  r = await run(`trigger("register-phone").click(); await sleep(300);
    document.getElementById("register-phone").closest("div[dir=ltr]").scrollIntoView({ block: "start" });
    return { count: options().length, groups: [...popup().querySelectorAll("li[role=presentation]")].map((l) => l.textContent),
      firsts: options().slice(0, 9).map((o) => o.textContent), focusOnSearch: document.activeElement === popup().querySelector("input") };`);
  report("Liste : 9 suggestions + 245 pays", r.count === 254, `${r.count} options`);
  report("Suggestions en tete : Algerie et les 8 marches", /Alg/.test(r.firsts[0]) && /Nigeria/.test(r.firsts[1]) && /centrafricaine/i.test(r.firsts[8]), r.firsts.map((f) => f.split("+")[0]).join(", "));
  report("Curseur dans la recherche a l'ouverture", r.focusOnSearch);
  await shoot("phone-liste-fr");
  r = await run(`const s = popup().querySelector("input"); key(s, "Escape"); await sleep(200); return { closed: !popup(), focusBack: document.activeElement === trigger("register-phone") };`);
  report("Echap ferme la liste et rend le focus au bouton", r.closed && r.focusBack);

  r = await run(`const first = await pick("register-phone", "sene"); return { first, code: trigger("register-phone").textContent.trim() };`);
  report("Recherche sans accent \"sene\" -> Senegal", /S.n.gal/.test(r.first) && r.code === "+221", `${r.first} -> ${r.code}`);
  r = await run(`return await typeNumber("register-phone", "${SN}");`);
  report("Numero senegalais valide, mis en forme", !r.error && r.shown.replace(/\s/g, "") === SN && r.shown.includes(" "), `"${r.shown}"`);
  r = await run(`return await typeNumber("register-phone", "12");`);
  report("Numero trop court signale en rouge", r.error, `"${r.shown}"`);
  r = await run(`return await typeNumber("register-phone", "+234 ${NG}");`);
  report("Numero colle au format international : le pays suit (+234)", r.code === "+234" && !r.error, `${r.code} "${r.shown}"`);
  r = await run(`const first = await pick("register-phone", "+225"); return { first, code: trigger("register-phone").textContent.trim() };`);
  report("Recherche par indicatif \"+225\" -> Cote d'Ivoire", /Ivoire/.test(r.first) && r.code === "+225", `${r.first} -> ${r.code}`);
  r = await run(`trigger("register-phone").click(); await sleep(250); const s = popup().querySelector("input");
    key(s, "Home"); await sleep(50); key(s, "ArrowDown"); await sleep(50); key(s, "ArrowDown"); await sleep(50); key(s, "Enter"); await sleep(200);
    return trigger("register-phone").textContent.trim();`);
  report("Clavier : Debut, Bas, Bas, Entree -> 3e suggestion (Cote d'Ivoire)", r === "+225", r);

  // 2. Arabe : liste en arabe, de droite a gauche ; numero de gauche a droite
  await go("/ar/register");
  r = await run(`trigger("register-phone").click(); await sleep(300);
    document.getElementById("register-phone").closest("div[dir=ltr]").scrollIntoView({ block: "start" });
    return { first: options()[0].textContent, dir: popup().getAttribute("dir"), fieldDir: field("register-phone").getAttribute("dir") };`);
  report("Liste en arabe, de droite a gauche", /الجزائر/.test(r.first) && r.dir === "rtl" && r.fieldDir === "ltr", `${r.first} | liste ${r.dir}, champ ${r.fieldDir}`);
  await shoot("phone-liste-ar");
  r = await run(`key(popup().querySelector("input"), "Escape"); await sleep(200);
    const first = await pick("register-phone", "senegal"); return { first, code: trigger("register-phone").textContent.trim() };`);
  report("En arabe, recherche en lettres latines \"senegal\"", /السنغال/.test(r.first) && r.code === "+221", `${r.first} -> ${r.code}`);

  // 3. Inscription par le formulaire : refusee sans telephone, acceptee avec un numero senegalais
  await go("/fr/register");
  const password = randomBytes(12).toString("base64url");
  r = await run(`
    [...document.querySelectorAll("button")].find((b) => /acheteur/i.test(b.textContent)).click(); await sleep(100);
    setValue(document.getElementById("register-name"), "Test Téléphone");
    setValue(document.getElementById("register-email"), "${signupEmail}");
    setValue(document.getElementById("register-password"), "${password}");
    setValue(document.getElementById("register-confirm"), "${password}");
    document.getElementById("register-consent").click(); await sleep(100);
    document.querySelector("form button[type=submit]").click(); await sleep(800);
    return { path: location.pathname, error: document.getElementById("register-phone-error")?.textContent ?? null,
      focus: document.activeElement?.id === "register-phone" };`);
  const { data: early } = await admin.from("profiles").select("id").eq("email", signupEmail);
  report("Inscription sans telephone refusee, message et curseur sur le champ", r.path === "/fr/register" && /obligatoire/.test(r.error ?? "") && r.focus && early?.length === 0,
    `${r.error} | curseur ${r.focus ? "oui" : "non"} | comptes ${early?.length}`);
  r = await run(`
    await pick("register-phone", "senegal");
    await typeNumber("register-phone", "${SN}");
    document.querySelector("form button[type=submit]").click();
    return true;`);
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    if (await run(`return location.pathname === "/fr/dashboard" && document.body.innerText.includes("Bonjour Test");`)) break;
  }
  r = await run(`return { path: location.pathname, text: document.body.innerText.includes("Bonjour Test") };`);
  report("Inscription par le formulaire -> tableau de bord", r.path === "/fr/dashboard" && r.text, r.path);
  const { data: profile } = await admin.from("profiles").select("phone, role").eq("email", signupEmail).maybeSingle();
  report("Profil : telephone enregistre au format international", profile?.phone === `+221${SN}` && profile?.role === "buyer", JSON.stringify(profile));

  // 4. Formulaire de contact : pays choisi dans la liste, indicatif propose aux deux numeros
  await send("Network.clearBrowserCookies");
  await go("/fr/contact");
  r = await run(`
    const form = document.querySelector("form");
    const hidden = (n) => form.querySelector("input[type=hidden][name=" + n + "]").value;
    const code = (id) => trigger(id).textContent.trim();
    async function chooseCountry(query) {
      document.getElementById("contact-country").click(); await sleep(250);
      const search = popup().querySelector("input");
      const hasDial = options()[0]?.textContent.includes("+");
      setValue(search, query); await sleep(200);
      key(search, "Enter"); await sleep(250);
      return hasDial;
    }
    form.querySelector("[name=name]").value = "Contact Téléphone";
    form.querySelector("[name=email]").value = "${contactEmail}";
    form.querySelector("[name=consent]").click();
    const placeholder = document.getElementById("contact-country").textContent.trim();
    const listHasDial = await chooseCountry("senegal");
    const afterSenegal = { label: document.getElementById("contact-country").textContent.trim(), country: hidden("country"),
      phone: code("contact-phone"), whatsapp: code("contact-whatsapp") };
    await typeNumber("contact-phone", "12");
    const blocked = !form.checkValidity();
    form.requestSubmit(); await sleep(400);
    const stillForm = !!document.querySelector("form");
    await typeNumber("contact-phone", "${SN}");
    await chooseCountry("ivoire");
    const afterIvoire = { country: hidden("country"), phone: code("contact-phone"), whatsapp: code("contact-whatsapp") };
    await typeNumber("contact-whatsapp", "+234${NG}");
    const sent = { country: hidden("country"), phone: hidden("phone"), whatsapp: hidden("whatsapp") };
    form.requestSubmit();
    return { placeholder, listHasDial, afterSenegal, afterIvoire, blocked, stillForm, sent };`);
  report("Contact : champ Pays vide au depart, liste sans indicatifs", /Choisir/.test(r.placeholder) && r.listHasDial === false, r.placeholder);
  report("Contact : Senegal choisi -> code SN, +221 propose au telephone et a WhatsApp",
    /S.n.gal/.test(r.afterSenegal.label) && r.afterSenegal.country === "SN" && r.afterSenegal.phone === "+221" && r.afterSenegal.whatsapp === "+221", JSON.stringify(r.afterSenegal));
  report("Contact : numero invalide bloque l'envoi", r.blocked && r.stillForm);
  report("Contact : numero saisi -> son indicatif reste fige, le champ vide suit le nouveau pays",
    r.afterIvoire.country === "CI" && r.afterIvoire.phone === "+221" && r.afterIvoire.whatsapp === "+225", JSON.stringify(r.afterIvoire));
  report("Contact : valeurs envoyees (code pays et numeros internationaux)",
    r.sent.country === "CI" && r.sent.phone === `+221${SN}` && r.sent.whatsapp === `+234${NG}`, JSON.stringify(r.sent));
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    if (await run(`return document.body.innerText.includes("Message envoy");`)) break;
  }
  report("Contact : message envoye", await run(`return document.body.innerText.includes("Message envoy");`));
  const { data: sub } = await admin.from("submissions").select("country, phone, whatsapp").eq("email", contactEmail).maybeSingle();
  report("Contact : enregistre en base (code pays, numeros internationaux)",
    sub?.country === "CI" && sub?.phone === `+221${SN}` && sub?.whatsapp === `+234${NG}`, JSON.stringify(sub));

  const post = (body) => fetch(`${BASE}/api/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let r400 = await post({ name: "Test", email: contactEmail, phone: "+2131" });
  report("API : numero invalide refuse cote serveur", r400.status === 400, `HTTP ${r400.status}`);
  r400 = await post({ name: "Test", email: contactEmail, country: "XX" });
  report("API : code pays inconnu refuse cote serveur", r400.status === 400, `HTTP ${r400.status}`);

  const unexpected = [...new Set(consoleErrors)].filter((e) => e && !/generateMetadata|URL data/.test(e));
  report("Aucune erreur dans la console du navigateur", unexpected.length === 0, unexpected.join(" | "));
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const created = users?.users?.filter((u) => u.email === signupEmail) ?? [];
  for (const u of created) await admin.auth.admin.deleteUser(u.id);
  await admin.from("submissions").delete().eq("email", contactEmail);
  const { count } = await admin.from("submissions").select("*", { count: "exact", head: true }).eq("email", contactEmail);
  console.log(`Nettoyage : ${created.length} compte(s) et ${count === 0 ? "message(s)" : "MESSAGES RESTANTS"} de test supprimes`);
  await sleep(500);
  try { rmSync(`${OUT}/profile-phone`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
