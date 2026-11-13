// Lance les tests de bout en bout les uns apres les autres et affiche un bilan.
// Usage : node tests/e2e/run-all.mjs            (toutes les suites)
//         node tests/e2e/run-all.mjs claim company   (seulement celles-ci)
// Prerequis : apercu local demarre sur le port 3000 (npm run build puis npx next start -p 3000).
import "./_guard.mjs";
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const wanted = process.argv.slice(2);
const suites = readdirSync(dir)
  .filter((f) => f.endsWith("-e2e.mjs"))
  .map((f) => f.replace(/-e2e\.mjs$/, ""))
  .filter((name) => !wanted.length || wanted.includes(name));

try {
  await fetch("http://localhost:3000/fr");
} catch {
  console.error("ARRET : aucun apercu sur http://localhost:3000. Lancez d'abord : npx next start -p 3000");
  process.exit(1);
}

const results = [];
for (const name of suites) {
  const t0 = Date.now();
  process.stdout.write(`${name.padEnd(18)} `);
  const run = spawnSync(process.execPath, [`${dir}/${name}-e2e.mjs`, "3000"], { encoding: "utf8", maxBuffer: 1 << 24 });
  const out = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  const failures = out.split("\n").filter((l) => l.startsWith("ECHEC"));
  const ok = run.status === 0 && /Tout est bon/.test(out);
  results.push({ name, ok, failures });
  console.log(`${ok ? "OK" : "ECHEC"} (${Math.round((Date.now() - t0) / 1000)} s)`);
  for (const f of failures) console.log(`   ${f}`);
}
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} suites reussies${bad.length ? ` ; en echec : ${bad.map((r) => r.name).join(", ")}` : ""}`);
process.exit(bad.length ? 1 : 0);
