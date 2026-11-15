import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

// Identifiant de l'entreprise de l'utilisateur (une seule par compte), en une requete.
export async function getMyCompanyId(client: Client, userId: string) {
  const { data, error } = await client
    .from("company_members")
    .select("company_id")
    .eq("profile_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.company_id ?? null;
}

// Entreprise de l'utilisateur connecte, avec sa partie privee.
// Lecture avec la session de l'utilisateur : la RLS ne renvoie que ses propres lignes.
export async function getMyCompany(client: Client, userId: string) {
  const companyId = await getMyCompanyId(client, userId);
  if (!companyId) return null;
  const membership = { company_id: companyId };

  const [{ data: company, error: companyError }, { data: privateData, error: privateError }] = await Promise.all([
    client
      .from("companies")
      .select("id, kind, slug, verified, claim_status, company_name, legal_form, sector, wilaya, city, country, buyer_type, interests, visibility, description_fr, description_en, description_ar, website, founded_year, headcount, logo_url, cover_url")
      .eq("id", membership.company_id)
      .single(),
    client
      .from("company_private")
      .select("tax_id, nis, tax_article, rc_number, address, contact_phone, contact_whatsapp")
      .eq("company_id", membership.company_id)
      .maybeSingle(),
  ]);
  if (companyError) throw companyError;
  if (privateError) throw privateError;
  return { ...company, private: privateData };
}

export type MyCompany = NonNullable<Awaited<ReturnType<typeof getMyCompany>>>;

// Le prix producteur n'est pas lisible dans la table (confidentiel) : chaque entreprise lit
// les siens via la fonction product_prices(), reservee a ses membres et a l'admin.
// Forfait de l'entreprise : decide du modele de liste de prix (Starter ou detaille).
export async function getCompanyTier(client: Client, companyId: string) {
  const { data } = await client.from("companies").select("subscription_tier").eq("id", companyId).maybeSingle();
  return data?.subscription_tier ?? "starter";
}

// Meme regle pour la construction du prix (couts) et sa date de validite.
type PrivatePrice = { unit_price_ht: number | null; product_cost: number | null; packaging_cost: number | null; price_valid_until: string | null };
const NO_PRICE: PrivatePrice = { unit_price_ht: null, product_cost: null, packaging_cost: null, price_valid_until: null };
const num = (x: unknown) => (x === null || x === undefined ? null : Number(x));
async function withPrices<T extends { id: string }>(client: Client, companyId: string, rows: T[]): Promise<(T & PrivatePrice)[]> {
  if (!rows.length) return [];
  const { data, error } = await client.rpc("product_prices", { p_company: companyId });
  if (error) throw error;
  const prices = new Map<string, PrivatePrice>(
    (data ?? []).map((p) => [p.product_id, { unit_price_ht: num(p.unit_price_ht), product_cost: num(p.product_cost), packaging_cost: num(p.packaging_cost), price_valid_until: p.price_valid_until }]),
  );
  return rows.map((r) => ({ ...r, ...(prices.get(r.id) ?? NO_PRICE) }));
}

// Premier produit de l'entreprise (celui saisi a la premiere configuration), s'il existe.
export async function getFirstProduct(client: Client, companyId: string) {
  const { data, error } = await client
    .from("products")
    .select("id, product_name, hs_code, currency, price_basis, unit, min_order_quantity, images")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? (await withPrices(client, companyId, [data]))[0] : null;
}

const PRODUCT_COLUMNS =
  "id, product_name, hs_code, description_fr, description_en, description_ar, currency, price_basis, unit, min_order_quantity, packaging, container_capacity_20ft, container_capacity_40ft, stock_quantity, images, status, updated_at, units_per_carton, carton_length_cm, carton_width_cm, carton_height_cm, carton_gross_weight_kg, max_stack_layers, storage_condition, palletized, cartons_per_pallet, sku, cross_refs, price_place, stock_updated_at, lead_time_days, origin_country, packaging_spec";

// Catalogue de l'entreprise (brouillons compris) : la RLS limite aux membres.
export async function listProducts(client: Client, companyId: string) {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return withPrices(client, companyId, data);
}

export async function getProduct(client: Client, companyId: string, productId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return null;
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("company_id", companyId)
    .eq("id", productId)
    .maybeSingle();
  if (error) throw error;
  return data ? (await withPrices(client, companyId, [data]))[0] : null;
}

export type Product = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

// Consultations de la fiche publique sur les 30 derniers jours (RLS : membres et admin).
export async function countRecentViews(client: Client, companyId: string) {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { count } = await client.from("profile_views").select("id", { count: "exact", head: true }).eq("company_id", companyId).gte("created_at", since);
  return count ?? 0;
}
export type ProductImage = { path: string; url: string };
export const productImages = (p: { images: unknown } | null | undefined): ProductImage[] =>
  Array.isArray(p?.images)
    ? (p.images as ProductImage[]).filter((i) => i && typeof i.path === "string" && typeof i.url === "string")
    : [];
