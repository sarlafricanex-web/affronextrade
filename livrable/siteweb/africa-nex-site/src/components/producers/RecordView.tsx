import { headers } from "next/headers";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i;

// Compte une consultation de fiche, pays du visiteur compris (en-tete geographique Vercel).
// Ecrit apres l'envoi de la page : n'ajoute aucune attente pour le visiteur. Rien n'est affiche.
export async function RecordView({ companyId, locale }: { companyId: string; locale: string }) {
  const h = await headers();
  if (BOT.test(h.get("user-agent") ?? "") || h.get("purpose") === "prefetch" || h.get("next-router-prefetch")) return null;
  const country = (h.get("x-vercel-ip-country") ?? "").toUpperCase();
  after(async () => {
    const { error } = await createAdminClient()
      .from("profile_views")
      .insert({ company_id: companyId, locale, viewer_country: /^[A-Z]{2}$/.test(country) ? country : null });
    if (error) console.error("Profile view insert failed:", error.message);
  });
  return null;
}
