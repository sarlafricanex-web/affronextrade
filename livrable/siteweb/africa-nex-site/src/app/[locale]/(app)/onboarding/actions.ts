"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyCompanyId } from "@/lib/data/company";
import { resolveLocale } from "@/lib/auth/next-path";
import { isValidPhone } from "@/lib/phone";
import { LEGAL_FORMS, SECTORS, WILAYA_CODES, isValidNif, normalizeNif } from "@/lib/onboarding/reference";

export type IdentityField = "companyName" | "legalForm" | "sector" | "nif" | "rc" | "wilaya" | "city" | "address" | "phone" | "whatsapp";
// Cles de traduction (espace "onboarding"), jamais de texte libre renvoye au navigateur.
export type IdentityState = { errors: Partial<Record<IdentityField, string>>; formError?: string };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function slugify(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return `${base || "producteur"}-${randomBytes(2).toString("hex")}`;
}

// Etape 1 : identite juridique. Tout est revalide ici : le navigateur n'est pas digne de confiance.
export async function saveIdentity(_prev: IdentityState, formData: FormData): Promise<IdentityState> {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);

  const v = {
    companyName: text(formData, "companyName"),
    legalForm: text(formData, "legalForm"),
    sector: text(formData, "sector"),
    nif: normalizeNif(text(formData, "nif")),
    rc: text(formData, "rc"),
    wilaya: text(formData, "wilaya"),
    city: text(formData, "city"),
    address: text(formData, "address"),
    phone: text(formData, "phone"),
    whatsapp: text(formData, "whatsapp"),
  };

  const errors: IdentityState["errors"] = {};
  if (v.companyName.length < 2 || v.companyName.length > 255) errors.companyName = "errorCompanyName";
  if (!(LEGAL_FORMS as readonly string[]).includes(v.legalForm)) errors.legalForm = "errorChoose";
  if (!(SECTORS as readonly string[]).includes(v.sector)) errors.sector = "errorChoose";
  if (!isValidNif(v.nif)) errors.nif = "errorNif";
  if (v.rc.length < 4 || v.rc.length > 40) errors.rc = "errorRc";
  if (!WILAYA_CODES.has(v.wilaya)) errors.wilaya = "errorChoose";
  if (!v.city || v.city.length > 100) errors.city = "errorRequired";
  if (!v.address || v.address.length > 300) errors.address = "errorRequired";
  if (!v.phone || !isValidPhone(v.phone)) errors.phone = "errorPhone";
  if (!v.whatsapp || !isValidPhone(v.whatsapp)) errors.whatsapp = "errorPhone";
  if (Object.keys(errors).length) return { errors };

  const { supabase, userId } = user;
  const fields = { company_name: v.companyName, legal_form: v.legalForm, sector: v.sector, wilaya: v.wilaya, city: v.city };

  let companyId = await getMyCompanyId(supabase, userId);
  if (!companyId) {
    // Les regles de la base imposent : proprietaire = soi, type = son role, ni badge ni abonnement.
    let { error } = await supabase
      .from("companies")
      .insert({ ...fields, kind: "producer", slug: slugify(v.companyName), owner_profile_id: userId, visibility: "draft" });
    if (error?.code === "23505") {
      ({ error } = await supabase
        .from("companies")
        .insert({ ...fields, kind: "producer", slug: slugify(v.companyName), owner_profile_id: userId, visibility: "draft" }));
    }
    if (error) {
      console.error("Onboarding company insert failed:", error.code, error.message);
      return { errors: {}, formError: "errorGeneric" };
    }
    companyId = await getMyCompanyId(supabase, userId);
    if (!companyId) return { errors: {}, formError: "errorGeneric" };
  } else {
    const { error } = await supabase.from("companies").update(fields).eq("id", companyId);
    if (error) {
      console.error("Onboarding company update failed:", error.code, error.message);
      return { errors: {}, formError: "errorGeneric" };
    }
  }

  // En parallele : partie privee, et telephone du profil s'il manque (comptes Google).
  const [{ error: privateError }] = await Promise.all([
    supabase
      .from("company_private")
      .update({ tax_id: v.nif, rc_number: v.rc, address: v.address, contact_phone: v.phone, contact_whatsapp: v.whatsapp })
      .eq("company_id", companyId),
    supabase.from("profiles").update({ phone: v.phone }).eq("id", userId).is("phone", null),
    supabase.from("profiles").update({ whatsapp: v.whatsapp }).eq("id", userId).is("whatsapp", null),
  ]);
  if (privateError) {
    if (privateError.code === "23505") return { errors: { nif: "errorNifTaken" } };
    console.error("Onboarding private update failed:", privateError.code, privateError.message);
    return { errors: {}, formError: "errorGeneric" };
  }

  redirect(text(formData, "intent") === "later" ? `/${locale}/dashboard` : `/${locale}/onboarding?step=2`);
}
