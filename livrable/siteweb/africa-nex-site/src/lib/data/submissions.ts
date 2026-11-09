import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

// Les visiteurs n'ont aucun droit sur cette table. Le formulaire de contact ecrit avec la
// cle secrete ; les lectures recoivent le client de l'appelant : session admin (la RLS
// verifie le role) ou cle secrete pour la tache hebdomadaire.

type Client = SupabaseClient<Database>;

const RETENTION_MONTHS = 12;
const COLUMNS = "id, name, email, company, country, phone, whatsapp, message, created_at";

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

export async function getSubmissions(client: Client, limit = 100, offset = 0) {
  const { data, error } = await client
    .from("submissions")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

// L'API Supabase renvoie au plus 1 000 lignes par requete : l'export complet pagine.
export async function getAllSubmissions(client: Client) {
  const pageSize = 1000;
  const all: Awaited<ReturnType<typeof getSubmissions>> = [];
  for (let from = 0; ; from += pageSize) {
    const page = await getSubmissions(client, pageSize, from);
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}

export async function countSubmissions(client: Client) {
  const { count, error } = await client
    .from("submissions")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function purgeOldSubmissions(client: Client) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  const { count, error } = await client
    .from("submissions")
    .delete({ count: "exact" })
    .lt("created_at", cutoff.toISOString());
  if (error) throw error;
  return count ?? 0;
}
