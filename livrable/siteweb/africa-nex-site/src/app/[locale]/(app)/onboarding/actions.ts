"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyCompanyId } from "@/lib/data/company";
import { resolveLocale } from "@/lib/auth/next-path";
import { isValidPhone } from "@/lib/phone";
import type { Database } from "@/lib/supabase/database.types";
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

// ---------------------------------------------------------------------------------------------
// Etape 2 : presentation (FR obligatoire, EN et AR facultatifs) et logo.

export type PresentationField = "descriptionFr" | "descriptionEn" | "descriptionAr" | "website" | "foundedYear" | "headcount" | "logo";
export type PresentationState = { errors: Partial<Record<PresentationField, string>>; formError?: string };

const HEADCOUNTS = ["1-9", "10-49", "50-249", "250+"];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

// Type reel du fichier d'apres ses premiers octets (le nom et le type annonces ne prouvent rien).
function imageKind(bytes: Uint8Array): "png" | "jpg" | "webp" | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

export async function savePresentation(_prev: PresentationState, formData: FormData): Promise<PresentationState> {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);
  const { supabase, userId } = user;
  const companyId = await getMyCompanyId(supabase, userId);
  if (!companyId) redirect(`/${locale}/onboarding`);

  const v = {
    descriptionFr: text(formData, "descriptionFr"),
    descriptionEn: text(formData, "descriptionEn"),
    descriptionAr: text(formData, "descriptionAr"),
    website: text(formData, "website"),
    foundedYear: text(formData, "foundedYear"),
    headcount: text(formData, "headcount"),
  };
  const errors: PresentationState["errors"] = {};
  if (v.descriptionFr.length < 80 || v.descriptionFr.length > 2000) errors.descriptionFr = "errorDescription";
  if (v.descriptionEn.length > 2000) errors.descriptionEn = "errorTooLong";
  if (v.descriptionAr.length > 2000) errors.descriptionAr = "errorTooLong";
  let website: string | null = null;
  if (v.website) {
    try {
      const u = new URL(/^https?:\/\//i.test(v.website) ? v.website : `https://${v.website}`);
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) throw new Error("url");
      website = u.href;
    } catch {
      errors.website = "errorWebsite";
    }
  }
  const year = v.foundedYear ? Number(v.foundedYear) : null;
  if (year !== null && (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear())) errors.foundedYear = "errorYear";
  if (v.headcount && !HEADCOUNTS.includes(v.headcount)) errors.headcount = "errorChoose";

  // Logo facultatif : verifie sur son contenu reel, 2 Mo maximum.
  const logo = formData.get("logo");
  let logoUpload: { bytes: Uint8Array; kind: "png" | "jpg" | "webp" } | null = null;
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > LOGO_MAX_BYTES) errors.logo = "errorLogoSize";
    else {
      const bytes = new Uint8Array(await logo.arrayBuffer());
      const kind = imageKind(bytes);
      if (!kind) errors.logo = "errorLogoType";
      else logoUpload = { bytes, kind };
    }
  }
  if (Object.keys(errors).length) return { errors };

  const update: Database["public"]["Tables"]["companies"]["Update"] = {
    description_fr: v.descriptionFr,
    description_en: v.descriptionEn || null,
    description_ar: v.descriptionAr || null,
    website,
    founded_year: year,
    headcount: v.headcount || null,
  };

  if (logoUpload) {
    // Chemin construit ici, dans le dossier de l'entreprise : les regles de stockage verifient l'appartenance.
    const path = `${companyId}/logo-${randomBytes(6).toString("hex")}.${logoUpload.kind}`;
    const contentType = logoUpload.kind === "jpg" ? "image/jpeg" : `image/${logoUpload.kind}`;
    const { error: uploadError } = await supabase.storage.from("producer-logos").upload(path, logoUpload.bytes, { contentType, upsert: false });
    if (uploadError) {
      console.error("Logo upload failed:", uploadError.message);
      return { errors: {}, formError: "errorGeneric" };
    }
    update.logo_url = supabase.storage.from("producer-logos").getPublicUrl(path).data.publicUrl;

    // Ancien logo supprime pour ne pas accumuler de fichiers.
    const { data: previous } = await supabase.from("companies").select("logo_url").eq("id", companyId).single();
    const marker = `/producer-logos/${companyId}/`;
    if (previous?.logo_url?.includes(marker)) {
      await supabase.storage.from("producer-logos").remove([`${companyId}/${previous.logo_url.split(marker)[1]}`]);
    }
  }

  const { error } = await supabase.from("companies").update(update).eq("id", companyId);
  if (error) {
    console.error("Onboarding presentation update failed:", error.code, error.message);
    return { errors: {}, formError: "errorGeneric" };
  }

  redirect(text(formData, "intent") === "later" ? `/${locale}/dashboard` : `/${locale}/onboarding?step=3`);
}
