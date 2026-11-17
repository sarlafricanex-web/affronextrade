import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getFxRates } from "@/lib/data/settings";
import { computeAutoOffers, type AutoInputRow, type AutoOffer, type AutoResult } from "@/lib/offer-auto";

type Client = SupabaseClient<Database>;

// Calcul automatique d'une demande (lot 6c), avec la session de l'admin : offer_auto_inputs()
// refuse tout autre role. Le meme calcul sert a l'apercu de la console et a l'action serveur.
export async function computeRfqAutoOffers(client: Client, rfqId: string): Promise<(AutoResult & { rates: Awaited<ReturnType<typeof getFxRates>> }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(rfqId)) return null;
  const [{ data: rfq }, { data: rows, error }, rates] = await Promise.all([
    client.from("rfqs").select("id, currency, incoterm").eq("id", rfqId).maybeSingle(),
    client.rpc("offer_auto_inputs", { p_rfq: rfqId }),
    getFxRates(client),
  ]);
  if (error) throw error;
  if (!rfq || !rows?.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const result = computeAutoOffers({
    rows: rows as AutoInputRow[],
    buyerCurrency: rfq.currency,
    requestedIncoterm: rfq.incoterm,
    rates: { EUR: rates.EUR?.dzd_per_unit, USD: rates.USD?.dzd_per_unit },
    today,
  });
  return { ...result, rates };
}

// Charge utile de save_auto_offers() : une offre par groupe, lettres libres attribuees dans l'ordre.
export function autoOffersPayload(offers: AutoOffer[], labels: string[]) {
  return offers.map((o, i) => ({
    label: labels[i],
    currency: o.currency,
    incoterm: o.incoterm,
    valid_until: o.validUntil,
    lead_time_days: o.leadDays,
    total_amount: o.total,
    cagex_insured: o.insurance > 0,
    margin: {
      export_mode: o.mode,
      fx_rate: o.fxRate,
      fx_margin_rate: o.mode === "africanex" ? o.fxMarginRate : null,
      margin_rate: null,
      margin_amount: null,
      margin_pending: o.marginPending,
      freight_pending: o.freightPending,
      producer_currency: o.mode === "africanex" ? "DZD" : o.currency,
      commission_rate: o.commissionRate,
      commission_amount: o.commission,
      insurance_rate: o.insuranceRate,
      insurance_cost: o.insurance,
    },
    lines: o.lines.map((l, j) => ({
      rfq_line_id: l.row.line_id,
      position: j + 1,
      description: l.row.line_description,
      reference: l.row.line_reference,
      quantity: l.quantity,
      unit: l.row.line_unit ?? l.row.product_unit,
      unit_price: l.unitPrice,
      total_amount: l.total,
      incoterm: l.incoterm,
      incoterm_place: l.incotermPlace,
      lead_time_days: l.leadDays,
      availability: l.availability,
      margin: {
        product_id: l.row.product_id,
        company_id: l.row.company_id,
        export_mode: l.mode,
        supplier_unit_price: l.supplierUnitPrice,
        supplier_currency: l.supplierCurrency,
        base_amount: l.base,
        commission_rate: l.commissionRate,
        commission_amount: l.commission,
        insurance_rate: l.insuranceRate,
        insurance_amount: l.insurance,
        fx_margin_rate: l.fxMarginRate,
        fx_margin_amount: l.fxMargin,
        margin_amount: 0,
        max_discount_rate: l.maxDiscountRate,
        warnings: l.warnings,
      },
    })),
  }));
}
