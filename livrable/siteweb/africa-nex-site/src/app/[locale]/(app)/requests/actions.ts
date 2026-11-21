"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";
import { getMyCompanyId } from "@/lib/data/company";
import { readQuoteForm, storeQuoteFile, type QuoteState } from "@/lib/quote-input";
import { notify } from "@/lib/notify";
import { frDate, money } from "@/lib/notify/format";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;

async function producerContext(formData: FormData) {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);
  const companyId = await getMyCompanyId(user.supabase, user.userId);
  if (!companyId) redirect(`/${locale}/onboarding`);
  return { locale, supabase: user.supabase, userId: user.userId, companyId };
}

// Devis du producteur vers AFRICA NEX (jamais transmis tel quel a l'acheteur).
// Premier envoi : creation ; ensuite : mise a jour tant qu'AFRICA NEX ne l'a pas retenu (RLS).
export async function submitQuote(_prev: QuoteState, formData: FormData): Promise<QuoteState> {
  const { locale, supabase, userId, companyId } = await producerContext(formData);
  const id = text(formData, "id");
  if (!UUID.test(id)) redirect(`/${locale}/requests`);
  const { values, errors, fields, upload } = await readQuoteForm(formData);
  const fail = (s: Omit<QuoteState, "values" | "attempt">): QuoteState => ({ ...s, values, attempt: Date.now() });
  if (Object.keys(errors).length) return fail({ errors });

  const { data: dispatch } = await supabase.from("rfq_dispatches").select("id, status, quotes(id, status)").eq("id", id).eq("company_id", companyId).maybeSingle();
  if (!dispatch) redirect(`/${locale}/requests`);
  const q = dispatch.quotes as unknown;
  const existing = (Array.isArray(q) ? q[0] : q) as { id: string; status: string } | null | undefined;
  if (dispatch.status === "declined" || dispatch.status === "expired" || (existing && existing.status !== "submitted" && existing.status !== "draft")) {
    return fail({ errors: {}, formError: "errorLocked" });
  }

  let quoteId = existing?.id ?? null;
  if (existing) {
    const { error } = await supabase.from("quotes").update(fields).eq("id", existing.id);
    if (error) { console.error("Quote update failed:", error.message); return fail({ errors: {}, formError: "errorGeneric" }); }
  } else {
    const { data: created, error } = await supabase.from("quotes").insert({ ...fields, dispatch_id: id, company_id: companyId, author_profile_id: userId }).select("id").single();
    if (error || !created) { console.error("Quote insert failed:", error?.code, error?.message); return fail({ errors: {}, formError: "errorGeneric" }); }
    quoteId = created.id;
  }
  if (upload && quoteId) await storeQuoteFile(supabase, id, quoteId, upload, formData.get("file") as File);

  // Email a AFRICA NEX : devis recu ou mis a jour.
  const [{ data: d }, { data: q2 }] = await Promise.all([
    supabase.from("rfq_dispatches").select("rfq_id, reference, unit, company:companies(company_name)").eq("id", id).maybeSingle(),
    quoteId ? supabase.from("quotes").select("unit_price_ht, currency, price_basis, quantity, valid_until").eq("id", quoteId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (d) {
    const company = (Array.isArray(d.company) ? d.company[0] : d.company) as { company_name: string } | null;
    notify.admin({
      kind: "admin_new_quote",
      variant: existing ? "update" : undefined,
      rfqId: d.rfq_id,
      path: `/admin/rfqs/${d.rfq_id}`,
      values: { reference: d.reference, producer: company?.company_name ?? "-" },
      rows: [
        ["rowReference", d.reference],
        ["rowProducer", company?.company_name ?? "-"],
        ["rowPrice", q2 ? `${money(q2.unit_price_ht, q2.currency)} ${q2.price_basis ?? ""}`.trim() : "-"],
        ["rowValidUntil", frDate(q2?.valid_until)],
      ],
    });
  }

  redirect(`/${locale}/requests/${id}?sent=${existing ? "update" : "new"}`);
}

// Le producteur decline la demande (possible tant qu'il n'a pas envoye de devis).
export async function declineRequest(formData: FormData) {
  const { locale, supabase, companyId } = await producerContext(formData);
  const id = text(formData, "id");
  if (!UUID.test(id)) redirect(`/${locale}/requests`);
  const { error } = await supabase.from("rfq_dispatches").update({ status: "declined" }).eq("id", id).eq("company_id", companyId).in("status", ["sent", "viewed"]);
  if (error) console.error("Dispatch decline failed:", error.message);
  redirect(`/${locale}/requests/${id}?declined=1`);
}
