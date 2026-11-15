import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

// Reglages AFRICA NEX (admin seulement, RLS) : taux de reference et mode d'affaire des fournisseurs.
export type FxRate = { currency: "EUR" | "USD"; dzd_per_unit: number; updated_at: string };
export type ExportMode = "self" | "africanex";

export async function getFxRates(client: Client) {
  const { data, error } = await client.from("fx_rates").select("currency, dzd_per_unit, updated_at");
  if (error) throw error;
  const out: Partial<Record<"EUR" | "USD", FxRate>> = {};
  for (const r of data ?? []) out[r.currency as "EUR" | "USD"] = { currency: r.currency as "EUR" | "USD", dzd_per_unit: Number(r.dzd_per_unit), updated_at: r.updated_at };
  return out;
}

// Fournisseurs (fiches producteur) avec leur mode d'affaire ; null = pas encore defini.
export async function listSupplierModes(client: Client) {
  const { data, error } = await client
    .from("companies")
    .select("id, company_name, wilaya, city, claim_status, owner_profile_id, supplier_settings(export_mode, updated_at)")
    .eq("kind", "producer")
    .order("company_name");
  if (error) throw error;
  return (data ?? []).map((c) => {
    const s = (Array.isArray(c.supplier_settings) ? c.supplier_settings[0] : c.supplier_settings) as { export_mode: string; updated_at: string } | null;
    return { ...c, export_mode: (s?.export_mode ?? null) as ExportMode | null, mode_updated_at: s?.updated_at ?? null };
  });
}
