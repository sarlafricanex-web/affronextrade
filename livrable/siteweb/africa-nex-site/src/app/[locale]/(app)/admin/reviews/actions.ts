"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";

// Publication ou refus d'un avis. La RLS n'autorise ces changements qu'a l'admin.
export async function moderateReview(formData: FormData) {
  const locale = resolveLocale(String(formData.get("locale") ?? ""));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);

  const id = Number(formData.get("id"));
  const decision = String(formData.get("decision") ?? "");
  if (!Number.isInteger(id) || id <= 0 || !["approved", "rejected"].includes(decision)) redirect(`/${locale}/admin/reviews`);

  const { error } = await user.supabase
    .from("reviews")
    .update({ status: decision, moderated_by: user.userId, moderated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("Review moderation failed:", error.message);
    redirect(`/${locale}/admin/reviews?error=1`);
  }
  await user.supabase.from("audit_log").insert({ actor_profile_id: user.userId, action: `review.${decision}`, entity: "review", entity_id: String(id) });
  updateTag("producers"); // notes et avis publics a jour
  redirect(`/${locale}/admin/reviews?done=${decision}`);
}
