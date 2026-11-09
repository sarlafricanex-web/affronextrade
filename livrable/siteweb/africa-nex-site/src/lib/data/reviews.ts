import "server-only";
import { createPublicClient } from "@/lib/supabase/public";

// L'annuaire utilise encore les anciens identifiants "1" a "16" (legacy_id)
// jusqu'a sa refonte en semaine 4. Seuls les avis approuves sont lisibles.

export async function getProducerRatings() {
  const { data, error } = await createPublicClient()
    .from("producer_cards")
    .select("legacy_id, avg_rating, review_count")
    .not("legacy_id", "is", null)
    .gt("review_count", 0);
  if (error) throw error;
  return data.map((r) => ({
    producer_id: r.legacy_id!,
    avg_rating: String(r.avg_rating),
    review_count: r.review_count!,
  }));
}

export async function getReviews(legacyId: string) {
  const client = createPublicClient();
  const { data: company, error: companyError } = await client
    .from("companies")
    .select("id")
    .eq("legacy_id", legacyId)
    .maybeSingle();
  if (companyError) throw companyError;
  if (!company) return [];

  const { data, error } = await client
    .from("reviews")
    .select("id, author_name, author_company, author_country, rating, comment, created_at")
    .eq("producer_company_id", company.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
