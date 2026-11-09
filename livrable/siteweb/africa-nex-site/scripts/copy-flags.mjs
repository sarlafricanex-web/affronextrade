// Copie dans public/flags les drapeaux (country-flag-icons, format 3x2) des pays connus de
// libphonenumber-js. A relancer apres une mise a jour de l'un des deux paquets : npm run flags
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCountries } from "libphonenumber-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules/country-flag-icons/3x2");
const target = path.join(root, "public/flags");

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

const available = new Set(readdirSync(source));
const missing = [];
for (const code of getCountries()) {
  if (available.has(`${code}.svg`)) copyFileSync(path.join(source, `${code}.svg`), path.join(target, `${code}.svg`));
  else missing.push(code);
}
console.log(`${getCountries().length - missing.length} drapeaux copies dans public/flags${missing.length ? ` ; sans drapeau : ${missing.join(" ")}` : ""}`);
