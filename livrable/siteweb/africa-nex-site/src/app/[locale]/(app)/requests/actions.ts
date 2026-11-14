"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";
import { getMyCompanyId } from "@/lib/data/company";
import { CURRENCIES, parseAmount } from "@/lib/onboarding/reference";
import { documentContentType, readDocument } from "@/lib/images";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;
const BASES = ["FOB", "FCA", "EXW"];
const MAX_FILE = 4 * 1024 * 1024;

export type QuoteField = "currency" | "unitPrice" | "priceBasis" | "port" | "quantity" | "leadDays" | "availableOn" | "paymentTerms" | "validUntil" | "notes" | "file";
// Cles de traduction (espace "requests") ; values : saisie renvoyee en cas d'erreur.
export type QuoteState = { errors: Partial<Record<QuoteField, string>>; formError?: string; values?: Record<string, string>; attempt?: number };

async function producerContext(formData: FormData) {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);
  const companyId = await getMyCompanyId(user.supabase, user.userId);
  if (!companyId) redirect(`/${locale}/onboarding`);
  return { locale, supabase: user.supabase, userId: user.userId, companyId };
}

// Devis du producteur vers AFRICA NEX (jamais transmis tel quel a l'acheteur).
// Premier envoi : creation ; ensuite : mise a jour tant qu'AFRICA NEX ne l'a pas retenu (RLS).
export async function submitQuote(_prev: QuoteState, formData: FormData): Promise<QuoteState> {
  const { locale, supabase, userId, companyId } = await producerContext(formData);
  const id = text(formData, "id");
  if (!UUID.test(id)) redirect(`/${locale}/requests`);
  const v = Object.fromEntries(["currency", "unitPrice", "priceBasis", "port", "quantity", "leadDays", "availableOn", "paymentTerms", "validUntil", "notes"].map((k) => [k, text(formData, k)]));
  const fail = (s: Omit<QuoteState, "values" | "attempt">): QuoteState => ({ ...s, values: v, attempt: Date.now() });

  const errors: QuoteState["errors"] = {};
  const today = new Date().toISOString().slice(0, 10);
  if (!(CURRENCIES as readonly string[]).includes(v.currency)) errors.currency = "errorChoose";
  const unitPrice = parseAmount(v.unitPrice);
  if (unitPrice === null || unitPrice <= 0) errors.unitPrice = "errorPrice";
  if (!BASES.includes(v.priceBasis)) errors.priceBasis = "errorChoose";
  if (v.port.length > 120) errors.port = "errorTooLong";
  const quantity = parseAmount(v.quantity);
  if (quantity === null || quantity <= 0) errors.quantity = "errorQuantity";
  const leadDays = /^\d{1,3}$/.test(v.leadDays) ? Number(v.leadDays) : NaN;
  if (!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 365) errors.leadDays = "errorLeadDays";
  if (v.availableOn && (!/^\d{4}-\d{2}-\d{2}$/.test(v.availableOn) || v.availableOn < today)) errors.availableOn = "errorDate";
  if (v.paymentTerms.length > 500) errors.paymentTerms = "errorTooLong";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.validUntil) || v.validUntil < today) errors.validUntil = "errorValidUntil";
  if (v.notes.length > 5000) errors.notes = "errorTooLong";
  const file = await readDocument(formData.get("file"), MAX_FILE);
  if (file && "error" in file) errors.file = file.error === "size" ? "errorFileSize" : "errorFileType";
  if (Object.keys(errors).length) return fail({ errors });

  const { data: dispatch } = await supabase.from("rfq_dispatches").select("id, status, quotes(id, status, attachments)").eq("id", id).eq("company_id", companyId).maybeSingle();
  if (!dispatch) redirect(`/${locale}/requests`);
  const q = dispatch.quotes as unknown;
  const existing = (Array.isArray(q) ? q[0] : q) as { id: string; status: string; attachments: unknown } | null | undefined;
  if (dispatch.status === "declined" || dispatch.status === "expired" || (existing && existing.status !== "submitted" && existing.status !== "draft")) {
    return fail({ errors: {}, formError: "errorLocked" });
  }

  const fields = {
    unit_price_ht: unitPrice!,
    currency: v.currency,
    price_basis: v.priceBasis,
    port_of_loading: v.port || null,
    quantity: quantity!,
    production_lead_days: leadDays,
    available_at_port_on: v.availableOn || null,
    payment_terms: v.paymentTerms || null,
    valid_until: v.validUntil,
    notes: v.notes || null,
    status: "submitted",
  };
  let quoteId = existing?.id ?? null;
  if (existing) {
    const { error } = await supabase.from("quotes").update(fields).eq("id", existing.id);
    if (error) { console.error("Quote update failed:", error.message); return fail({ errors: {}, formError: "errorGeneric" }); }
  } else {
    const { data: created, error } = await supabase.from("quotes").insert({ ...fields, dispatch_id: id, company_id: companyId, author_profile_id: userId }).select("id").single();
    if (error || !created) { console.error("Quote insert failed:", error?.code, error?.message); return fail({ errors: {}, formError: "errorGeneric" }); }
    quoteId = created.id;
  }

  // Fiche technique ou bulletin d'analyse : rangee sous dispatch/<envoi>/ (politique de stockage).
  if (file && !("error" in file) && quoteId) {
    const original = formData.get("file") as File;
    const safeName = original.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80) || `piece.${file.kind}`;
    const path = `dispatch/${id}/${randomBytes(4).toString("hex")}-${safeName}`;
    const type = documentContentType(file.kind);
    const { error: upError } = await supabase.storage.from("rfq-files").upload(path, file.bytes, { contentType: type, upsert: false });
    if (upError) console.error("Quote attachment upload failed:", upError.message);
    else await supabase.from("quotes").update({ attachments: [{ path, name: original.name.slice(0, 120), size: file.bytes.length, type }] }).eq("id", quoteId);
  }

  redirect(`/${locale}/requests/${id}?sent=${existing ? "update" : "new"}`);
}

// Le producteur decline la demande (possible tant qu'il n'a pas envoye de devis).
export async function declineRequest(formData: FormData) {
  const { locale, supabase, companyId } = await producerContext(formData);
  const id = text(formData, "id");
  if (!UUID.test(id)) redirect(`/${locale}/requests`);
  const { error } = await supabase.from("rfq_dispatches").update({ status: "declined" }).eq("id", id).eq("company_id", companyId).in("status", ["sent", "viewed"]);
  if (error) console.error("Dispatch decline failed:", error.message);
  redirect(`/${locale}/requests/${id}?declined=1`);
}
