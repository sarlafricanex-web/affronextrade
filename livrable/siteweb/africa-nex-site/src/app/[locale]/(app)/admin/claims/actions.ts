"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";

// Decision sur une revendication. Les fonctions de la base verifient a nouveau le role admin
// et font tout le transfert en une seule transaction.
export async function decideClaim(formData: FormData) {
  const locale = resolveLocale(String(formData.get("locale") ?? ""));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["approve", "reject"].includes(decision)) redirect(`/${locale}/admin/claims`);

  const { error } = await user.supabase.rpc(decision === "approve" ? "approve_claim" : "reject_claim", { p_claim: id });
  if (error) {
    console.error("Claim decision failed:", error.message);
    const reason = /claimant_has_company/.test(error.message) ? "hasCompany" : /duplicate key|tax_id/.test(error.message) ? "nifTaken" : /claim_not_pending/.test(error.message) ? "notPending" : "generic";
    redirect(`/${locale}/admin/claims?error=${reason}`);
  }
  updateTag("producers"); // annuaire et fiche a jour (revendiquee ou de nouveau revendicable)
  redirect(`/${locale}/admin/claims?done=${decision}`);
}
