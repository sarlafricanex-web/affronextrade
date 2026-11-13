// Rejoue l'attaque de redirection dans un vrai navigateur : connexion via un lien piege, puis
import { site, OUT, CHROME } from "./_guard.mjs";
// controle de la page d'arrivee. Cree puis supprime un compte de test. N'affiche aucune cle.
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";


const require = createRequire(`${site}/package.json`);
const { createClient } = require("@supabase/supabase-js");



const BASE = `http://localhost:${process.argv[2] ?? 3000}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let failed = 0;
const report = (label, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "OK    " : "ECHEC "} ${label}${detail ? ` (${detail})` : ""}`);
};

const email = `test-redirect-${Date.now()}@example.com`;
const password = randomBytes(12).toString("base64url");
const { data: created, error } = await admin.auth.admin.createUser({
  email, password, email_confirm: true, user_metadata: { full_name: "Test Redirection", role: "buyer", locale: "fr", phone: "+213551234567" },
});
if (error) throw error;

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9335", `--user-data-dir=${OUT}/profile-redirect`, "--no-first-run",
  "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch("http://127.0.0.1:9335/json/list")).json()).find((t) => t.type === "page"); } catch {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const run = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });

  async function loginThrough(nextRaw) {
    await send("Network.clearBrowserCookies");
    await send("Page.navigate", { url: `${BASE}/fr/login?next=${nextRaw}` });
    await sleep(3500);
    await run(`(async () => {
      const setValue = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };
      setValue(document.getElementById("login-email"), ${JSON.stringify(email)});
      setValue(document.getElementById("login-password"), ${JSON.stringify(password)});
      await new Promise((r) => setTimeout(r, 150));
      document.querySelector("form button[type=submit]").click();
    })()`);
    let where = "";
    for (let i = 0; i < 24; i++) {
      await sleep(500);
      try { where = await run("location.href"); } catch { where = "(navigation en cours)"; }
      if (!where.includes("/fr/login")) break;
    }
    await sleep(800);
    try { where = await run("location.href"); } catch {}
    return where;
  }

  let where = await loginThrough("/%09/evil.example/session-expiree");
  report("Lien piege (tabulation) : la victime reste sur le site", where.startsWith(`${BASE}/fr/dashboard`), where);
  where = await loginThrough("%2F%2Fevil.example");
  report("Lien piege (double barre) : la victime reste sur le site", where.startsWith(`${BASE}/fr/dashboard`), where);
  where = await loginThrough("%2Ffr%2Fdashboard%3Fref%3Dok");
  report("Destination legitime conservee (/fr/dashboard?ref=ok)", where === `${BASE}/fr/dashboard?ref=ok`, where);
  ws.close();
} catch (e) {
  report("Execution du test", false, e.message);
} finally {
  chrome.kill();
  const { error: cleanup } = await admin.auth.admin.deleteUser(created.user.id);
  console.log(`Nettoyage : ${cleanup ? `ECHEC ${cleanup.message}` : "compte de test supprime"}`);
  await sleep(500);
  try { rmSync(`${OUT}/profile-redirect`, { recursive: true, force: true }); } catch {}
}
console.log(failed ? `\n${failed} echec(s)` : "\nTout est bon");
process.exit(failed ? 1 : 0);
