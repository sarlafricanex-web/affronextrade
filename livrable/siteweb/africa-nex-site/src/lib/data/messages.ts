import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

// Lot 5f : fils de messages. Deux fils seulement, jamais acheteur avec producteur :
//   - acheteur <-> AFRICA NEX : messages de la demande sans envoi (dispatch_id nul) ;
//   - producteur <-> AFRICA NEX : messages rattaches a l'envoi du producteur.
// La RLS ne renvoie a chacun que ses fils ; l'admin les voit tous.

export type ThreadMessage = { id: string; dispatch_id: string | null; sender_role: "buyer" | "producer" | "admin"; body: string; created_at: string; read_at: string | null };
const COLUMNS = "id, dispatch_id, sender_role, body, created_at, read_at";

export async function listThread(client: Client, rfqId: string, dispatchId: string | null) {
  let q = client.from("messages").select(COLUMNS).eq("rfq_id", rfqId);
  q = dispatchId ? q.eq("dispatch_id", dispatchId) : q.is("dispatch_id", null);
  const { data, error } = await q.order("created_at");
  if (error) throw error;
  return (data ?? []) as ThreadMessage[];
}

// Console : tous les fils d'une demande (acheteur et chaque producteur).
export async function listRfqMessages(client: Client, rfqId: string) {
  const { data, error } = await client.from("messages").select(COLUMNS).eq("rfq_id", rfqId).order("created_at");
  if (error) throw error;
  return (data ?? []) as ThreadMessage[];
}

// Ouverture d'un fil : les messages recus passent lus (fonction en base, destinataire seulement).
export async function markThreadRead(client: Client, rfqId: string, dispatchId: string | null) {
  await client.rpc("mark_messages_read", { p_rfq: rfqId, p_dispatch: dispatchId as string });
}

// Compteur du menu : messages recus non lus (la RLS limite l'acheteur et le producteur a leurs fils).
export async function countUnreadMessages(client: Client, role: string) {
  const q = client.from("messages").select("id", { count: "exact", head: true }).is("read_at", null);
  const { count } = await (role === "admin" ? q.neq("sender_role", "admin") : q.eq("sender_role", "admin"));
  return count ?? 0;
}

// Messages recus non lus parmi une liste embarquee (listes des demandes).
export const unreadOf = (messages: unknown, role: string) =>
  ((messages ?? []) as { sender_role: string; read_at: string | null }[]).filter((m) => !m.read_at && (role === "admin" ? m.sender_role !== "admin" : m.sender_role === "admin")).length;
