import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Demandes de revendication, lues avec la session de l'admin (la RLS verifie le role).
export async function getClaims(client: SupabaseClient<Database>) {
  const { data, error } = await client
    .from("company_claims")
    .select(
      "id, status, tax_id, work_email, phone, job_title, message, evidence_path, created_at, reviewed_at, company:companies(company_name, slug), claimant:profiles!company_claims_profile_id_fkey(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export type Claim = Awaited<ReturnType<typeof getClaims>>[number];
