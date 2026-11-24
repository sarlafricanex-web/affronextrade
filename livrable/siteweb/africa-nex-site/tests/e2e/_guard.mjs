// Garde-fou commun aux tests de bout en bout : charge .env.local et REFUSE de tourner
// ailleurs que sur la base de developpement africanex-dev.
// Ces tests creent et suppriment des comptes avec la cle secrete Supabase : jamais en production.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

export const site = fileURLToPath(new URL("../../", import.meta.url)).replace(/\\/g, "/").replace(/\/$/, "");
export const OUT = `${site}/tests/e2e/.output`;
// Passeport (gratuit) : un envoi n'est visible du producteur que 48 h apres (migration 39). Les tests
// qui ne portent pas sur ce delai ouvrent tout de suite les envois de leurs producteurs (cle secrete).
export const openDispatches = async (admin, ids) => {
  const { error } = await admin.from("rfq_dispatches").update({ visible_from: new Date(Date.now() - 1000).toISOString() }).in("id", ids.filter(Boolean));
  if (error) throw error;
};
export const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

// Reference publique du projet Supabase de developpement (elle figure dans l'URL du projet).
const DEV_PROJECT_REF = "wjvfpfopksceljnqxuho";

const require = createRequire(`${site}/package.json`);
require("@next/env").loadEnvConfig(site, true, { info: () => {}, error: console.error });
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://absent").hostname.split(".")[0];
if (ref !== DEV_PROJECT_REF) {
  console.error(`ARRET : ces tests ne tournent que sur africanex-dev (projet trouve : ${ref}).`);
  process.exit(1);
}
if (!process.env.SUPABASE_SECRET_KEY) {
  console.error("ARRET : SUPABASE_SECRET_KEY absente de .env.local.");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
