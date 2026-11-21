import "server-only";
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { CURRENCIES, parseAmount } from "@/lib/onboarding/reference";
import { documentContentType, readDocument } from "@/lib/images";
import { INCOTERMS } from "@/lib/incoterms";

// Lecture et validation d'un devis producteur, communes au producteur (lot 5c)
// et a AFRICA NEX quand il saisit le devis d'un producteur hors ligne (lot 5d).

export type QuoteField = "currency" | "unitPrice" | "priceBasis" | "port" | "quantity" | "leadDays" | "availableOn" | "paymentTerms" | "validUntil" | "notes" | "file";
// Cles de traduction (espace "requests") ; values : saisie renvoyee en cas d'erreur.
export type QuoteState = { errors: Partial<Record<QuoteField, string>>; formError?: string; values?: Record<string, string>; attempt?: number };

const BASES: readonly string[] = INCOTERMS;
const MAX_FILE = 4 * 1024 * 1024;
const KEYS = ["currency", "unitPrice", "priceBasis", "port", "quantity", "leadDays", "availableOn", "paymentTerms", "validUntil", "notes"];

export async function readQuoteForm(formData: FormData) {
  const v = Object.fromEntries(KEYS.map((k) => [k, String(formData.get(k) ?? "").trim()]));
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

  const fields = {
    unit_price_ht: unitPrice ?? 0,
    currency: v.currency,
    price_basis: v.priceBasis,
    port_of_loading: v.port || null,
    quantity: quantity ?? 0,
    production_lead_days: leadDays,
    available_at_port_on: v.availableOn || null,
    payment_terms: v.paymentTerms || null,
    valid_until: v.validUntil,
    notes: v.notes || null,
    status: "submitted",
  };
  const upload = file && !("error" in file) ? file : null;
  return { values: v, errors, fields, upload };
}

type Upload = NonNullable<Awaited<ReturnType<typeof readQuoteForm>>["upload"]>;

// Fiche technique ou bulletin d'analyse : rangee sous dispatch/<envoi>/ (politique de stockage).
export async function storeQuoteFile(supabase: SupabaseClient<Database>, dispatchId: string, quoteId: string, upload: Upload, original: File) {
  const safeName = original.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80) || `piece.${upload.kind}`;
  const path = `dispatch/${dispatchId}/${randomBytes(4).toString("hex")}-${safeName}`;
  const type = documentContentType(upload.kind);
  const { error } = await supabase.storage.from("rfq-files").upload(path, upload.bytes, { contentType: type, upsert: false });
  if (error) { console.error("Quote attachment upload failed:", error.message); return; }
  await supabase.from("quotes").update({ attachments: [{ path, name: original.name.slice(0, 120), size: upload.bytes.length, type }] }).eq("id", quoteId);
}
