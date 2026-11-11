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
      .select("id, company_name, legal_form, sector, wilaya, city, visibility, description_fr, description_en, description_ar, website, founded_year, headcount, logo_url")
      .eq("id", membership.company_id)
      .single(),
    client
      .from("company_private")
      .select("tax_id, rc_number, address, contact_phone, contact_whatsapp")
      .eq("company_id", membership.company_id)
      .maybeSingle(),
  ]);
  if (companyError) throw companyError;
  if (privateError) throw privateError;
  return { ...company, private: privateData };
}

export type MyCompany = NonNullable<Awaited<ReturnType<typeof getMyCompany>>>;

// Premier produit de l'entreprise (celui saisi a la premiere configuration), s'il existe.
export async function getFirstProduct(client: Client, companyId: string) {
  const { data, error } = await client
    .from("products")
    .select("id, product_name, hs_code, unit_price_ht, currency, price_basis, unit, min_order_quantity, images")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const PRODUCT_COLUMNS =
  "id, product_name, hs_code, description_fr, description_en, description_ar, unit_price_ht, currency, price_basis, unit, min_order_quantity, packaging, container_capacity_20ft, container_capacity_40ft, stock_quantity, images, status, updated_at";

// Catalogue de l'entreprise (brouillons compris) : la RLS limite aux membres.
export async function listProducts(client: Client, companyId: string) {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
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
  return data;
}

export type Product = NonNullable<Awaited<ReturnType<typeof getProduct>>>;
export type ProductImage = { path: string; url: string };
export const productImages = (p: { images: unknown } | null | undefined): ProductImage[] =>
  Array.isArray(p?.images)
    ? (p.images as ProductImage[]).filter((i) => i && typeof i.path === "string" && typeof i.url === "string")
    : [];
