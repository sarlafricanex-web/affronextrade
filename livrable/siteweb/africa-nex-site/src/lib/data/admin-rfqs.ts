import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { RFQ_LINE_COLUMNS } from "@/lib/data/rfq";

type Client = SupabaseClient<Database>;

// Console AFRICA NEX des demandes de devis. Lecture avec la session de l'admin : la RLS
// (politiques *_admin) verifie le role une seconde fois.

const RFQ_COLUMNS =
  "id, reference, title, description, quantity, unit, quantity_mode, container_size, container_reefer, container_count, incoterm, destination_country, destination_port, target_unit_price, currency, needed_by, attachments, status, created_at, product_id, buyer_profile_id";

export async function listAdminRfqs(client: Client) {
  const { data, error } = await client
    .from("rfqs")
    .select(`${RFQ_COLUMNS}, buyer:companies!rfqs_buyer_company_id_fkey(company_name, country), source:companies!rfqs_source_company_id_fkey(company_name), rfq_dispatches(id, status), offers(status, currency_change_to)`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAdminRfq(client: Client, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: rfq, error } = await client
    .from("rfqs")
    .select(`${RFQ_COLUMNS}, buyer_company_id, buyer:companies!rfqs_buyer_company_id_fkey(id, company_name, country, city, buyer_type, website), source:companies!rfqs_source_company_id_fkey(id, company_name, slug), product:products(id, product_name, hs_code), rfq_lines(${RFQ_LINE_COLUMNS})`)
    .eq("id", id)
    .order("position", { referencedTable: "rfq_lines" })
    .maybeSingle();
  if (error) throw error;
  if (!rfq) return null;
  const [{ data: profile }, { data: contact }, { data: dispatches }, { data: offers }] = await Promise.all([
    client.from("profiles").select("full_name, email, phone, whatsapp").eq("id", rfq.buyer_profile_id).maybeSingle(),
    rfq.buyer_company_id ? client.from("company_private").select("contact_phone, contact_whatsapp").eq("company_id", rfq.buyer_company_id).maybeSingle() : Promise.resolve({ data: null }),
    client
      .from("rfq_dispatches")
      .select(`id, reference, status, respond_by, viewed_at, created_at, brief_title, unit, rfq_line_id, company:companies(id, company_name, slug, claim_status, owner_profile_id, wilaya, city), quotes(${QUOTE_COLUMNS})`)
      .eq("rfq_id", id)
      .order("created_at"),
    client.from("offers").select(`${OFFER_COLUMNS}, freight_amount, offer_margins(${MARGIN_COLUMNS}), offer_lines(count)`).eq("rfq_id", id).order("label"),
  ]);
  // Date de reponse proposee par defaut aux producteurs : dans 7 jours.
  const now = Date.now();
  const defaultRespondBy = new Date(now + 7 * 864e5).toISOString().slice(0, 10);
  const today = new Date(now).toISOString().slice(0, 10);
  return { ...rfq, buyerProfile: profile, buyerContact: contact, dispatches: dispatches ?? [], offers: offers ?? [], defaultRespondBy, today };
}

const QUOTE_COLUMNS =
  "id, unit_price_ht, currency, price_basis, port_of_loading, quantity, production_lead_days, available_at_port_on, payment_terms, valid_until, notes, attachments, status, author_profile_id, created_at, updated_at";
const OFFER_COLUMNS =
  "id, label, unit_price, currency, incoterm, incoterm_place, quantity, total_amount, lead_time_days, origin_region, packaging, certifications, payment_terms, cagex_insured, valid_until, notes, status, published_at, decided_at, decline_reason, currency_change_to, currency_change_note";
const MARGIN_COLUMNS = "source_quote_id, producer_unit_price, producer_currency, freight_cost, insurance_rate, insurance_cost, commission_rate, commission_amount, auto, export_mode, margin_pending, freight_pending";

// Composeur d'offre : la demande, le devis source (et son producteur, jamais montre a
// l'acheteur) et l'offre deja composee depuis ce devis s'il y en a une.
export async function getOfferComposer(client: Client, rfqId: string, quoteId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(rfqId) || !/^[0-9a-f-]{36}$/i.test(quoteId)) return null;
  const [{ data: rfq }, { data: quote }, { data: margin }, { data: labels }] = await Promise.all([
    client.from("rfqs").select("id, reference, title, status, quantity, unit, quantity_mode, container_size, container_reefer, container_count, incoterm, destination_country, destination_port, target_unit_price, currency").eq("id", rfqId).maybeSingle(),
    client.from("quotes").select(`${QUOTE_COLUMNS}, company:companies(company_name, wilaya, city, owner_profile_id), dispatch:rfq_dispatches(id, rfq_id, reference, unit)`).eq("id", quoteId).maybeSingle(),
    client.from("offer_margins").select(`${MARGIN_COLUMNS}, offer:offers(${OFFER_COLUMNS})`).eq("source_quote_id", quoteId).maybeSingle(),
    client.from("offers").select("label, offer_margins(source_quote_id)").eq("rfq_id", rfqId),
  ]);
  const dispatch = quote ? ((Array.isArray(quote.dispatch) ? quote.dispatch[0] : quote.dispatch) as { id: string; rfq_id: string; reference: string; unit: string | null } | null) : null;
  if (!rfq || !quote || dispatch?.rfq_id !== rfqId) return null;
  const offer = margin ? ((Array.isArray(margin.offer) ? margin.offer[0] : margin.offer) as Record<string, unknown> | null) : null;
  // Prochaine lettre libre pour une nouvelle offre (A, B, C...).
  const used = new Set((labels ?? []).map((l) => l.label));
  const nextLabel = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((l) => !used.has(l)) ?? "Z";
  const today = new Date().toISOString().slice(0, 10);
  return { rfq, quote, dispatch, margin, offer, nextLabel, today };
}

// Lot 6e : offre calculee a completer (commission, marge, fret, conditions). Lignes avec leur
// construction du prix et le fournisseur (AFRICA NEX seule, RLS admin).
const LINE_MARGIN_COLUMNS =
  "export_mode, supplier_unit_price, supplier_currency, base_amount, commission_rate, commission_amount, insurance_rate, insurance_amount, fx_margin_rate, fx_margin_amount, margin_amount, max_discount_rate, warnings, quote_id, company:companies(id, company_name)";

export async function getAutoOfferEditor(client: Client, rfqId: string, offerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(rfqId) || !/^[0-9a-f-]{36}$/i.test(offerId)) return null;
  const [{ data: rfq }, { data: offer }] = await Promise.all([
    client.from("rfqs").select("id, reference, title, status, incoterm, currency, destination_country, destination_port").eq("id", rfqId).maybeSingle(),
    client
      .from("offers")
      .select(`${OFFER_COLUMNS}, rfq_id, freight_amount, offer_margins(${MARGIN_COLUMNS}, fx_rate, fx_margin_rate, margin_rate, margin_amount), offer_lines(id, position, description, reference, quantity, unit, unit_price, total_amount, incoterm, incoterm_place, lead_time_days, availability, offer_line_margins(${LINE_MARGIN_COLUMNS}))`)
      .eq("id", offerId)
      .order("position", { referencedTable: "offer_lines" })
      .maybeSingle(),
  ]);
  if (!rfq || !offer || offer.rfq_id !== rfqId) return null;
  const margin = Array.isArray(offer.offer_margins) ? offer.offer_margins[0] : offer.offer_margins;
  if (!margin?.auto) return null;
  const today = new Date().toISOString().slice(0, 10);
  return { rfq, offer, margin, today };
}

export type AutoOfferEditor = NonNullable<Awaited<ReturnType<typeof getAutoOfferEditor>>>;

// Saisie par AFRICA NEX du devis d'un producteur joint hors ligne.
export async function getQuoteEntry(client: Client, rfqId: string, dispatchId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(rfqId) || !/^[0-9a-f-]{36}$/i.test(dispatchId)) return null;
  const { data } = await client
    .from("rfq_dispatches")
    .select(`id, rfq_id, reference, status, brief_title, brief_specs, quantity, unit, destination_country, requested_incoterm, respond_by, company:companies(company_name, owner_profile_id), quotes(${QUOTE_COLUMNS})`)
    .eq("id", dispatchId)
    .eq("rfq_id", rfqId)
    .maybeSingle();
  return data;
}

export type AdminRfq = NonNullable<Awaited<ReturnType<typeof getAdminRfq>>>;

// Producteurs consultables : toutes les fiches producteur sauf suspendues.
export async function listDispatchableProducers(client: Client) {
  const { data, error } = await client
    .from("companies")
    .select("id, company_name, sector, wilaya, city, claim_status, visibility, owner_profile_id")
    .eq("kind", "producer")
    .neq("visibility", "suspended")
    .order("company_name");
  if (error) throw error;
  return data;
}

// Compteur du menu admin : demandes recues a qualifier.
export async function countRfqsToQualify(client: Client) {
  const { count } = await client.from("rfqs").select("id", { count: "exact", head: true }).eq("status", "submitted");
  return count ?? 0;
}
