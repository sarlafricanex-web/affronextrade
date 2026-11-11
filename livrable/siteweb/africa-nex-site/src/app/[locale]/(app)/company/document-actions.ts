"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";
import { getMyCompanyId } from "@/lib/data/company";
import { documentContentType, readDocument } from "@/lib/images";
import { DOCUMENT_KINDS, DOCUMENT_MAX_BYTES, MAX_DOCUMENTS } from "@/lib/documents";

export type DocumentState = { error?: string; values?: Record<string, string>; attempt?: number };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

async function producerCompany(formData: FormData) {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);
  const companyId = await getMyCompanyId(user.supabase, user.userId);
  if (!companyId) redirect(`/${locale}/onboarding`);
  return { locale, supabase: user.supabase, companyId };
}

// Depot d'un document. Il est toujours "a verifier" : la base l'impose, AFRICA NEX decide.
export async function uploadDocument(_prev: DocumentState, formData: FormData): Promise<DocumentState> {
  const { locale, supabase, companyId } = await producerCompany(formData);
  const v = { kind: text(formData, "kind"), title: text(formData, "title"), expiresOn: text(formData, "expiresOn"), isPublic: formData.get("isPublic") === "on" ? "on" : "" };
  const fail = (error: string): DocumentState => ({ error, values: v, attempt: Date.now() });

  if (!(DOCUMENT_KINDS as readonly string[]).includes(v.kind)) return fail("docErrorKind");
  if (v.title.length > 200) return fail("docErrorTitle");
  if (v.expiresOn && (!/^\d{4}-\d{2}-\d{2}$/.test(v.expiresOn) || Number.isNaN(Date.parse(v.expiresOn)))) return fail("docErrorDate");
  const file = await readDocument(formData.get("file"), DOCUMENT_MAX_BYTES);
  if (!file) return fail("docErrorMissing");
  if ("error" in file) return fail(file.error === "size" ? "docErrorSize" : "docErrorType");

  const { count } = await supabase.from("company_documents").select("id", { count: "exact", head: true }).eq("company_id", companyId);
  if ((count ?? 0) >= MAX_DOCUMENTS) return fail("docErrorCount");

  const path = `${companyId}/docs/${v.kind}-${randomBytes(6).toString("hex")}.${file.kind}`;
  const { error: uploadError } = await supabase.storage
    .from("company-documents")
    .upload(path, file.bytes, { contentType: documentContentType(file.kind), upsert: false });
  if (uploadError) {
    console.error("Document upload failed:", uploadError.message);
    return fail("docErrorGeneric");
  }
  const { error } = await supabase.from("company_documents").insert({
    company_id: companyId,
    kind: v.kind,
    title: v.title || null,
    storage_path: path,
    is_public: v.isPublic === "on",
    expires_on: v.expiresOn || null,
    file_type: file.kind,
  });
  if (error) {
    await supabase.storage.from("company-documents").remove([path]);
    console.error("Document insert failed:", error.code, error.message);
    return fail("docErrorGeneric");
  }
  redirect(`/${locale}/company?tab=documents&doc=added`);
}

export async function deleteDocument(formData: FormData) {
  const { locale, supabase, companyId } = await producerCompany(formData);
  const id = text(formData, "id");
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const { data: doc } = await supabase.from("company_documents").select("id, storage_path, is_public, review_status").eq("id", id).eq("company_id", companyId).maybeSingle();
    if (doc) {
      const { error } = await supabase.from("company_documents").delete().eq("id", doc.id);
      if (!error && doc.storage_path.startsWith(`${companyId}/`)) await supabase.storage.from("company-documents").remove([doc.storage_path]);
      if (!error && doc.is_public && doc.review_status === "accepted") updateTag("producers");
    }
  }
  redirect(`/${locale}/company?tab=documents&doc=deleted`);
}
