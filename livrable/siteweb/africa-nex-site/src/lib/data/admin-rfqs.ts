import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

// Console AFRICA NEX des demandes de devis. Lecture avec la session de l'admin : la RLS
// (politiques *_admin) verifie le role une seconde fois.

const RFQ_COLUMNS =
  "id, reference, title, description, quantity, unit, quantity_mode, container_size, container_reefer, container_count, incoterm, destination_country, destination_port, target_unit_price, currency, needed_by, attachments, status, created_at, product_id, buyer_profile_id";

export async function listAdminRfqs(client: Client) {
  const { data, error } = await client
    .from("rfqs")
    .select(`${RFQ_COLUMNS}, buyer:companies!rfqs_buyer_company_id_fkey(company_name, country), source:companies!rfqs_source_company_id_fkey(company_name), rfq_dispatches(id, status)`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAdminRfq(client: Client, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: rfq, error } = await client
    .from("rfqs")
    .select(`${RFQ_COLUMNS}, buyer_company_id, buyer:companies!rfqs_buyer_company_id_fkey(id, company_name, country, city, buyer_type, website), source:companies!rfqs_source_company_id_fkey(id, company_name, slug), product:products(id, product_name, hs_code)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!rfq) return null;
  const [{ data: profile }, { data: contact }, { data: dispatches }] = await Promise.all([
    client.from("profiles").select("full_name, email, phone, whatsapp").eq("id", rfq.buyer_profile_id).maybeSingle(),
    rfq.buyer_company_id ? client.from("company_private").select("contact_phone, contact_whatsapp").eq("company_id", rfq.buyer_company_id).maybeSingle() : Promise.resolve({ data: null }),
    client
      .from("rfq_dispatches")
      .select("id, reference, status, respond_by, viewed_at, created_at, brief_title, unit, company:companies(id, company_name, slug, claim_status, owner_profile_id), quotes(unit_price_ht, currency, price_basis, quantity, production_lead_days, valid_until, status)")
      .eq("rfq_id", id)
      .order("created_at"),
  ]);
  // Date de reponse proposee par defaut aux producteurs : dans 7 jours.
  const defaultRespondBy = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  return { ...rfq, buyerProfile: profile, buyerContact: contact, dispatches: dispatches ?? [], defaultRespondBy };
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
