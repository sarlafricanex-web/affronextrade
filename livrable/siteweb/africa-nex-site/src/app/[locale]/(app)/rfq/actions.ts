"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";
import { getMyCompanyId } from "@/lib/data/company";
import { getRfqContext, INCOTERMS, RFQ_MAX_FILE_BYTES } from "@/lib/data/rfq";
import { isCountryCode } from "@/lib/countries";
import { CURRENCIES, UNITS, parseAmount } from "@/lib/onboarding/reference";
import { documentContentType, readDocument } from "@/lib/images";

export type RfqField =
  | "title" | "quantity" | "unit" | "containerCount" | "containerSize" | "country" | "port"
  | "incoterm" | "targetPrice" | "currency" | "neededBy" | "description" | "file";
export type RfqValues = Record<string, string>;
// Cles de traduction (espace "rfq") ; values : saisie renvoyee en cas d'erreur.
export type RfqState = { errors: Partial<Record<RfqField, string>>; formError?: string; values?: RfqValues; attempt?: number };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const FIELDS = ["title", "mode", "quantity", "unit", "containerCount", "containerSize", "reefer", "country", "port", "incoterm", "targetPrice", "currency", "neededBy", "description", "productId", "producer"];

// Nouvelle demande de devis. Tout est revalide ici ; la RLS verifie en plus le role et l'entreprise.
export async function createRfq(_prev: RfqState, formData: FormData): Promise<RfqState> {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "buyer") redirect(`/${locale}/dashboard`);

  const v: RfqValues = Object.fromEntries(FIELDS.map((k) => [k, text(formData, k)]));
  const fail = (s: Omit<RfqState, "values" | "attempt">): RfqState => ({ ...s, values: v, attempt: Date.now() });
  const errors: RfqState["errors"] = {};

  if (v.title.length < 2 || v.title.length > 200) errors.title = "errorTitle";
  const containers = v.mode === "containers";
  let quantity: number | null = null;
  let containerCount: number | null = null;
  if (containers) {
    containerCount = /^\d{1,3}$/.test(v.containerCount) ? Number(v.containerCount) : NaN;
    if (!Number.isInteger(containerCount) || containerCount < 1 || containerCount > 100) errors.containerCount = "errorContainerCount";
    if (v.containerSize !== "20" && v.containerSize !== "40") errors.containerSize = "errorChoose";
  } else {
    quantity = parseAmount(v.quantity);
    if (quantity === null || quantity <= 0) errors.quantity = "errorQuantity";
    if (!(UNITS as readonly string[]).includes(v.unit)) errors.unit = "errorChoose";
  }
  const country = v.country.toUpperCase();
  if (!isCountryCode(country)) errors.country = "errorChoose";
  if (v.port.length > 120) errors.port = "errorTooLong";
  if (!(INCOTERMS as readonly string[]).includes(v.incoterm)) errors.incoterm = "errorChoose";
  let targetPrice: number | null = null;
  if (v.targetPrice) {
    targetPrice = parseAmount(v.targetPrice);
    if (targetPrice === null || targetPrice <= 0) errors.targetPrice = "errorPrice";
    if (!(CURRENCIES as readonly string[]).includes(v.currency)) errors.currency = "errorChoose";
  }
  if (v.neededBy) {
    const today = new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.neededBy) || v.neededBy < today) errors.neededBy = "errorDate";
  }
  if (v.description.length > 5000) errors.description = "errorTooLong";
  const file = await readDocument(formData.get("file"), RFQ_MAX_FILE_BYTES);
  if (file && "error" in file) errors.file = file.error === "size" ? "errorFileSize" : "errorFileType";
  if (Object.keys(errors).length) return fail({ errors });

  const { supabase, userId } = user;
  // Profil acheteur complet exige (entreprise, pays, contacts) : AFRICA NEX doit pouvoir qualifier.
  const [{ data: profile }, companyId, context] = await Promise.all([
    supabase.from("profiles").select("onboarding_completed").eq("id", userId).single(),
    getMyCompanyId(supabase, userId),
    getRfqContext(supabase, { productId: v.productId || undefined, producerSlug: v.producer || undefined }),
  ]);
  if (!profile?.onboarding_completed || !companyId) return fail({ errors: {}, formError: "errorProfile" });

  const { data: created, error } = await supabase
    .from("rfqs")
    .insert({
      buyer_profile_id: userId,
      buyer_company_id: companyId,
      product_id: context?.productId ?? null,
      source_company_id: context?.companyId ?? null,
      title: v.title,
      description: v.description || null,
      quantity_mode: containers ? "containers" : "units",
      quantity,
      unit: containers ? (context?.unit ?? null) : v.unit,
      container_size: containers ? v.containerSize : null,
      container_reefer: containers && v.reefer === "on",
      container_count: containerCount,
      incoterm: v.incoterm,
      destination_country: country,
      destination_port: v.port || null,
      target_unit_price: targetPrice,
      currency: targetPrice !== null ? v.currency : null,
      needed_by: v.neededBy || null,
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("RFQ insert failed:", error?.code, error?.message);
    return fail({ errors: {}, formError: "errorGeneric" });
  }

  // Piece jointe : rangee sous buyer/<demande>/ ; la politique de stockage verifie que la demande est a lui.
  if (file && !("error" in file)) {
    const original = formData.get("file") as File;
    const safeName = original.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80) || `piece.${file.kind}`;
    const path = `buyer/${created.id}/${randomBytes(4).toString("hex")}-${safeName}`;
    const type = documentContentType(file.kind);
    const { error: upError } = await supabase.storage.from("rfq-files").upload(path, file.bytes, { contentType: type, upsert: false });
    if (upError) console.error("RFQ attachment upload failed:", upError.message);
    else await supabase.from("rfqs").update({ attachments: [{ path, name: original.name.slice(0, 120), size: file.bytes.length, type }] }).eq("id", created.id);
  }

  redirect(`/${locale}/rfq/${created.id}?sent=1`);
}

// Annulation par l'acheteur, possible tant qu'AFRICA NEX n'a pas qualifie la demande (RLS).
export async function cancelRfq(formData: FormData) {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const id = text(formData, "id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect(`/${locale}/rfq`);
  const { error } = await user.supabase.from("rfqs").update({ status: "cancelled" }).eq("id", id).eq("buyer_profile_id", user.userId).eq("status", "submitted");
  if (error) console.error("RFQ cancel failed:", error.message);
  redirect(`/${locale}/rfq/${id}?cancelled=1`);
}
