"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";
import { isCountryCode } from "@/lib/countries";
import { UNITS, parseAmount } from "@/lib/onboarding/reference";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;
const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"];

async function adminContext(formData: FormData) {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);
  return { locale, supabase: user.supabase, userId: user.userId };
}

// Qualification : AFRICA NEX a pris la demande en charge (l'acheteur ne peut plus l'annuler seul).
export async function qualifyRfq(formData: FormData) {
  const { locale, supabase, userId } = await adminContext(formData);
  const id = text(formData, "id");
  if (!UUID.test(id)) redirect(`/${locale}/admin/rfqs`);
  const { error } = await supabase.from("rfqs").update({ status: "qualified" }).eq("id", id).eq("status", "submitted");
  if (error) console.error("RFQ qualify failed:", error.message);
  else await supabase.from("audit_log").insert({ actor_profile_id: userId, action: "rfq.qualify", entity: "rfq", entity_id: id });
  redirect(`/${locale}/admin/rfqs/${id}?done=qualify`);
}

// Cloture par AFRICA NEX (demande hors perimetre, sans suite, doublon...).
export async function closeRfq(formData: FormData) {
  const { locale, supabase, userId } = await adminContext(formData);
  const id = text(formData, "id");
  if (!UUID.test(id)) redirect(`/${locale}/admin/rfqs`);
  const { error } = await supabase.from("rfqs").update({ status: "closed" }).eq("id", id).in("status", ["submitted", "qualified", "dispatched", "offered"]);
  if (error) console.error("RFQ close failed:", error.message);
  else await supabase.from("audit_log").insert({ actor_profile_id: userId, action: "rfq.close", entity: "rfq", entity_id: id });
  redirect(`/${locale}/admin/rfqs/${id}?done=close`);
}

export type DispatchField = "briefTitle" | "briefSpecs" | "quantity" | "unit" | "country" | "incoterm" | "neededBy" | "respondBy" | "companies";
export type DispatchState = { errors: Partial<Record<DispatchField, string>>; formError?: string; values?: Record<string, string>; companies?: string[]; attempt?: number };

// Envoi du brief anonymise aux producteurs choisis. Le brief ne doit jamais permettre
// d'identifier l'acheteur : le serveur refuse un texte qui contient son nom, son email ou son telephone.
export async function dispatchRfq(_prev: DispatchState, formData: FormData): Promise<DispatchState> {
  const { locale, supabase, userId } = await adminContext(formData);
  const id = text(formData, "id");
  if (!UUID.test(id)) redirect(`/${locale}/admin/rfqs`);
  const v = Object.fromEntries(["briefTitle", "briefSpecs", "quantity", "unit", "country", "incoterm", "neededBy", "respondBy"].map((k) => [k, text(formData, k)]));
  v.country = v.country.toUpperCase();
  const companies = [...new Set(formData.getAll("companies").map(String))].filter((c) => UUID.test(c));
  const fail = (s: Omit<DispatchState, "values" | "attempt" | "companies">): DispatchState => ({ ...s, values: v, companies, attempt: Date.now() });

  const errors: DispatchState["errors"] = {};
  if (v.briefTitle.length < 2 || v.briefTitle.length > 200) errors.briefTitle = "rfqErrorBriefTitle";
  if (v.briefSpecs.length > 5000) errors.briefSpecs = "rfqErrorTooLong";
  let quantity: number | null = null;
  if (v.quantity) {
    quantity = parseAmount(v.quantity);
    if (quantity === null || quantity <= 0) errors.quantity = "rfqErrorQuantity";
    if (!(UNITS as readonly string[]).includes(v.unit)) errors.unit = "rfqErrorChoose";
  }
  if (v.country && !isCountryCode(v.country)) errors.country = "rfqErrorChoose";
  if (v.incoterm && !INCOTERMS.includes(v.incoterm)) errors.incoterm = "rfqErrorChoose";
  const today = new Date().toISOString().slice(0, 10);
  if (v.neededBy && !/^\d{4}-\d{2}-\d{2}$/.test(v.neededBy)) errors.neededBy = "rfqErrorDate";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.respondBy) || v.respondBy < today) errors.respondBy = "rfqErrorRespondBy";
  if (!companies.length || companies.length > 20) errors.companies = "rfqErrorCompanies";
  if (Object.keys(errors).length) return fail({ errors });

  // Lot 6d : brief rattache a une seule ligne de la demande (ligne sans prix a faire chiffrer).
  const lineId = text(formData, "rfqLineId");
  if (lineId && !UUID.test(lineId)) redirect(`/${locale}/admin/rfqs/${id}`);
  const { data: rfq } = await supabase
    .from("rfqs")
    .select("id, status, buyer_profile_id, buyer:companies!rfqs_buyer_company_id_fkey(company_name)")
    .eq("id", id)
    .maybeSingle();
  // Une ligne peut encore etre chiffree quand des offres sont deja publiees.
  const open = lineId ? ["submitted", "qualified", "dispatched", "offered"] : ["submitted", "qualified", "dispatched"];
  if (!rfq || !open.includes(rfq.status)) return fail({ errors: {}, formError: "rfqErrorNotDispatchable" });
  if (lineId) {
    const { data: line } = await supabase.from("rfq_lines").select("id").eq("id", lineId).eq("rfq_id", id).maybeSingle();
    if (!line) redirect(`/${locale}/admin/rfqs/${id}`);
  }

  // Garde-fou d'anonymat
  const [{ data: profile }, { data: priv }] = await Promise.all([
    supabase.from("profiles").select("email, phone, whatsapp, full_name").eq("id", rfq.buyer_profile_id).maybeSingle(),
    supabase.from("rfqs").select("buyer_company_id").eq("id", id).single().then(async ({ data }) =>
      data?.buyer_company_id ? supabase.from("company_private").select("contact_phone, contact_whatsapp").eq("company_id", data.buyer_company_id).maybeSingle() : { data: null }),
  ]);
  const brief = `${v.briefTitle}\n${v.briefSpecs}`.toLowerCase();
  const digits = brief.replace(/\D/g, "");
  const buyerName = (rfq.buyer as unknown as { company_name: string } | null)?.company_name ?? "";
  const leaks = [
    buyerName.length >= 3 && brief.includes(buyerName.toLowerCase()),
    (profile?.email ?? "").length > 3 && brief.includes(profile!.email!.toLowerCase()),
    ...[profile?.phone, profile?.whatsapp, priv?.contact_phone, priv?.contact_whatsapp].map((p) => {
      const tail = (p ?? "").replace(/\D/g, "").slice(-8);
      return tail.length === 8 && digits.includes(tail);
    }),
  ];
  if (leaks.some(Boolean)) return fail({ errors: { briefSpecs: "rfqErrorLeak" } });

  // Producteurs deja consultes : on n'envoie qu'aux nouveaux.
  const sentQuery = supabase.from("rfq_dispatches").select("company_id").eq("rfq_id", id);
  const { data: existing } = await (lineId ? sentQuery.eq("rfq_line_id", lineId) : sentQuery.is("rfq_line_id", null));
  const already = new Set((existing ?? []).map((d) => d.company_id));
  const fresh = companies.filter((c) => !already.has(c));
  if (!fresh.length) return fail({ errors: { companies: "rfqErrorAlreadySent" } });

  const { error } = await supabase.from("rfq_dispatches").insert(
    fresh.map((company_id) => ({
      rfq_id: id,
      rfq_line_id: lineId || null,
      company_id,
      brief_title: v.briefTitle,
      brief_specs: v.briefSpecs || null,
      quantity,
      unit: quantity !== null ? v.unit : null,
      destination_country: v.country || null,
      requested_incoterm: v.incoterm || null,
      needed_by: v.neededBy || null,
      respond_by: v.respondBy,
      created_by: userId,
    })),
  );
  if (error) {
    console.error("RFQ dispatch failed:", error.message);
    return fail({ errors: {}, formError: "rfqErrorGeneric" });
  }
  await Promise.all([
    supabase.from("rfqs").update({ status: "dispatched" }).eq("id", id).in("status", ["submitted", "qualified"]),
    supabase.from("audit_log").insert({ actor_profile_id: userId, action: "rfq.dispatch", entity: "rfq", entity_id: id, payload: { companies: fresh, line: lineId || null } }),
  ]);
  redirect(`/${locale}/admin/rfqs/${id}?done=${lineId ? "lineDispatch" : "dispatch"}&count=${fresh.length}`);
}
