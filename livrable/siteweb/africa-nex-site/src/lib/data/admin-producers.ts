import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

// Tous les producteurs (brouillons, suspendus compris), lus avec la session de l'admin.
export async function listAdminProducers(client: Client) {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await client
    .from("companies")
    // products(id) et non products(count) : le comptage agrege est refuse depuis que la colonne prix est protegee.
    .select("id, slug, company_name, city, wilaya, sector, verified, visibility, claim_status, created_by_admin, created_at, products(id), profile_views(count), company_documents(review_status)")
    .eq("kind", "producer")
    .gte("profile_views.created_at", since)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((c) => ({
    ...c,
    productCount: c.products.length,
    docsPending: c.company_documents.filter((d) => d.review_status === "pending").length,
    views30: (c.profile_views as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

export type AdminProducer = Awaited<ReturnType<typeof listAdminProducers>>[number];

export async function getAdminProducer(client: Client, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [{ data: company, error }, { data: priv }, { data: products }, { data: documents }] = await Promise.all([
    client
      .from("companies")
      .select("id, slug, kind, company_name, sector, wilaya, city, description_fr, description_en, description_ar, website, visibility, verified, claim_status")
      .eq("id", id)
      .maybeSingle(),
    client.from("company_private").select("tax_id, contact_email, contact_phone").eq("company_id", id).maybeSingle(),
    client.from("products").select("id, product_name, status, source").eq("company_id", id).order("sort_order").order("created_at"),
    client.from("company_documents").select("id, kind, title, is_public, review_status, expires_on, created_at").eq("company_id", id).order("created_at", { ascending: false }),
  ]);
  if (error) throw error;
  if (!company || company.kind !== "producer") return null;
  return { ...company, private: priv, products: products ?? [], documents: documents ?? [] };
}
