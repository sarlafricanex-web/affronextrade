// Donne le role admin a un compte deja inscrit sur la plateforme.
// Usage : node supabase/scripts/promote-admin.mjs email@exemple.com
// Lit NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY dans .env.local, sans les afficher.
// Le projet vise est celui de .env.local : verifier la reference affichee avant de continuer.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "package.json"));
const { loadEnvConfig } = require("@next/env");
const { createClient } = require("@supabase/supabase-js");
loadEnvConfig(root, true, { info: () => {}, error: console.error });

const email = process.argv[2]?.trim().toLowerCase();
if (!email?.includes("@")) {
  console.error("Usage : node supabase/scripts/promote-admin.mjs email@exemple.com");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY doivent etre definis dans .env.local");
  process.exit(1);
}

// La cle secrete passe le trigger de garde (is_privileged) : aucun compte ne peut se promouvoir lui-meme.
const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await admin
  .from("profiles")
  .update({ role: "admin" })
  .eq("email", email)
  .select("email, role");

const project = new URL(url).hostname.split(".")[0];
if (error) {
  console.error(`Echec sur le projet ${project} : ${error.message}`);
  process.exit(1);
}
if (!data.length) {
  console.error(`Aucun compte ${email} sur le projet ${project}. Inscrivez-vous d'abord sur /register.`);
  process.exit(1);
}
console.log(`${data[0].email} est administrateur sur le projet ${project}.`);
