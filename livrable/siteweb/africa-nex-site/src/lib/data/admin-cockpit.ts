import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

// Poste de pilotage d'AFRICA NEX (tableau de bord admin) : tout ce qui attend une action, trie par
// anciennete, et les chiffres du mois. Lu avec le client de l'admin (RLS : is_admin()).

export type QueueKind = "rfq" | "quote" | "currency" | "message" | "claim" | "review" | "document" | "deletion" | "subscription" | "contact";
export type QueueGroup = "requests" | "moderation" | "accounts";
export type QueueItem = { kind: QueueKind; group: QueueGroup; title: string; detail: string; href: string; at: string };

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
  const push = (kind: QueueKind, title: string, detail: string, href: string, at: string) => queue.push({ kind, group: QUEUE_GROUP[kind], title, detail, href, at });

  for (const r of rfqs.data ?? []) push("rfq", r.title, `${r.reference}${r.destination_country ? ` · ${r.destination_country}` : ""}`, `/admin/rfqs/${r.id}`, r.created_at);
  for (const q of quotes.data ?? []) {
    const d = one(q.dispatch as { rfq_id: string; rfq: { reference: string } | null } | null);
    if (d) push("quote", one(q.company as { company_name: string } | null)?.company_name ?? "Producteur", one(d.rfq)?.reference ?? "", `/admin/rfqs/${d.rfq_id}`, q.created_at);
  }
  for (const o of currency.data ?? []) push("currency", `Offre ${o.label} : ${o.currency} vers ${o.currency_change_to}`, one(o.rfq as { reference: string } | null)?.reference ?? "", `/admin/rfqs/${o.rfq_id}`, o.currency_change_at ?? new Date().toISOString());
  // Messages non lus : un element par demande et par expediteur, date du plus ancien.
  const threads = new Map<string, { rfq: string; role: string; ref: string; at: string; n: number }>();
  for (const m of messages.data ?? []) {
    const key = `${m.rfq_id}:${m.sender_role}`;
    const t = threads.get(key);
    if (t) t.n++;
    else threads.set(key, { rfq: m.rfq_id, role: m.sender_role, ref: one(m.rfq as { reference: string } | null)?.reference ?? "", at: m.created_at, n: 1 });
  }
  for (const t of threads.values()) push("message", `${t.n} message${t.n > 1 ? "s" : ""} ${t.role === "buyer" ? "de l'acheteur" : "d'un producteur"}`, t.ref, `/admin/rfqs/${t.rfq}`, t.at);
  for (const c of claims.data ?? []) push("claim", one(c.company as { company_name: string } | null)?.company_name ?? "Fiche", "Revendication de fiche", "/admin/claims", c.created_at);
  for (const r of reviews.data ?? []) push("review", one(r.producer as { company_name: string } | null)?.company_name ?? "Producteur", `Avis ${r.rating}/5 à modérer`, "/admin/reviews", r.created_at);
  for (const d of documents.data ?? []) push("document", d.title || d.kind, one(d.company as { company_name: string } | null)?.company_name ?? "", `/admin/producers/${d.company_id}`, d.created_at);
  for (const d of deletions.data ?? []) push("deletion", d.email, d.role === "producer" ? "Producteur" : "Acheteur", "/admin/accounts#deletion-requests", d.created_at);
  for (const s of subs.data ?? []) push("subscription", one(s.company as { company_name: string } | null)?.company_name ?? "Fournisseur", `${s.plan_code} · ${Number(s.price_charged_dzd).toLocaleString("fr-FR")} DZD`, "/admin/accounts", s.created_at);
  for (const s of contacts.data ?? []) push("contact", s.company || s.name, "Formulaire de contact", "/admin", s.created_at);
  queue.sort((a, b) => a.at.localeCompare(b.at));

  const decidedRows = decided.data ?? [];
  const accepted = decidedRows.filter((o) => o.status === "accepted").length;
  const prod = producers.data ?? [];
  return {
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
