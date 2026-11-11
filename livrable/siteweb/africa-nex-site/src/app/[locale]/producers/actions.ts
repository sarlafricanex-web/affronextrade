"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";

export type ReviewState = { error?: string; values?: { rating: string; comment: string }; attempt?: number };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

// Avis d'un acheteur connecte. La base impose : acheteur avec profil complet, fiche publiee,
// un avis par fiche, statut "en attente", auteur rempli par la base (prenom + initiale, pays).
export async function submitReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const locale = resolveLocale(text(formData, "locale"));
  const slug = text(formData, "slug");
  const rating = Number(text(formData, "rating"));
  const comment = text(formData, "comment");
  const fail = (error: string): ReviewState => ({ error, values: { rating: text(formData, "rating"), comment }, attempt: Date.now() });

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "buyer" || !/^[a-z0-9-]{1,80}$/.test(slug)) return fail("reviewErrorNotBuyer");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail("reviewErrorRating");
  if (comment.length < 20 || comment.length > 1000) return fail("reviewErrorComment");

  const { data: company } = await user.supabase.from("companies").select("id").eq("slug", slug).eq("kind", "producer").maybeSingle();
  if (!company) return fail("reviewErrorGeneric");

  const { error } = await user.supabase.from("reviews").insert({
    producer_company_id: company.id,
    author_profile_id: user.userId,
    author_name: "-", // remplace par la base
    rating,
    comment,
  });
  if (error) {
    if (error.code === "23505") return fail("reviewErrorDuplicate");
    if (/buyer_profile_incomplete/.test(error.message)) return fail("reviewErrorProfile");
    console.error("Review insert failed:", error.code, error.message);
    return fail("reviewErrorGeneric");
  }
  redirect(`/${locale}/producers/${slug}?avis=1#avis`);
}
