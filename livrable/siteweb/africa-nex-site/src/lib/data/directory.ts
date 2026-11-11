import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

// Annuaire public : client sans cookies (visiteur anonyme), donc utilisable en cache.
// Le cache est invalide par updateTag("producers") quand une fiche ou un produit change.

export type ProducerCard = {
  id: string;
  slug: string;
  name: string;
  location: string;
  sector: string;
  verified: boolean;
  claimStatus: string;
  initials: string;
  color: string;
  logo: string | null;
  products: string[];
  avgRating: number | null;
  reviewCount: number;
};

export async function getProducerCards(): Promise<ProducerCard[]> {
  "use cache";
  cacheTag("producers");
  cacheLife("hours");
  const { data, error } = await createPublicClient()
    .from("producer_cards")
    .select("id, slug, name, location, sector, verified, claim_status, initials, color, logo, products, avg_rating, review_count")
    .order("verified", { ascending: false })
    .order("name");
  if (error) throw error;
  return data.map((r) => ({
    id: r.id!,
    slug: r.slug!,
    name: r.name!,
    location: r.location ?? "",
    sector: r.sector ?? "",
    verified: Boolean(r.verified),
    claimStatus: r.claim_status ?? "unclaimed",
    initials: r.initials ?? r.name!.slice(0, 2).toUpperCase(),
    color: r.color ?? "#0f172a",
    logo: r.logo,
    products: r.products ?? [],
    avgRating: r.avg_rating === null ? null : Number(r.avg_rating),
    reviewCount: r.review_count ?? 0,
  }));
}

export type PublicProduct = {
  id: string;
  name: string;
  hsCode: string | null;
  description: { fr: string | null; en: string | null; ar: string | null };
  unit: string | null;
  moq: number | null;
  packaging: string | null;
  cap20: number | null;
  cap40: number | null;
  photo: string | null;
};

// Fiche publique d'un producteur. Le prix producteur n'est jamais affiche : l'acheteur recoit
// une offre AFRICA NEX (commission incluse) via une demande de devis.
export async function getProducerProfile(slug: string) {
  "use cache";
  cacheTag("producers");
  cacheLife("hours");
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const client = createPublicClient();
  const { data: c, error } = await client
    .from("companies")
    .select("id, slug, company_name, city, wilaya, sector, verified, claim_status, brand_initials, brand_color, logo_url, description_fr, description_en, description_ar, website, founded_year, headcount")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!c) return null;

  const [{ data: products, error: productsError }, { data: reviews, error: reviewsError }, { data: documents }] = await Promise.all([
    client
      .from("products")
      .select("id, product_name, hs_code, description_fr, description_en, description_ar, unit, min_order_quantity, packaging, container_capacity_20ft, container_capacity_40ft, images, sort_order, created_at")
      .eq("company_id", c.id)
      .eq("status", "published")
      .order("sort_order")
      .order("created_at"),
    client
      .from("reviews")
      .select("id, author_name, author_company, author_country, rating, comment, created_at")
      .eq("producer_company_id", c.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(20),
    // Documents publics ET verifies par AFRICA NEX (la RLS ne renvoie rien d'autre au public).
    client.from("company_documents").select("id, kind, title, expires_on").eq("company_id", c.id).order("kind"),
  ]);
  if (productsError) throw productsError;
  if (reviewsError) throw reviewsError;

  return {
    id: c.id,
    slug: c.slug,
    name: c.company_name,
    location: c.city ?? "",
    wilaya: c.wilaya,
    sector: c.sector ?? "",
    verified: c.verified,
    claimStatus: c.claim_status,
    initials: c.brand_initials ?? c.company_name.slice(0, 2).toUpperCase(),
    color: c.brand_color ?? "#0f172a",
    logo: c.logo_url,
    description: { fr: c.description_fr, en: c.description_en, ar: c.description_ar },
    website: c.website,
    foundedYear: c.founded_year,
    headcount: c.headcount,
    products: (products ?? []).map((p): PublicProduct => {
      const images = Array.isArray(p.images) ? (p.images as { url?: string }[]) : [];
      return {
        id: p.id,
        name: p.product_name,
        hsCode: p.hs_code,
        description: { fr: p.description_fr, en: p.description_en, ar: p.description_ar },
        unit: p.unit,
        moq: p.min_order_quantity === null ? null : Number(p.min_order_quantity),
        packaging: p.packaging,
        cap20: p.container_capacity_20ft,
        cap40: p.container_capacity_40ft,
        photo: images[0]?.url ?? null,
      };
    }),
    reviews: reviews ?? [],
    documents: documents ?? [],
  };
}

export type ProducerProfile = NonNullable<Awaited<ReturnType<typeof getProducerProfile>>>;
