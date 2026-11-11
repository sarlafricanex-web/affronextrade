"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";
import { documentContentType, readDocument } from "@/lib/images";
import { isValidNif, normalizeNif } from "@/lib/onboarding/reference";
import { isValidPhone } from "@/lib/phone";

export type ClaimField = "nif" | "workEmail" | "phone" | "jobTitle" | "evidence" | "message" | "consent";
// Cles de traduction (espace "claim").
export type ClaimState = {
  errors: Partial<Record<ClaimField, string>>;
  formError?: string;
  values?: Record<string, string>;
  attempt?: number;
};

const EVIDENCE_MAX_BYTES = 4 * 1024 * 1024; // sous la limite de 4,5 Mo des requetes Vercel
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

// Demande de revendication d'une fiche. La base verifie aussi : compte producteur, aucune
// entreprise deja geree, fiche publiee et non revendiquee.
export async function submitClaim(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const locale = resolveLocale(text(formData, "locale"));
  const slug = text(formData, "slug");
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer" || !/^[a-z0-9-]{1,80}$/.test(slug)) redirect(`/${locale}/dashboard`);

  const v = {
    nif: normalizeNif(text(formData, "nif")),
    workEmail: text(formData, "workEmail").toLowerCase(),
    phone: text(formData, "phone"),
    jobTitle: text(formData, "jobTitle"),
    message: text(formData, "message"),
  };
  const errors: ClaimState["errors"] = {};
  if (!isValidNif(v.nif)) errors.nif = "errorNif";
  if (!EMAIL.test(v.workEmail) || v.workEmail.length > 255) errors.workEmail = "errorEmail";
  if (!v.phone || !isValidPhone(v.phone)) errors.phone = "errorPhone";
  if (v.jobTitle.length < 2 || v.jobTitle.length > 100) errors.jobTitle = "errorJobTitle";
  if (v.message.length > 2000) errors.message = "errorTooLong";
  if (formData.get("consent") !== "on") errors.consent = "errorConsent";
  const evidence = await readDocument(formData.get("evidence"), EVIDENCE_MAX_BYTES);
  if (!evidence) errors.evidence = "errorEvidenceMissing";
  else if ("error" in evidence) errors.evidence = evidence.error === "size" ? "errorEvidenceSize" : "errorEvidenceType";

  const fail = (s: Omit<ClaimState, "values" | "attempt">): ClaimState => ({ ...s, values: v, attempt: Date.now() });
  if (Object.keys(errors).length || !evidence || "error" in evidence) return fail({ errors });

  const { supabase, userId } = user;
  const { data: company } = await supabase.from("companies").select("id").eq("slug", slug).maybeSingle();
  if (!company) return fail({ errors: {}, formError: "errorNotClaimable" });

  const path = `claims/${userId}/registre-${randomBytes(6).toString("hex")}.${evidence.kind}`;
  const { error: uploadError } = await supabase.storage
    .from("company-documents")
    .upload(path, evidence.bytes, { contentType: documentContentType(evidence.kind), upsert: false });
  if (uploadError) {
    console.error("Claim evidence upload failed:", uploadError.message);
    return fail({ errors: {}, formError: "errorGeneric" });
  }

  const { error } = await supabase.from("company_claims").insert({
    company_id: company.id,
    profile_id: userId,
    tax_id: v.nif,
    work_email: v.workEmail,
    phone: v.phone,
    job_title: v.jobTitle,
    message: v.message || null,
    evidence_path: path,
  });
  if (error) {
    await supabase.storage.from("company-documents").remove([path]);
    // 42501 : regle de la base (fiche deja revendiquee, compte qui gere deja une entreprise...).
    if (error.code === "42501" || error.code === "23505") return fail({ errors: {}, formError: "errorNotClaimable" });
    console.error("Claim insert failed:", error.code, error.message);
    return fail({ errors: {}, formError: "errorGeneric" });
  }

  updateTag("producers"); // la fiche publique affiche "revendication en cours"
  redirect(`/${locale}/claim/${slug}?sent=1`);
}
