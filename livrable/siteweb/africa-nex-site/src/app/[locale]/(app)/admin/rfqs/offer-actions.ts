"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";
import { parseAmount } from "@/lib/onboarding/reference";
import { readQuoteForm, storeQuoteFile, type QuoteState } from "@/lib/quote-input";
import { priceOffer } from "@/lib/offer-pricing";
import { autoOffersPayload, computeRfqAutoOffers } from "@/lib/data/auto-offer";
import { getAutoOfferEditor } from "@/lib/data/admin-rfqs";
import { OFFER_VALIDITY_DAYS } from "@/lib/offer-auto";
import { repriceOffer, type MarginInput } from "@/lib/offer-reprice";
import { notify } from "@/lib/notify";
import { frDate, money } from "@/lib/notify/format";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;
const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"];
const WITH_FREIGHT = ["CFR", "CIF", "DAP", "DDP"];
const one = <T,>(x: unknown) => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null)) as T | null;

async function adminContext(formData: FormData) {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);
  return { locale, supabase: user.supabase, userId: user.userId };
}

// AFRICA NEX saisit le devis d'un producteur joint hors ligne (fiche non revendiquee,
// telephone, salon...). Memes regles que le formulaire du producteur.
export async function enterQuote(_prev: QuoteState, formData: FormData): Promise<QuoteState> {
  const { locale, supabase, userId } = await adminContext(formData);
  const id = text(formData, "id");
  if (!UUID.test(id)) redirect(`/${locale}/admin/rfqs`);
  const { values, errors, fields, upload } = await readQuoteForm(formData);
  const fail = (s: Omit<QuoteState, "values" | "attempt">): QuoteState => ({ ...s, values, attempt: Date.now() });
  if (Object.keys(errors).length) return fail({ errors });

  const { data: dispatch } = await supabase.from("rfq_dispatches").select("id, rfq_id, company_id, status, quotes(id, status)").eq("id", id).maybeSingle();
  if (!dispatch) redirect(`/${locale}/admin/rfqs`);
  const existing = one<{ id: string; status: string }>(dispatch.quotes);
  if (dispatch.status === "expired" || (existing && existing.status !== "submitted" && existing.status !== "draft")) return fail({ errors: {}, formError: "errorLocked" });

  let quoteId = existing?.id ?? null;
  if (existing) {
    const { error } = await supabase.from("quotes").update(fields).eq("id", existing.id);
    if (error) { console.error("Admin quote update failed:", error.message); return fail({ errors: {}, formError: "errorGeneric" }); }
  } else {
    // Un producteur qui avait decline peut finalement repondre par telephone.
    if (dispatch.status === "declined") await supabase.from("rfq_dispatches").update({ status: "viewed" }).eq("id", id);
    const { data: created, error } = await supabase.from("quotes").insert({ ...fields, dispatch_id: id, company_id: dispatch.company_id, author_profile_id: userId }).select("id").single();
    if (error || !created) { console.error("Admin quote insert failed:", error?.code, error?.message); return fail({ errors: {}, formError: "errorGeneric" }); }
    quoteId = created.id;
  }
  if (upload && quoteId) await storeQuoteFile(supabase, id, quoteId, upload, formData.get("file") as File);
  await supabase.from("audit_log").insert({ actor_profile_id: userId, action: "quote.enter", entity: "quote", entity_id: quoteId, payload: { dispatch: id } });
  redirect(`/${locale}/admin/rfqs/${dispatch.rfq_id}?done=quote`);
}

export type OfferField =
  | "label" | "producerPrice" | "quantity" | "incoterm" | "incotermPlace" | "commissionRate" | "insuranceRate" | "freight"
  | "leadDays" | "originRegion" | "packaging" | "certifications" | "paymentTerms" | "validUntil" | "notes";
export type OfferState = { errors: Partial<Record<OfferField, string>>; formError?: string; values?: Record<string, string>; attempt?: number };

const OFFER_KEYS: OfferField[] = ["label", "producerPrice", "quantity", "incoterm", "incotermPlace", "commissionRate", "insuranceRate", "freight", "leadDays", "originRegion", "packaging", "certifications", "paymentTerms", "validUntil", "notes"];

// Offre AFRICA NEX a l'acheteur, composee a partir d'un devis producteur. Le prix est
// toujours recalcule ici (le calculateur de l'ecran n'est qu'un apercu). La marge reste
// dans offer_margins, jamais visible de l'acheteur ni du producteur.
export async function saveOffer(_prev: OfferState, formData: FormData): Promise<OfferState> {
  const { locale, supabase, userId } = await adminContext(formData);
  const rfqId = text(formData, "rfqId");
  const quoteId = text(formData, "quoteId");
  if (!UUID.test(rfqId) || !UUID.test(quoteId)) redirect(`/${locale}/admin/rfqs`);
  const publish = text(formData, "intent") === "publish";
  const v = Object.fromEntries(OFFER_KEYS.map((k) => [k, text(formData, k)])) as Record<OfferField, string>;
  v.label = v.label.toUpperCase();
  const fail = (s: Omit<OfferState, "values" | "attempt">): OfferState => ({ ...s, values: v, attempt: Date.now() });

  const errors: OfferState["errors"] = {};
  const today = new Date().toISOString().slice(0, 10);
  const rate = (s: string) => { const n = parseAmount(s); return n !== null && n >= 0 && n <= 100 ? n : null; };
  if (!/^[A-Z0-9]{1,20}$/.test(v.label)) errors.label = "offerErrorLabel";
  const producerPrice = parseAmount(v.producerPrice);
  if (producerPrice === null || producerPrice <= 0) errors.producerPrice = "offerErrorPrice";
  const quantity = parseAmount(v.quantity);
  if (quantity === null || quantity <= 0) errors.quantity = "rfqErrorQuantity";
  if (!INCOTERMS.includes(v.incoterm)) errors.incoterm = "rfqErrorChoose";
  const commissionRate = rate(v.commissionRate);
  if (commissionRate === null) errors.commissionRate = "offerErrorRate";
  const insuranceRate = rate(v.insuranceRate);
  if (insuranceRate === null) errors.insuranceRate = "offerErrorRate";
  const freight = v.freight ? parseAmount(v.freight) : 0;
  if (freight === null || freight < 0) errors.freight = "offerErrorFreight";
  else if (WITH_FREIGHT.includes(v.incoterm) && !(freight > 0)) errors.freight = "offerErrorFreightNeeded";
  const leadDays = v.leadDays ? (/^\d{1,3}$/.test(v.leadDays) ? Number(v.leadDays) : NaN) : null;
  if (leadDays !== null && !Number.isInteger(leadDays)) errors.leadDays = "offerErrorLeadDays";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.validUntil) || v.validUntil < today) errors.validUntil = "offerErrorValidUntil";
  for (const k of ["incotermPlace", "originRegion", "packaging", "certifications"] as const) if (v[k].length > 200) errors[k] = "rfqErrorTooLong";
  if (v.paymentTerms.length > 500) errors.paymentTerms = "rfqErrorTooLong";
  if (v.notes.length > 5000) errors.notes = "rfqErrorTooLong";
  if (Object.keys(errors).length) return fail({ errors });

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, currency, status, company:companies(company_name, slug), dispatch:rfq_dispatches(rfq_id)")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote || one<{ rfq_id: string }>(quote.dispatch)?.rfq_id !== rfqId) return fail({ errors: {}, formError: "offerErrorQuote" });
  const { data: rfq } = await supabase.from("rfqs").select("status").eq("id", rfqId).maybeSingle();
  if (!rfq || !["qualified", "dispatched", "offered"].includes(rfq.status)) return fail({ errors: {}, formError: "offerErrorRfqClosed" });

  // Garde-fou d'anonymat : l'offre ne doit jamais nommer le producteur.
  const producer = one<{ company_name: string; slug: string }>(quote.company);
  const offerText = [v.incotermPlace, v.originRegion, v.packaging, v.certifications, v.paymentTerms, v.notes].join("\n").toLowerCase();
  if ((producer?.company_name ?? "").length >= 3 && offerText.includes(producer!.company_name.toLowerCase())) return fail({ errors: { notes: "offerErrorLeak" } });

  const price = priceOffer({ producerUnitPrice: producerPrice!, quantity: quantity!, commissionRate: commissionRate!, insuranceRate: insuranceRate!, freight: freight! });
  const offerRow = {
    rfq_id: rfqId,
    label: v.label,
    unit_price: price.unitPrice,
    currency: quote.currency,
    incoterm: v.incoterm,
    incoterm_place: v.incotermPlace || null,
    quantity: quantity!,
    total_amount: price.total,
    lead_time_days: leadDays,
    origin_region: v.originRegion || null,
    packaging: v.packaging || null,
    certifications: v.certifications || null,
    payment_terms: v.paymentTerms || null,
    cagex_insured: insuranceRate! > 0,
    valid_until: v.validUntil,
    notes: v.notes || null,
  };

  // Une offre par devis : on retrouve celle deja composee depuis ce devis.
  const { data: margin } = await supabase.from("offer_margins").select("offer_id, offers(status)").eq("source_quote_id", quoteId).maybeSingle();
  const current = one<{ status: string }>(margin?.offers);
  if (current && current.status !== "draft") return fail({ errors: {}, formError: "offerErrorNotDraft" });

  let offerId = margin?.offer_id ?? null;
  if (offerId) {
    const { error } = await supabase.from("offers").update(offerRow).eq("id", offerId);
    if (error) return fail(error.code === "23505" ? { errors: { label: "offerErrorLabelTaken" } } : { errors: {}, formError: "rfqErrorGeneric" });
  } else {
    const { data: created, error } = await supabase.from("offers").insert({ ...offerRow, created_by: userId }).select("id").single();
    if (error || !created) {
      if (error?.code !== "23505") console.error("Offer insert failed:", error?.message);
      return fail(error?.code === "23505" ? { errors: { label: "offerErrorLabelTaken" } } : { errors: {}, formError: "rfqErrorGeneric" });
    }
    offerId = created.id;
  }
  const { error: marginError } = await supabase.from("offer_margins").upsert({
    offer_id: offerId,
    source_quote_id: quoteId,
    producer_unit_price: producerPrice!,
    producer_currency: quote.currency,
    freight_cost: price.freight,
    insurance_rate: insuranceRate!,
    insurance_cost: price.insurance,
    commission_rate: commissionRate!,
    commission_amount: price.commission,
  });
  if (marginError) { console.error("Offer margin failed:", marginError.message); return fail({ errors: {}, formError: "rfqErrorGeneric" }); }

  if (publish && !(await publishOffer(supabase, offerId, rfqId, quoteId))) redirect(`/${locale}/admin/rfqs/${rfqId}?done=offerPending`);
  await supabase.from("audit_log").insert({
    actor_profile_id: userId,
    action: publish ? "offer.publish" : "offer.save",
    entity: "offer",
    entity_id: offerId,
    payload: { rfq: rfqId, quote: quoteId, unit_price: price.unitPrice, commission_rate: commissionRate, insurance_rate: insuranceRate, freight: price.freight },
  });
  redirect(`/${locale}/admin/rfqs/${rfqId}?done=${publish ? "offerPublished" : "offerSaved"}`);
}

type Client = Awaited<ReturnType<typeof adminContext>>["supabase"];

// Publication : l'acheteur voit l'offre, la demande passe "offres pretes", le devis source est retenu.
// Refusee par la base si la marge (export AFRICA NEX) ou le fret restent a saisir : rien d'autre ne bouge.
async function publishOffer(supabase: Client, offerId: string, rfqId: string, quoteId: string | null) {
  const { error } = await supabase.from("offers").update({ status: "published", published_at: new Date().toISOString() }).eq("id", offerId).eq("status", "draft");
  if (error) return false;
  await supabase.from("rfqs").update({ status: "offered" }).eq("id", rfqId).in("status", ["qualified", "dispatched"]);
  if (quoteId) await supabase.from("quotes").update({ status: "selected" }).eq("id", quoteId).eq("status", "submitted");
  // Email a l'acheteur : une offre l'attend (sans aucun nom de producteur).
  const [{ data: rfq }, { data: offer }] = await Promise.all([
    supabase.from("rfqs").select("buyer_profile_id, reference, title").eq("id", rfqId).maybeSingle(),
    supabase.from("offers").select("label, total_amount, currency, valid_until").eq("id", offerId).maybeSingle(),
  ]);
  if (rfq && offer) {
    notify.profile(rfq.buyer_profile_id, {
      kind: "offer_ready",
      rfqId,
      path: `/rfq/${rfqId}#offers`,
      values: { reference: rfq.reference, title: rfq.title, label: offer.label },
      rows: [["rowReference", rfq.reference], ["rowOffer", offer.label], ["rowTotal", money(offer.total_amount, offer.currency)], ["rowValidUntil", frDate(offer.valid_until)]],
    });
  }
  return true;
}

// Lot 6c : offre calculee depuis la liste de prix. Une offre par couple (mode, devise), en brouillon ;
// un nouveau calcul remplace les brouillons automatiques de la demande. Le calcul est refait ici,
// l'apercu de l'ecran n'est qu'indicatif.
export async function createAutoOffers(formData: FormData) {
  const { locale, supabase, userId } = await adminContext(formData);
  const rfqId = text(formData, "rfqId");
  if (!UUID.test(rfqId)) redirect(`/${locale}/admin/rfqs`);
  const back = (done: string, count = 0) => redirect(`/${locale}/admin/rfqs/${rfqId}?done=${done}${count ? `&count=${count}` : ""}`);

  const result = await computeRfqAutoOffers(supabase, rfqId);
  if (!result || !result.offers.length) back("autoNothing");

  // Lettres libres : celles des offres composees a la main et des offres deja publiees restent prises.
  const { data: existing } = await supabase.from("offers").select("label, status, offer_margins(auto)").eq("rfq_id", rfqId);
  const taken = new Set((existing ?? []).filter((o) => !(o.status === "draft" && one<{ auto: boolean }>(o.offer_margins)?.auto)).map((o) => o.label));
  const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter((l) => !taken.has(l));
  if (labels.length < result!.offers.length) back("autoNoLabel");

  const { data: count, error } = await supabase.rpc("save_auto_offers", { p_rfq: rfqId, p_offers: autoOffersPayload(result!.offers, labels) });
  if (error) {
    if (/auto offer already published/.test(error.message)) back("autoPublished");
    if (/rfq closed/.test(error.message)) back("autoClosed");
    console.error("Auto offers failed:", error.code, error.message);
    back("autoError");
  }
  await supabase.from("audit_log").insert({
    actor_profile_id: userId,
    action: "offer.auto",
    entity: "rfq",
    entity_id: rfqId,
    payload: { offers: count, lines: result!.offers.reduce((s, o) => s + o.lines.length, 0), skipped: result!.skipped.length, commission_rate: result!.commissionRate },
  });
  back("autoCreated", Number(count) || 0);
}

// Lot 6d : devis retenu pour une ligne (sinon le calcul prend le moins cher). quote = "auto" revient
// au choix automatique. Le devis doit repondre a un brief de cette ligne.
export async function chooseLineQuote(formData: FormData) {
  const { locale, supabase, userId } = await adminContext(formData);
  const rfqId = text(formData, "rfqId");
  const lineId = text(formData, "lineId");
  const quoteId = text(formData, "quote");
  if (!UUID.test(rfqId) || !UUID.test(lineId) || (quoteId !== "auto" && !UUID.test(quoteId))) redirect(`/${locale}/admin/rfqs`);
  const back = (done: string) => redirect(`/${locale}/admin/rfqs/${rfqId}?done=${done}`);
  if (quoteId === "auto") {
    await supabase.from("rfq_line_choices").delete().eq("rfq_line_id", lineId);
  } else {
    const { data: q } = await supabase.from("quotes").select("id, status, dispatch:rfq_dispatches(rfq_id, rfq_line_id)").eq("id", quoteId).maybeSingle();
    const d = one<{ rfq_id: string; rfq_line_id: string | null }>(q?.dispatch);
    if (!q || d?.rfq_id !== rfqId || d.rfq_line_id !== lineId || !["submitted", "selected"].includes(q.status)) back("lineQuoteInvalid");
    const { error } = await supabase.from("rfq_line_choices").upsert({ rfq_line_id: lineId, quote_id: quoteId, chosen_by: userId, chosen_at: new Date().toISOString() });
    if (error) { console.error("Line quote choice failed:", error.message); back("autoError"); }
  }
  await supabase.from("audit_log").insert({ actor_profile_id: userId, action: "rfq.line_quote", entity: "rfq", entity_id: rfqId, payload: { line: lineId, quote: quoteId } });
  back(quoteId === "auto" ? "lineQuoteAuto" : "lineQuoteChosen");
}

// Devis de producteurs utilises par les lignes d'une offre calculee : retenus a la publication,
// de nouveau en attente au retrait.
async function markLineQuotes(supabase: Client, offerId: string, status: "selected" | "submitted") {
  const { data } = await supabase.from("offer_lines").select("offer_line_margins(quote_id)").eq("offer_id", offerId);
  const ids = (data ?? []).map((l) => one<{ quote_id: string | null }>(l.offer_line_margins)?.quote_id).filter((q): q is string => !!q);
  if (ids.length) await supabase.from("quotes").update({ status }).in("id", ids).eq("status", status === "selected" ? "submitted" : "selected");
}

// Lot 6e : AFRICA NEX complete une offre calculee en brouillon. Commission (intermediation, modifiable
// offre par offre), marge negociee (export AFRICA NEX, en % ou en montant, secrete), fret (ligne
// separee, si AFRICA NEX le gere) et conditions presentees a l'acheteur. Les prix des lignes sont
// recalcules ici (l'apercu de l'ecran n'est qu'indicatif). Marge ou fret laisses vides restent
// "a saisir" : le brouillon s'enregistre, la publication est refusee.
export type AutoOfferField = "commissionRate" | "margin" | "freight" | "incotermPlace" | "validUntil" | "paymentTerms" | "notes";
export type AutoOfferState = { errors: Partial<Record<AutoOfferField, string>>; formError?: string; values?: Record<string, string>; attempt?: number };
const AUTO_KEYS = ["commissionRate", "marginKind", "margin", "freight", "incotermPlace", "validUntil", "paymentTerms", "notes"] as const;

export async function saveAutoOffer(_prev: AutoOfferState, formData: FormData): Promise<AutoOfferState> {
  const { locale, supabase, userId } = await adminContext(formData);
  const rfqId = text(formData, "rfqId");
  const offerId = text(formData, "offerId");
  if (!UUID.test(rfqId) || !UUID.test(offerId)) redirect(`/${locale}/admin/rfqs`);
  const publish = text(formData, "intent") === "publish";
  const v = Object.fromEntries(AUTO_KEYS.map((k) => [k, text(formData, k)])) as Record<(typeof AUTO_KEYS)[number], string>;
  const fail = (s: Omit<AutoOfferState, "values" | "attempt">): AutoOfferState => ({ ...s, values: v, attempt: Date.now() });

  const data = await getAutoOfferEditor(supabase, rfqId, offerId);
  if (!data) redirect(`/${locale}/admin/rfqs/${rfqId}`);
  const { offer, margin: m, today } = data;
  if (offer.status !== "draft") return fail({ errors: {}, formError: "offerErrorNotDraft" });
  if (!["qualified", "dispatched", "offered"].includes(data.rfq.status)) return fail({ errors: {}, formError: "offerErrorRfqClosed" });
  const mode = m.export_mode === "africanex" ? "africanex" : "self";
  const freightManaged = m.freight_pending || m.freight_cost != null;

  const errors: AutoOfferState["errors"] = {};
  let commissionRate = 0;
  if (mode === "self") {
    const r = parseAmount(v.commissionRate);
    if (r === null || r < 0 || r > 100) errors.commissionRate = "offerErrorRate";
    else commissionRate = r;
  }
  let marginInput: MarginInput = null;
  if (mode === "africanex" && v.margin) {
    const n = parseAmount(v.margin);
    const kind = v.marginKind === "amount" ? "amount" : "rate";
    if (n === null || n < 0 || (kind === "rate" && n > 1000)) errors.margin = kind === "rate" ? "autoEditErrorMarginRate" : "autoEditErrorMarginAmount";
    else marginInput = { kind, value: n };
  }
  let freight: number | null = null;
  if (freightManaged && v.freight) {
    const n = parseAmount(v.freight);
    if (n === null || n < 0) errors.freight = "offerErrorFreight";
    else if (n === 0 && WITH_FREIGHT.includes(offer.incoterm ?? "")) errors.freight = "offerErrorFreightNeeded";
    else freight = n;
  }
  if (publish && mode === "africanex" && !marginInput && !errors.margin) errors.margin = "autoEditMarginNeeded";
  if (publish && freightManaged && freight === null && !errors.freight) errors.freight = "autoEditFreightNeeded";
  const maxValid = new Date(Date.parse(`${today}T12:00:00Z`) + OFFER_VALIDITY_DAYS * 864e5).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.validUntil) || v.validUntil < today || v.validUntil > maxValid) errors.validUntil = "autoEditErrorValidity";
  if (v.incotermPlace.length > 200) errors.incotermPlace = "rfqErrorTooLong";
  if (v.paymentTerms.length > 500) errors.paymentTerms = "rfqErrorTooLong";
  if (v.notes.length > 5000) errors.notes = "rfqErrorTooLong";
  if (Object.keys(errors).length) return fail({ errors });

  // Garde-fou d'anonymat : aucun fournisseur de l'offre ne doit etre nomme.
  type LineMargin = { base_amount: number; insurance_rate: number; fx_margin_rate: number; commission_rate: number; max_discount_rate: number | null; company: { company_name: string } | { company_name: string }[] | null };
  const lines = (offer.offer_lines ?? []).map((l) => ({ ...l, lm: one<LineMargin>(l.offer_line_margins) }));
  const publicText = [v.incotermPlace, v.paymentTerms, v.notes].join("\n").toLowerCase();
  const names = lines.map((l) => one<{ company_name: string }>(l.lm?.company)?.company_name ?? "").filter((n) => n.length >= 3);
  if (names.some((n) => publicText.includes(n.toLowerCase()))) return fail({ errors: { notes: "offerErrorLeak" } });
  if (lines.some((l) => !l.lm)) return fail({ errors: {}, formError: "rfqErrorGeneric" });

  const p = repriceOffer({
    mode,
    commissionRate,
    margin: marginInput,
    freight,
    lines: lines.map((l) => ({ quantity: Number(l.quantity), base: Number(l.lm!.base_amount), insuranceRate: Number(l.lm!.insurance_rate), fxMarginRate: Number(l.lm!.fx_margin_rate), maxDiscountRate: l.lm!.max_discount_rate })),
  });
  const { error } = await supabase.rpc("save_offer_pricing", {
    p_offer: offerId,
    p: {
      total_amount: p.total,
      freight_amount: freightManaged ? freight : null,
      incoterm_place: v.incotermPlace,
      valid_until: v.validUntil,
      payment_terms: v.paymentTerms,
      notes: v.notes,
      commission_rate: mode === "self" ? commissionRate : 0,
      commission_amount: p.commission,
      margin_rate: marginInput?.kind === "rate" ? marginInput.value : null,
      // Montant saisi tel quel (il se retrouve a l'identique a la modification) ; en %, montant calcule.
      // La marge reellement encaissee, ligne par ligne, est dans offer_line_margins.
      margin_amount: marginInput ? (marginInput.kind === "amount" ? marginInput.value : p.margin) : null,
      margin_pending: mode === "africanex" && !marginInput,
      freight_cost: freight,
      freight_pending: freightManaged && freight === null,
      lines: lines.map((l, i) => ({
        id: l.id,
        unit_price: p.lines[i].unitPrice,
        total_amount: p.lines[i].total,
        commission_rate: mode === "self" ? commissionRate : 0,
        commission_amount: p.lines[i].commission,
        fx_margin_amount: p.lines[i].fxMargin,
        margin_amount: p.lines[i].margin,
      })),
    },
  });
  if (error) {
    if (/offer not draft/.test(error.message)) return fail({ errors: {}, formError: "offerErrorNotDraft" });
    if (/rfq closed/.test(error.message)) return fail({ errors: {}, formError: "offerErrorRfqClosed" });
    console.error("Auto offer pricing failed:", error.code, error.message);
    return fail({ errors: {}, formError: "rfqErrorGeneric" });
  }

  await supabase.from("audit_log").insert({
    actor_profile_id: userId,
    action: "offer.pricing",
    entity: "offer",
    entity_id: offerId,
    payload: { rfq: rfqId, mode, commission_rate: mode === "self" ? commissionRate : null, margin: marginInput, freight, total: p.total },
  });
  if (publish) {
    if (!(await publishOffer(supabase, offerId, rfqId, null))) redirect(`/${locale}/admin/rfqs/${rfqId}?done=offerPending`);
    await markLineQuotes(supabase, offerId, "selected");
    await supabase.from("audit_log").insert({ actor_profile_id: userId, action: "offer.publish", entity: "offer", entity_id: offerId, payload: { rfq: rfqId } });
  }
  redirect(`/${locale}/admin/rfqs/${rfqId}?done=${publish ? "offerPublished" : "offerSaved"}`);
}

// Publier un brouillon, retirer une offre publiee (retour en brouillon) ou supprimer un brouillon.
export async function changeOffer(formData: FormData) {
  const { locale, supabase, userId } = await adminContext(formData);
  const id = text(formData, "id");
  const op = text(formData, "op");
  if (!UUID.test(id) || !["publish", "withdraw", "delete"].includes(op)) redirect(`/${locale}/admin/rfqs`);
  const { data: offer } = await supabase.from("offers").select("id, rfq_id, status, valid_until, offer_margins(source_quote_id)").eq("id", id).maybeSingle();
  if (!offer) redirect(`/${locale}/admin/rfqs`);
  const quoteId = one<{ source_quote_id: string | null }>(offer.offer_margins)?.source_quote_id ?? null;
  const back = (done: string) => redirect(`/${locale}/admin/rfqs/${offer.rfq_id}?done=${done}`);

  if (op === "publish" && offer.status === "draft") {
    if (offer.valid_until && offer.valid_until < new Date().toISOString().slice(0, 10)) back("offerExpired");
    if (!(await publishOffer(supabase, id, offer.rfq_id, quoteId))) back("offerPending");
    await markLineQuotes(supabase, id, "selected");
  } else if (op === "withdraw" && offer.status === "published") {
    await supabase.from("offers").update({ status: "draft", published_at: null }).eq("id", id).eq("status", "published");
    if (quoteId) await supabase.from("quotes").update({ status: "submitted" }).eq("id", quoteId).eq("status", "selected");
    await markLineQuotes(supabase, id, "submitted");
    const { count } = await supabase.from("offers").select("id", { count: "exact", head: true }).eq("rfq_id", offer.rfq_id).eq("status", "published");
    if (!count) await supabase.from("rfqs").update({ status: "dispatched" }).eq("id", offer.rfq_id).eq("status", "offered");
  } else if (op === "delete" && offer.status === "draft") {
    await supabase.from("offers").delete().eq("id", id).eq("status", "draft");
  } else {
    back("offerUnchanged");
  }
  await supabase.from("audit_log").insert({ actor_profile_id: userId, action: `offer.${op}`, entity: "offer", entity_id: id, payload: { rfq: offer.rfq_id } });
  back(op === "publish" ? "offerPublished" : op === "withdraw" ? "offerWithdrawn" : "offerDeleted");
}
