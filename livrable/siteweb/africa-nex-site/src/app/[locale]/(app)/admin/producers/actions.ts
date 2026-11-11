"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";
import { isValidPhone } from "@/lib/phone";
import { SECTORS, WILAYA_CODES, isValidNif, normalizeNif } from "@/lib/onboarding/reference";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COLORS = ["#0891b2", "#059669", "#7c3aed", "#dc2626", "#2563eb", "#ea580c", "#65a30d", "#b45309", "#be185d", "#0d9488", "#4f46e5", "#0f766e"];

async function adminContext(formData: FormData) {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);
  return { locale, supabase: user.supabase, userId: user.userId };
}

function slugify(name: string) {
  const base = name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50).replace(/-+$/g, "");
  return base || "producteur";
}
// "Sonatrach Export" -> "SE", "Ifri" -> "IF".
function initialsOf(name: string) {
  const words = name.normalize("NFD").replace(/\p{Diacritic}/gu, "").split(/[^A-Za-z0-9]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "AN").slice(0, 2);
  return letters.toUpperCase();
}

export type AdminProducerField = "companyName" | "sector" | "wilaya" | "city" | "descriptionFr" | "descriptionEn" | "descriptionAr" | "website" | "nif" | "contactEmail" | "contactPhone" | "products";
export type AdminProducerState = { errors: Partial<Record<AdminProducerField, string>>; formError?: string; values?: Record<string, string>; attempt?: number };

// Creation (fiche etablie par AFRICA NEX, non revendiquee) ou modification d'un producteur.
export async function saveAdminProducer(_prev: AdminProducerState, formData: FormData): Promise<AdminProducerState> {
  const { locale, supabase, userId } = await adminContext(formData);
  const id = text(formData, "id");
  const raw = Object.fromEntries(
    ["companyName", "sector", "wilaya", "city", "descriptionFr", "descriptionEn", "descriptionAr", "website", "nif", "contactEmail", "contactPhone", "products", "visibility"].map((k) => [k, text(formData, k)]),
  );
  const nif = normalizeNif(raw.nif);
  const productNames = [...new Set(raw.products.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))];

  const errors: AdminProducerState["errors"] = {};
  if (raw.companyName.length < 2 || raw.companyName.length > 255) errors.companyName = "errorCompanyName";
  if (!(SECTORS as readonly string[]).includes(raw.sector)) errors.sector = "errorChoose";
  if (!WILAYA_CODES.has(raw.wilaya)) errors.wilaya = "errorChoose";
  if (!raw.city || raw.city.length > 100) errors.city = "errorRequired";
  for (const k of ["descriptionFr", "descriptionEn", "descriptionAr"] as const) if (raw[k].length > 2000) errors[k] = "errorTooLong";
  let website: string | null = null;
  if (raw.website) {
    try {
      const u = new URL(/^https?:\/\//i.test(raw.website) ? raw.website : `https://${raw.website}`);
      if (!u.hostname.includes(".")) throw new Error();
      website = u.toString();
    } catch {
      errors.website = "errorWebsite";
    }
  }
  if (raw.nif && !isValidNif(nif)) errors.nif = "errorNif";
  if (raw.contactEmail && !EMAIL.test(raw.contactEmail)) errors.contactEmail = "errorEmail";
  if (raw.contactPhone && !isValidPhone(raw.contactPhone)) errors.contactPhone = "errorPhone";
  if (productNames.length > 30 || productNames.some((n) => n.length > 255)) errors.products = "errorProducts";
  const fail = (s: Omit<AdminProducerState, "values" | "attempt">): AdminProducerState => ({ ...s, values: raw, attempt: Date.now() });
  if (Object.keys(errors).length) return fail({ errors });

  const fields = {
    company_name: raw.companyName,
    sector: raw.sector,
    wilaya: raw.wilaya,
    city: raw.city,
    description_fr: raw.descriptionFr || null,
    description_en: raw.descriptionEn || null,
    description_ar: raw.descriptionAr || null,
    website,
  };

  let companyId = id;
  if (id) {
    if (!UUID.test(id)) redirect(`/${locale}/admin/producers`);
    const { error } = await supabase.from("companies").update(fields).eq("id", id).eq("kind", "producer");
    if (error) {
      console.error("Admin producer update failed:", error.message);
      return fail({ errors: {}, formError: "errorGeneric" });
    }
  } else {
    const visibility = raw.visibility === "published" ? "published" : "draft";
    const base = slugify(raw.companyName);
    let created: { id: string } | null = null;
    for (const slug of [base, `${base}-${randomBytes(2).toString("hex")}`]) {
      const { data, error } = await supabase
        .from("companies")
        .insert({
          ...fields,
          kind: "producer",
          slug,
          visibility,
          claim_status: "unclaimed",
          created_by_admin: true,
          brand_initials: initialsOf(raw.companyName),
          brand_color: COLORS[randomBytes(1)[0] % COLORS.length],
        })
        .select("id")
        .single();
      if (!error) { created = data; break; }
      if (error.code !== "23505") {
        console.error("Admin producer insert failed:", error.message);
        return fail({ errors: {}, formError: "errorGeneric" });
      }
    }
    if (!created) return fail({ errors: {}, formError: "errorGeneric" });
    companyId = created.id;
  }

  const { error: privError } = await supabase
    .from("company_private")
    .upsert({ company_id: companyId, tax_id: raw.nif ? nif : null, contact_email: raw.contactEmail || null, contact_phone: raw.contactPhone || null });
  if (privError) {
    if (privError.code === "23505") return fail({ errors: { nif: "errorNifTaken" } });
    console.error("Admin producer private failed:", privError.message);
    return fail({ errors: {}, formError: "errorGeneric" });
  }

  if (productNames.length) {
    const { error: prodError } = await supabase
      .from("products")
      .insert(productNames.map((name, i) => ({ company_id: companyId, product_name: name, status: "published", source: "admin", sort_order: i })));
    if (prodError) console.error("Admin products insert failed:", prodError.message);
  }

  await supabase.from("audit_log").insert({
    actor_profile_id: userId,
    action: id ? "producer.update" : "producer.create",
    entity: "company",
    entity_id: companyId,
    payload: { name: raw.companyName, products_added: productNames.length },
  });
  updateTag("producers");
  redirect(`/${locale}/admin/producers?saved=${id ? "update" : "create"}`);
}

// Mise en ligne, retrait, suspension, badge verifie, retrait d'un produit importe.
export async function adminProducerAction(formData: FormData) {
  const { locale, supabase, userId } = await adminContext(formData);
  const id = text(formData, "id");
  const op = text(formData, "op");
  const back = text(formData, "back") === "edit" ? `/${locale}/admin/producers/${id}` : `/${locale}/admin/producers`;
  if (!UUID.test(id)) redirect(back);

  let error: { message: string } | null = null;
  if (op === "publish" || op === "unpublish" || op === "suspend") {
    const visibility = op === "publish" ? "published" : op === "suspend" ? "suspended" : "draft";
    ({ error } = await supabase.from("companies").update({ visibility }).eq("id", id).eq("kind", "producer"));
  } else if (op === "verify" || op === "unverify") {
    // La base refuse le badge sur une fiche non revendiquee (contrainte verified_requires_claim).
    ({ error } = await supabase.from("companies").update({ verified: op === "verify" }).eq("id", id).eq("kind", "producer"));
  } else if (op === "acceptDoc" || op === "rejectDoc") {
    const docId = text(formData, "docId");
    if (UUID.test(docId)) {
      ({ error } = await supabase
        .from("company_documents")
        .update({ review_status: op === "acceptDoc" ? "accepted" : "rejected", reviewed_by: userId, reviewed_at: new Date().toISOString() })
        .eq("id", docId)
        .eq("company_id", id));
    }
  } else if (op === "removeProduct") {
    const productId = text(formData, "productId");
    if (UUID.test(productId)) ({ error } = await supabase.from("products").delete().eq("id", productId).eq("company_id", id));
  } else {
    redirect(back);
  }

  if (error) {
    console.error("Admin producer action failed:", op, error.message);
    redirect(`${back}?error=${/verified_requires_claim/.test(error.message) ? "verifyUnclaimed" : "generic"}`);
  }
  await supabase.from("audit_log").insert({ actor_profile_id: userId, action: `producer.${op}`, entity: "company", entity_id: id });
  updateTag("producers");
  redirect(`${back}?done=${op}`);
}
