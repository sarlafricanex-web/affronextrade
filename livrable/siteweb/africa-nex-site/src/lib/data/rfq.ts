import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { StorageCondition } from "@/lib/logistics/container";

type Client = SupabaseClient<Database>;

// Les 5 jalons d'une demande (maquettes 13 et 14). Une demande annulee n'en atteint aucun.
export const RFQ_STAGES = ["submitted", "qualified", "dispatched", "offered", "accepted"] as const;
export function stageOf(status: string) {
  if (status === "cancelled") return 0;
  if (status === "closed") return 5;
  return RFQ_STAGES.indexOf(status as (typeof RFQ_STAGES)[number]) + 1;
}

export const INCOTERMS = ["FOB", "CFR", "CIF", "DAP"] as const;
export const RFQ_MAX_FILE_BYTES = 4 * 1024 * 1024; // limite des envois Vercel (4,5 Mo)

const RFQ_COLUMNS =
  "id, reference, title, description, quantity, unit, quantity_mode, container_size, container_reefer, container_count, incoterm, destination_country, destination_port, target_unit_price, currency, needed_by, attachments, status, created_at, product_id, source_company_id";

// Demandes de l'acheteur connecte (la RLS ne renvoie que les siennes), offres publiees comprises.
export async function listMyRfqs(client: Client, userId: string) {
  const { data, error } = await client
    .from("rfqs")
    .select(`${RFQ_COLUMNS}, offers(id, status, valid_until), messages(sender_role, read_at)`)
    .eq("buyer_profile_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMyRfq(client: Client, userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await client
    .from("rfqs")
    .select(`${RFQ_COLUMNS}, offers(id, status), rfq_lines(${RFQ_LINE_COLUMNS})`)
    .eq("buyer_profile_id", userId)
    .eq("id", id)
    .order("position", { referencedTable: "rfq_lines" })
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Lot 5e : offres AFRICA NEX d'une demande, avec leurs lignes. La RLS ne renvoie a l'acheteur que
// les offres non brouillon de ses demandes ; aucune donnee du calcul (fournisseur, cout, marge).
const BUYER_OFFER_COLUMNS =
  "id, label, status, currency, incoterm, incoterm_place, quantity, unit_price, total_amount, freight_amount, lead_time_days, origin_region, packaging, certifications, payment_terms, cagex_insured, valid_until, notes, published_at, decided_at, decline_reason, currency_change_to, currency_change_note, currency_change_at";
const BUYER_OFFER_LINE_COLUMNS = "id, rfq_line_id, position, description, reference, quantity, unit, unit_price, total_amount, incoterm, incoterm_place, lead_time_days, availability";

export async function listMyOffers(client: Client, rfqId: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (!/^[0-9a-f-]{36}$/i.test(rfqId)) return { offers: [], today };
  const { data, error } = await client
    .from("offers")
    .select(`${BUYER_OFFER_COLUMNS}, offer_lines(${BUYER_OFFER_LINE_COLUMNS})`)
    .eq("rfq_id", rfqId)
    .neq("status", "draft")
    .order("label")
    .order("position", { referencedTable: "offer_lines" });
  if (error) throw error;
  return { offers: data ?? [], today };
}

export type BuyerOffer = Awaited<ReturnType<typeof listMyOffers>>["offers"][number];

// Lignes d'une demande (produits demandes), dans l'ordre de saisie.
export const RFQ_LINE_COLUMNS = "id, position, product_id, reference, description, quantity, unit";
export type RfqLine = { id: string; position: number; product_id: string | null; reference: string | null; description: string; quantity: number | null; unit: string | null };

export type MyRfq = NonNullable<Awaited<ReturnType<typeof getMyRfq>>>;
export type RfqAttachment = { path: string; name: string; size: number; type: string };
export const rfqAttachments = (r: { attachments: unknown }): RfqAttachment[] =>
  Array.isArray(r.attachments) ? (r.attachments as RfqAttachment[]).filter((a) => a && typeof a.path === "string") : [];

// Compteur de l'espace acheteur : demandes dont les offres sont pretes a comparer.
export async function countOffersReady(client: Client, userId: string) {
  const { count } = await client.from("rfqs").select("id", { count: "exact", head: true }).eq("buyer_profile_id", userId).eq("status", "offered");
  return count ?? 0;
}

// Produit ou producteur de depart (bouton "Demander un devis" de la fiche publique).
// Lecture publique : seuls les produits publies de fiches en ligne sont visibles.
export async function getRfqContext(client: Client, { productId, producerSlug }: { productId?: string; producerSlug?: string }) {
  if (productId && /^[0-9a-f-]{36}$/i.test(productId)) {
    const { data } = await client
      .from("products")
      .select("id, product_name, unit, min_order_quantity, units_per_carton, carton_length_cm, carton_width_cm, carton_height_cm, carton_gross_weight_kg, max_stack_layers, storage_condition, palletized, cartons_per_pallet, companies(id, company_name, slug)")
      .eq("id", productId)
      .eq("status", "published")
      .maybeSingle();
    if (data) {
      const company = data.companies as unknown as { id: string; company_name: string; slug: string } | null;
      return {
        productId: data.id,
        productName: data.product_name,
        unit: data.unit,
        moq: data.min_order_quantity === null ? null : Number(data.min_order_quantity),
        companyId: company?.id ?? null,
        companyName: company?.company_name ?? null,
        logistics: {
          unitsPerCarton: data.units_per_carton === null ? null : Number(data.units_per_carton),
          lengthCm: data.carton_length_cm === null ? null : Number(data.carton_length_cm),
          widthCm: data.carton_width_cm === null ? null : Number(data.carton_width_cm),
          heightCm: data.carton_height_cm === null ? null : Number(data.carton_height_cm),
          grossWeightKg: data.carton_gross_weight_kg === null ? null : Number(data.carton_gross_weight_kg),
          maxStackLayers: data.max_stack_layers,
          storage: (data.storage_condition as StorageCondition | null) ?? null,
          palletized: Boolean(data.palletized),
          cartonsPerPallet: data.cartons_per_pallet,
        },
      };
    }
  }
  if (producerSlug && /^[a-z0-9-]{1,80}$/.test(producerSlug)) {
    const { data } = await client.from("companies").select("id, company_name").eq("slug", producerSlug).eq("visibility", "published").eq("kind", "producer").maybeSingle();
    if (data) return { productId: null, productName: null, unit: null, moq: null, companyId: data.id, companyName: data.company_name, logistics: null };
  }
  return null;
}

export type RfqContext = NonNullable<Awaited<ReturnType<typeof getRfqContext>>>;
