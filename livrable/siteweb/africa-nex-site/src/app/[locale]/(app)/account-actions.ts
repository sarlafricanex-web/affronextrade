"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";

// Suppression de compte (audit legal, correction 3) : l'utilisateur la demande depuis son espace,
// AFRICA NEX la traite sous un mois (politique de confidentialite, section 6).

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;

export async function requestAccountDeletion(formData: FormData) {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role === "admin") redirect(`/${locale}/dashboard`);
  if (formData.get("confirm") !== "on") redirect(`/${locale}/company?deletion=confirm#account-deletion`);
  const reason = text(formData, "reason").slice(0, 1000);
  const { error } = await user.supabase.rpc("request_account_deletion", { p_reason: reason || undefined });
  if (error) {
    console.error("Account deletion request failed:", error.message);
    redirect(`/${locale}/company?deletion=error#account-deletion`);
  }
  notify.admin({ kind: "admin_deletion_request", path: "/admin/accounts", values: { role: user.role } });
  redirect(`/${locale}/company?deletion=requested#account-deletion`);
}

export async function cancelAccountDeletion(formData: FormData) {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  await user.supabase.rpc("cancel_account_deletion");
  redirect(`/${locale}/company?deletion=cancelled#account-deletion`);
}

// Fichiers d'un dossier (et de ses sous-dossiers directs) dans un espace de stockage.
async function filesUnder(admin: ReturnType<typeof createAdminClient>, bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (item.id) out.push(path);
    else out.push(...(await filesUnder(admin, bucket, path)));
  }
  return out;
}

// Traitement par AFRICA NEX : entreprise(s) dont le compte est proprietaire, fichiers, puis compte
// (la base supprime en cascade profil, demandes, devis, messages et documents).
export async function processAccountDeletion(formData: FormData) {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);
  const requestId = text(formData, "requestId");
  if (!UUID.test(requestId) || formData.get("confirm") !== "on") redirect(`/${locale}/admin/accounts?deletion=confirm#deletion-requests`);

  const admin = createAdminClient();
  const { data: request } = await admin.from("account_deletion_requests").select("id, profile_id, status").eq("id", requestId).maybeSingle();
  if (!request || request.status !== "pending" || !request.profile_id) redirect(`/${locale}/admin/accounts?deletion=gone#deletion-requests`);
  const profileId = request.profile_id;

  const { data: target } = await admin.from("profiles").select("role").eq("id", profileId).maybeSingle();
  if (target?.role === "admin") redirect(`/${locale}/admin/accounts?deletion=error#deletion-requests`);

  const { data: companies } = await admin.from("companies").select("id").eq("owner_profile_id", profileId);
  const companyIds = (companies ?? []).map((c) => c.id);
  const [{ data: rfqs }, { data: dispatches }] = await Promise.all([
    admin.from("rfqs").select("id").eq("buyer_profile_id", profileId),
    companyIds.length ? admin.from("rfq_dispatches").select("id").in("company_id", companyIds) : Promise.resolve({ data: [] as { id: string }[] }),
  ]);

  // Fichiers : logos, photos et documents de l'entreprise, preuve de revendication, pieces jointes.
  const toRemove: [string, string[]][] = [];
  for (const id of companyIds) {
    for (const bucket of ["producer-logos", "product-images", "company-documents"]) toRemove.push([bucket, await filesUnder(admin, bucket, id)]);
  }
  toRemove.push(["company-documents", await filesUnder(admin, "company-documents", `claims/${profileId}`)]);
  const rfqFiles: string[] = [];
  for (const r of rfqs ?? []) rfqFiles.push(...(await filesUnder(admin, "rfq-files", `buyer/${r.id}`)));
  for (const d of dispatches ?? []) rfqFiles.push(...(await filesUnder(admin, "rfq-files", `dispatch/${d.id}`)));
  toRemove.push(["rfq-files", rfqFiles]);
  for (const [bucket, paths] of toRemove) {
    for (let i = 0; i < paths.length; i += 100) await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
  }

  const { error: companyError } = companyIds.length ? await admin.from("companies").delete().in("id", companyIds) : { error: null };
  const { error: userError } = companyError ? { error: companyError } : await admin.auth.admin.deleteUser(profileId);
  if (userError) {
    console.error("Account deletion failed:", userError.message);
    redirect(`/${locale}/admin/accounts?deletion=error#deletion-requests`);
  }
  await admin.from("account_deletion_requests").update({ status: "done", processed_at: new Date().toISOString(), processed_by: user.userId }).eq("id", requestId);
  await admin.from("audit_log").insert({ actor_profile_id: user.userId, action: "account.deleted", entity: "account_deletion_requests", payload: { request_id: requestId, companies: companyIds.length } });
  if (companyIds.length) updateTag("producers");
  redirect(`/${locale}/admin/accounts?deletion=done#deletion-requests`);
}
