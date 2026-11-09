import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Les visiteurs n'ont aucun droit sur cette table : lecture et ecriture passent par le serveur.

const RETENTION_MONTHS = 12;

export type SubmissionInput = {
  name: string;
  email: string;
  company?: string;
  country?: string;
  phone?: string;
  whatsapp?: string;
  message?: string;
};

export async function saveSubmission(data: SubmissionInput) {
  const { data: row, error } = await createAdminClient()
    .from("submissions")
    .insert({
      name: data.name,
      email: data.email,
      company: data.company ?? "",
      country: data.country ?? "",
      phone: data.phone ?? "",
      whatsapp: data.whatsapp ?? "",
      message: data.message ?? "",
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return row;
}

export async function getSubmissions(limit = 100, offset = 0) {
  const { data, error } = await createAdminClient()
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

// L'API Supabase renvoie au plus 1 000 lignes par requete : l'export complet pagine.
export async function getAllSubmissions() {
  const pageSize = 1000;
  const all: Awaited<ReturnType<typeof getSubmissions>> = [];
  for (let from = 0; ; from += pageSize) {
    const page = await getSubmissions(pageSize, from);
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}

export async function countSubmissions() {
  const { count, error } = await createAdminClient()
    .from("submissions")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function purgeOldSubmissions() {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  const { count, error } = await createAdminClient()
    .from("submissions")
    .delete({ count: "exact" })
    .lt("created_at", cutoff.toISOString());
  if (error) throw error;
  return count ?? 0;
}
