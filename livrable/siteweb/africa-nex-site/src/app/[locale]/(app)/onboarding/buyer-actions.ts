"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";
import { getMyCompanyId } from "@/lib/data/company";
import { isCountryCode } from "@/lib/countries";
import { isValidPhone } from "@/lib/phone";
import { BUYER_TYPES, SECTORS } from "@/lib/onboarding/reference";

export type BuyerField = "companyName" | "buyerType" | "country" | "city" | "phone" | "whatsapp" | "interests" | "website";
// Cles de traduction (espace "onboarding") ; values : saisie renvoyee en cas d'erreur.
export type BuyerState = {
  errors: Partial<Record<BuyerField, string>>;
  formError?: string;
  values?: { companyName: string; buyerType: string; country: string; city: string; phone: string; whatsapp: string; interests: string[]; website: string };
  attempt?: number;
};

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function slugify(name: string) {
  const base = name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50).replace(/-+$/g, "");
  return `${base || "acheteur"}-${randomBytes(2).toString("hex")}`;
}

// Profil de l'entreprise acheteuse. Il n'est jamais public : seule l'equipe AFRICA NEX le voit,
// les producteurs ne recoivent qu'un brief anonymise.
export async function saveBuyer(_prev: BuyerState, formData: FormData): Promise<BuyerState> {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "buyer") redirect(`/${locale}/dashboard`);

  const v = {
    companyName: text(formData, "companyName"),
    buyerType: text(formData, "buyerType"),
    country: text(formData, "country").toUpperCase(),
    city: text(formData, "city"),
    phone: text(formData, "phone"),
    whatsapp: text(formData, "whatsapp"),
    interests: [...new Set(formData.getAll("interests").map(String))],
    website: text(formData, "website"),
  };

  const errors: BuyerState["errors"] = {};
  if (v.companyName.length < 2 || v.companyName.length > 255) errors.companyName = "errorCompanyName";
  if (!(BUYER_TYPES as readonly string[]).includes(v.buyerType)) errors.buyerType = "errorChoose";
  if (!v.country || !isCountryCode(v.country)) errors.country = "errorChoose";
  if (!v.city || v.city.length > 100) errors.city = "errorRequired";
  if (!v.phone || !isValidPhone(v.phone)) errors.phone = "errorPhone";
  if (!v.whatsapp || !isValidPhone(v.whatsapp)) errors.whatsapp = "errorPhone";
  if (!v.interests.length || v.interests.some((s) => !(SECTORS as readonly string[]).includes(s))) errors.interests = "errorInterests";
  let website: string | null = null;
  if (v.website) {
    try {
      const u = new URL(/^https?:\/\//i.test(v.website) ? v.website : `https://${v.website}`);
      if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".") || v.website.length > 255) throw new Error();
      website = u.toString();
    } catch {
      errors.website = "errorWebsite";
    }
  }
  const fail = (s: Omit<BuyerState, "values" | "attempt">): BuyerState => ({ ...s, values: v, attempt: Date.now() });
  if (Object.keys(errors).length) return fail({ errors });

  const { supabase, userId } = user;
  const fields = { company_name: v.companyName, buyer_type: v.buyerType, country: v.country, city: v.city, interests: v.interests, website };

  let companyId = await getMyCompanyId(supabase, userId);
  if (!companyId) {
    // La base impose : proprietaire = soi, type = son role, jamais publique pour un acheteur.
    const insert = () => supabase.from("companies").insert({ ...fields, kind: "buyer", slug: slugify(v.companyName), owner_profile_id: userId, visibility: "draft" });
    let { error } = await insert();
    if (error?.code === "23505") ({ error } = await insert());
    if (error) {
      console.error("Buyer company insert failed:", error.code, error.message);
      return fail({ errors: {}, formError: "errorGeneric" });
    }
    companyId = await getMyCompanyId(supabase, userId);
    if (!companyId) return fail({ errors: {}, formError: "errorGeneric" });
  } else {
    const { error } = await supabase.from("companies").update(fields).eq("id", companyId);
    if (error) {
      console.error("Buyer company update failed:", error.code, error.message);
      return fail({ errors: {}, formError: "errorGeneric" });
    }
  }

  const [{ error: privateError }, { error: profileError }] = await Promise.all([
    supabase.from("company_private").update({ contact_phone: v.phone, contact_whatsapp: v.whatsapp }).eq("company_id", companyId),
    supabase.from("profiles").update({ whatsapp: v.whatsapp, onboarding_completed: true }).eq("id", userId),
    supabase.from("profiles").update({ phone: v.phone }).eq("id", userId).is("phone", null),
  ]);
  if (privateError || profileError) {
    console.error("Buyer private/profile update failed:", privateError?.message ?? profileError?.message);
    return fail({ errors: {}, formError: "errorGeneric" });
  }

  redirect(text(formData, "mode") === "edit" ? `/${locale}/company?saved=1` : `/${locale}/dashboard?configured=1`);
}
