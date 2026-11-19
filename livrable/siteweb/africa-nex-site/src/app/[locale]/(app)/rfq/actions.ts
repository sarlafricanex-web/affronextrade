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
// Cles de traduction (espace "rfq") ; values : saisie renvoyee en cas d'erreur (lignes en JSON).
// lineErrors : erreurs par ligne (index -> champ -> cle).
export type RfqState = {
  errors: Partial<Record<RfqField, string>>;
  lineErrors?: Record<number, Record<string, string>>;
  formError?: string;
  values?: RfqValues;
  attempt?: number;
};

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const FIELDS = ["mode", "containerCount", "containerSize", "reefer", "country", "port", "incoterm", "targetPrice", "currency", "neededBy", "description", "productId", "producer"];
const MAX_LINES = 50;

// Nouvelle demande de devis. Tout est revalide ici ; la RLS verifie en plus le role et l'entreprise.
export async function createRfq(_prev: RfqState, formData: FormData): Promise<RfqState> {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "buyer") redirect(`/${locale}/dashboard`);

  const v: RfqValues = Object.fromEntries(FIELDS.map((k) => [k, text(formData, k)]));
  const containers = v.mode === "containers";

  // Lignes : designation obligatoire ; quantite et unite obligatoires sauf en mode conteneurs.
  const all = (k: string) => formData.getAll(k).map((x) => String(x).trim());
  const [descs, refs, qtys, units] = [all("lineDesc"), all("lineRef"), all("lineQty"), all("lineUnit")];
  const raw = descs.map((desc, i) => ({ desc, ref: refs[i] ?? "", qty: qtys[i] ?? "", unit: units[i] ?? "" })).filter((l) => l.desc || l.ref || l.qty);
  v.lines = JSON.stringify(raw);
  const fail = (s: Omit<RfqState, "values" | "attempt">): RfqState => ({ ...s, values: v, attempt: Date.now() });
  const errors: RfqState["errors"] = {};
  const lineErrors: NonNullable<RfqState["lineErrors"]> = {};
  if (!raw.length || raw.length > MAX_LINES) errors.title = raw.length ? "errorTooManyLines" : "errorTitle";
  const lines = raw.map((l, i) => {
    const e: Record<string, string> = {};
    if (l.desc.length < 2 || l.desc.length > 300) e.description = "errorTitle";
    if (l.ref.length > 60) e.reference = "errorTooLong";
    const q = l.qty ? parseAmount(l.qty) : null;
    if (l.qty && (q === null || q <= 0)) e.quantity = "errorQuantity";
    if (!containers && !l.qty) e.quantity = "errorQuantity";
    if ((!containers || l.qty) && !(UNITS as readonly string[]).includes(l.unit)) e.unit = "errorChoose";
    if (Object.keys(e).length) lineErrors[i] = e;
    return { description: l.desc, reference: l.ref || null, quantity: q, unit: l.unit || null };
  });

  let containerCount: number | null = null;
  if (containers) {
    containerCount = /^\d{1,3}$/.test(v.containerCount) ? Number(v.containerCount) : NaN;
    if (!Number.isInteger(containerCount) || containerCount < 1 || containerCount > 100) errors.containerCount = "errorContainerCount";
    if (v.containerSize !== "20" && v.containerSize !== "40") errors.containerSize = "errorChoose";
  }
  // Devise de l'offre : choisie par l'acheteur, obligatoire (aucune devise par defaut).
  if (!(CURRENCIES as readonly string[]).includes(v.currency)) errors.currency = "errorChoose";
  const country = v.country.toUpperCase();
  if (!isCountryCode(country)) errors.country = "errorChoose";
  if (v.port.length > 120) errors.port = "errorTooLong";
  if (!(INCOTERMS as readonly string[]).includes(v.incoterm)) errors.incoterm = "errorChoose";
  let targetPrice: number | null = null;
  if (v.targetPrice) {
    targetPrice = parseAmount(v.targetPrice);
    if (targetPrice === null || targetPrice <= 0) errors.targetPrice = "errorPrice";
  }
  if (v.neededBy) {
    const today = new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.neededBy) || v.neededBy < today) errors.neededBy = "errorDate";
  }
  if (v.description.length > 5000) errors.description = "errorTooLong";
  const file = await readDocument(formData.get("file"), RFQ_MAX_FILE_BYTES);
  if (file && "error" in file) errors.file = file.error === "size" ? "errorFileSize" : "errorFileType";
  if (Object.keys(errors).length || Object.keys(lineErrors).length) return fail({ errors, lineErrors });

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
      // Titre : la 1re ligne, suivie du nombre d'autres produits ; quantite d'en-tete pour une seule ligne.
      title: (lines.length > 1 ? `${lines[0].description} (+${lines.length - 1})` : lines[0].description).slice(0, 200),
      description: v.description || null,
      quantity_mode: containers ? "containers" : "units",
      quantity: lines.length === 1 && !containers ? lines[0].quantity : null,
      unit: containers ? (context?.unit ?? null) : lines.length === 1 ? lines[0].unit : null,
      container_size: containers ? v.containerSize : null,
      container_reefer: containers && v.reefer === "on",
      container_count: containerCount,
      incoterm: v.incoterm,
      destination_country: country,
      destination_port: v.port || null,
      target_unit_price: targetPrice,
      currency: v.currency,
      needed_by: v.neededBy || null,
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("RFQ insert failed:", error?.code, error?.message);
    return fail({ errors: {}, formError: "errorGeneric" });
  }

  // Lignes de la demande (la 1re garde le produit choisi depuis une fiche).
  const { error: linesError } = await supabase.from("rfq_lines").insert(
    lines.map((l, i) => ({ rfq_id: created.id, position: i + 1, product_id: i === 0 ? (context?.productId ?? null) : null, ...l })),
  );
  if (linesError) {
    console.error("RFQ lines insert failed:", linesError.code, linesError.message);
    await supabase.from("rfqs").update({ status: "cancelled" }).eq("id", created.id);
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

// Lot 5e : decision de l'acheteur sur une offre AFRICA NEX, offre par offre. Les fonctions en base
// verifient que l'offre est publiee, encore valable, et qu'elle appartient a une demande de l'acheteur.
//   accept   : l'offre est acceptee, ses alternatives (memes produits) sont ecartees ;
//   decline  : l'offre n'est pas retenue (motif facultatif) ;
//   currency : demande d'une autre devise, traitee par AFRICA NEX (l'offre reste publiee).
export async function decideOffer(formData: FormData) {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "buyer") redirect(`/${locale}/dashboard`);
  const rfqId = text(formData, "rfqId");
  const offerId = text(formData, "offerId");
  const op = text(formData, "op");
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(rfqId) || !uuid.test(offerId) || !["accept", "decline", "currency"].includes(op)) redirect(`/${locale}/rfq`);
  const back = (done: string) => redirect(`/${locale}/rfq/${rfqId}?offer=${done}#offers`);

  let error: { message: string } | null = null;
  if (op === "accept") {
    ({ error } = await user.supabase.rpc("accept_offer", { p_offer_id: offerId }));
  } else if (op === "decline") {
    ({ error } = await user.supabase.rpc("decline_offer", { p_offer_id: offerId, p_reason: text(formData, "reason").slice(0, 500) }));
  } else {
    const currency = text(formData, "currency");
    if (!(CURRENCIES as readonly string[]).includes(currency)) back("currencyInvalid");
    ({ error } = await user.supabase.rpc("request_offer_currency", { p_offer_id: offerId, p_currency: currency, p_note: text(formData, "note").slice(0, 500) }));
  }
  if (error) {
    if (/invalid currency/.test(error.message)) back("currencyInvalid");
    if (!/offer not available/.test(error.message)) console.error("Offer decision failed:", op, error.message);
    back("unavailable");
  }
  back(op === "accept" ? "accepted" : op === "decline" ? "declined" : "currencyRequested");
}
