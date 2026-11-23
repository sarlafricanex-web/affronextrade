import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { MyCompany } from "@/lib/data/company";
import { listMyRequests } from "@/lib/data/requests";
import { unreadOf } from "@/lib/data/messages";
import { companyChecks } from "@/lib/company-completion";
import { listMyRfqs } from "@/lib/data/rfq";
import { getProducerCards, type ProducerCard } from "@/lib/data/directory";

type Client = SupabaseClient<Database>;
const DAY = 864e5;

// Semaine 6 : tableau de bord producteur. Uniquement des donnees reelles de l'entreprise (RLS :
// ses membres) ; aucun chiffre d'affaires, aucune mention officielle, rien d'invente.
export async function getProducerDashboard(client: Client, company: MyCompany) {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const since30 = new Date(now - 30 * DAY).toISOString();
  const since60 = new Date(now - 60 * DAY).toISOString();
  const [requests, { data: views }, { count: productCount }, { count: publishedCount }, { count: registrationCount }, { data: prices }, { data: plan }] = await Promise.all([
    listMyRequests(client, company.id),
    client.from("profile_views").select("viewer_country, created_at").eq("company_id", company.id).gte("created_at", since60).limit(5000),
    client.from("products").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    client.from("products").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "published"),
    client.from("company_documents").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("kind", "registration"),
    client.rpc("product_prices", { p_company: company.id }),
    client.rpc("current_plan", { p_company: company.id }),
  ]);

  // Vues de la fiche : 30 derniers jours, comparees aux 30 jours precedents ; pays des visiteurs.
  const recent = (views ?? []).filter((v) => v.created_at >= since30);
  const previous = (views ?? []).length - recent.length;
  const countries = new Map<string, number>();
  for (const v of recent) if (v.viewer_country) countries.set(v.viewer_country, (countries.get(v.viewer_country) ?? 0) + 1);
  const topCountries = [...countries].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Demandes recues et devis : a traiter = ni devis, ni declinee, ni expiree.
  const quotes = requests.map((r) => r.quote).filter((q) => q && q.status !== "draft" && q.status !== "withdrawn");
  const selected = quotes.filter((q) => q!.status === "selected").length;
  const toDo = requests.filter((r) => !r.quote && (r.status === "sent" || r.status === "viewed") && !r.overdue);
  const unread = requests.reduce((s, r) => s + unreadOf(r.messages, "producer"), 0);
  const unreadRequests = requests.filter((r) => unreadOf(r.messages, "producer") > 0);
  const expiredPrices = (prices ?? []).filter((p) => p.price_valid_until && p.price_valid_until < today).length;

  return {
    views30: recent.length,
    viewsPrevious: previous,
    topCountries,
    received: requests.length,
    toDo,
    quotesSent: quotes.length,
    selected,
    selectionRate: quotes.length ? Math.round((selected / quotes.length) * 100) : null,
    unread,
    unreadRequests,
    recentRequests: requests.slice(0, 5),
    productCount: productCount ?? 0,
    publishedCount: publishedCount ?? 0,
    expiredPrices,
    // Forfait en cours (Vitrine, Essentiel, Croissance, Export Pro), Vitrine sans abonnement actif.
    tier: typeof plan === "string" && plan ? plan : "vitrine",
    completion: companyChecks({ company, productCount: productCount ?? 0, registrationCount: registrationCount ?? 0 }),
  };
}

export type ProducerDashboard = Awaited<ReturnType<typeof getProducerDashboard>>;

// Semaine 6 : tableau de bord acheteur. Demandes, offres a decider, messages non lus (RLS : ses
// demandes seulement) et producteurs en ligne des secteurs choisis a l'inscription.
export async function getBuyerDashboard(client: Client, userId: string, interests: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  const [rfqs, cards] = await Promise.all([listMyRfqs(client, userId), getProducerCards().catch(() => [] as ProducerCard[])]);
  const open = (o: { status: string; valid_until?: string | null }) => o.status === "published" && (!o.valid_until || o.valid_until >= today);
  type Offer = { id: string; status: string; valid_until: string | null };
  const offersOf = (r: (typeof rfqs)[number]) => (r.offers ?? []) as Offer[];
  const toDecide = rfqs.filter((r) => r.status === "offered").map((r) => ({ rfq: r, count: offersOf(r).filter(open).length })).filter((x) => x.count > 0);
  const unread = rfqs.map((r) => ({ rfq: r, count: unreadOf(r.messages, "buyer") })).filter((x) => x.count > 0);
  // Producteurs des secteurs de l'acheteur, puis les autres ; ceux qui ont des avis d'abord.
  const wanted = new Set(interests);
  const producers = [...cards]
    .sort((a, b) => Number(wanted.has(b.sector)) - Number(wanted.has(a.sector)) || b.reviewCount - a.reviewCount)
    .slice(0, 3);
  return {
    inProgress: rfqs.filter((r) => ["submitted", "qualified", "dispatched", "offered"].includes(r.status)).length,
    offersToDecide: toDecide.reduce((s, x) => s + x.count, 0),
    accepted: rfqs.reduce((s, r) => s + offersOf(r).filter((o) => o.status === "accepted").length, 0),
    toDecide,
    unread,
    recent: rfqs.slice(0, 4),
    producers,
    matchesInterests: producers.some((p) => wanted.has(p.sector)),
  };
}

export type BuyerDashboard = Awaited<ReturnType<typeof getBuyerDashboard>>;
