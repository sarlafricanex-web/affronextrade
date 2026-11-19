import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

// Demandes recues par le producteur (briefs anonymises envoyes par AFRICA NEX).
// La RLS ne renvoie que les envois adresses a son entreprise ; la demande brute de l'acheteur
// (table rfqs) lui reste invisible.

const DISPATCH_COLUMNS =
  "id, rfq_id, reference, brief_title, brief_specs, quantity, unit, destination_country, requested_incoterm, needed_by, respond_by, status, viewed_at, created_at";
const QUOTE_COLUMNS =
  "id, status, unit_price_ht, currency, price_basis, port_of_loading, quantity, production_lead_days, available_at_port_on, payment_terms, valid_until, notes, attachments, created_at, updated_at";

// Un seul devis par envoi (quotes.dispatch_id unique) : la base le renvoie comme objet, parfois comme liste.
export const oneOf = <T>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

// Delai restant avant la date limite de reponse, calcule ici (jamais pendant le rendu).
function deadline(respondBy: string | null) {
  if (!respondBy) return { hoursLeft: null as number | null, overdue: false };
  const end = new Date(`${respondBy}T23:59:59`).getTime();
  const hoursLeft = Math.floor((end - Date.now()) / 3_600_000);
  return { hoursLeft, overdue: hoursLeft < 0 };
}

export async function listMyRequests(client: Client, companyId: string) {
  const { data, error } = await client
    .from("rfq_dispatches")
    .select(`${DISPATCH_COLUMNS}, quotes(${QUOTE_COLUMNS}), messages(sender_role, read_at)`)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((d) => ({ ...d, quote: oneOf(d.quotes), ...deadline(d.respond_by) }));
}

export async function getMyRequest(client: Client, companyId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await client
    .from("rfq_dispatches")
    .select(`${DISPATCH_COLUMNS}, quotes(${QUOTE_COLUMNS})`)
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, quote: oneOf(data.quotes), ...deadline(data.respond_by), today: new Date().toISOString().slice(0, 10) };
}

export type MyRequest = NonNullable<Awaited<ReturnType<typeof getMyRequest>>>;

// Compteur du menu producteur : nouvelles demandes pas encore ouvertes.
export async function countNewRequests(client: Client, companyId: string) {
  const { count } = await client.from("rfq_dispatches").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "sent");
  return count ?? 0;
}
