import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

// Poste de pilotage d'AFRICA NEX (tableau de bord admin) : tout ce qui attend une action, trie par
// anciennete, et les chiffres du mois. Lu avec le client de l'admin (RLS : is_admin()).

export type QueueKind = "rfq" | "quote" | "currency" | "message" | "claim" | "review" | "document" | "deletion" | "subscription" | "contact";
export type QueueGroup = "requests" | "moderation" | "accounts";
// title : nom principal (demande, entreprise, email) ; ref : reference de la demande ; country,
// count, role, rating, from, to, plan, amount : elements que l'affichage traduit.
export type QueueItem = {
  kind: QueueKind; group: QueueGroup; href: string; at: string;
  title?: string; ref?: string; country?: string | null; count?: number; role?: string; rating?: number;
  label?: string; from?: string; to?: string; plan?: string; amount?: number;
};

export const QUEUE_GROUP: Record<QueueKind, QueueGroup> = {
  rfq: "requests", quote: "requests", currency: "requests", message: "requests",
  claim: "moderation", review: "moderation", document: "moderation",
  deletion: "accounts", subscription: "accounts", contact: "accounts",
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export async function getAdminCockpit(client: Client) {
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const [rfqs, quotes, currency, messages, claims, reviews, documents, deletions, subs, contacts, rfqMonth, offersMonth, decided, producers] = await Promise.all([
    client.from("rfqs").select("id, reference, title, destination_country, created_at").eq("status", "submitted").order("created_at"),
    client.from("quotes").select("id, created_at, company:companies(company_name), dispatch:rfq_dispatches(rfq_id, rfq:rfqs(reference))").eq("status", "submitted").order("created_at"),
    client.from("offers").select("id, label, currency, currency_change_to, currency_change_at, rfq_id, rfq:rfqs(reference)").not("currency_change_to", "is", null).eq("status", "published"),
    client.from("messages").select("id, rfq_id, sender_role, created_at, rfq:rfqs(reference)").neq("sender_role", "admin").is("read_at", null).order("created_at"),
    client.from("company_claims").select("id, created_at, company:companies(company_name)").eq("status", "pending").order("created_at"),
    client.from("reviews").select("id, created_at, rating, producer:companies!reviews_producer_company_id_fkey(company_name)").eq("status", "pending").order("created_at"),
    client.from("company_documents").select("id, title, kind, created_at, company_id, company:companies(company_name)").eq("review_status", "pending").order("created_at"),
    client.from("account_deletion_requests").select("id, email, role, created_at").eq("status", "pending").order("created_at"),
    client.from("subscriptions").select("id, plan_code, price_charged_dzd, created_at, company:companies(company_name)").eq("status", "pending_payment").order("created_at"),
    client.from("submissions").select("id, name, company, created_at").gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString()).order("created_at"),
    client.from("rfqs").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    client.from("offers").select("id", { count: "exact", head: true }).gte("published_at", monthStart),
    client.from("offers").select("status").in("status", ["accepted", "declined"]),
    client.from("companies").select("owner_profile_id").eq("kind", "producer"),
  ]);

  const queue: QueueItem[] = [];
  const push = (kind: QueueKind, href: string, at: string, fields: Partial<QueueItem>) => queue.push({ kind, group: QUEUE_GROUP[kind], href, at, ...fields });
  const nameOf = (c: unknown) => one(c as { company_name: string } | null)?.company_name;
  const refOf = (r: unknown) => one(r as { reference: string } | null)?.reference;

  for (const r of rfqs.data ?? []) push("rfq", `/admin/rfqs/${r.id}`, r.created_at, { title: r.title, ref: r.reference, country: r.destination_country });
  for (const q of quotes.data ?? []) {
    const d = one(q.dispatch as { rfq_id: string; rfq: { reference: string } | null } | null);
    if (d) push("quote", `/admin/rfqs/${d.rfq_id}`, q.created_at, { title: nameOf(q.company), ref: refOf(d.rfq) });
  }
  for (const o of currency.data ?? []) push("currency", `/admin/rfqs/${o.rfq_id}`, o.currency_change_at ?? new Date().toISOString(), { label: o.label, from: o.currency, to: o.currency_change_to ?? "", ref: refOf(o.rfq) });
  // Messages non lus : un element par demande et par expediteur, date du plus ancien.
  const threads = new Map<string, { rfq: string; role: string; ref: string; at: string; n: number }>();
  for (const m of messages.data ?? []) {
    const key = `${m.rfq_id}:${m.sender_role}`;
    const t = threads.get(key);
    if (t) t.n++;
    else threads.set(key, { rfq: m.rfq_id, role: m.sender_role, ref: one(m.rfq as { reference: string } | null)?.reference ?? "", at: m.created_at, n: 1 });
  }
  for (const t of threads.values()) push("message", `/admin/rfqs/${t.rfq}`, t.at, { count: t.n, role: t.role, ref: t.ref });
  for (const c of claims.data ?? []) push("claim", "/admin/claims", c.created_at, { title: nameOf(c.company) });
  for (const r of reviews.data ?? []) push("review", "/admin/reviews", r.created_at, { title: nameOf(r.producer), rating: r.rating });
  for (const d of documents.data ?? []) push("document", `/admin/producers/${d.company_id}`, d.created_at, { title: d.title || undefined, label: d.kind, ref: nameOf(d.company) });
  for (const d of deletions.data ?? []) push("deletion", "/admin/accounts#deletion-requests", d.created_at, { title: d.email, role: d.role });
  for (const s of subs.data ?? []) push("subscription", "/admin/accounts", s.created_at, { title: nameOf(s.company), plan: s.plan_code, amount: Number(s.price_charged_dzd) });
  for (const s of contacts.data ?? []) push("contact", "/admin", s.created_at, { title: s.company || s.name });
  queue.sort((a, b) => a.at.localeCompare(b.at));

  const decidedRows = decided.data ?? [];
  const accepted = decidedRows.filter((o) => o.status === "accepted").length;
  const prod = producers.data ?? [];
  return {
    // Heure du calcul : l'anciennete de chaque element est mesuree depuis ce moment.
    generatedAt: Date.now(),
    queue,
    counts: {
      requests: queue.filter((q) => q.group === "requests").length,
      moderation: queue.filter((q) => q.group === "moderation").length,
      accounts: queue.filter((q) => q.group === "accounts").length,
    },
    kpis: {
      rfqsThisMonth: rfqMonth.count ?? 0,
      offersThisMonth: offersMonth.count ?? 0,
      acceptance: decidedRows.length ? Math.round((accepted / decidedRows.length) * 100) : null,
      decided: decidedRows.length,
      producersClaimed: prod.filter((p) => p.owner_profile_id).length,
      producersListed: prod.length,
      producersTarget: 80,
    },
  };
}

export type AdminCockpit = Awaited<ReturnType<typeof getAdminCockpit>>;
