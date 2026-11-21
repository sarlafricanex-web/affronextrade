"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/auth/next-path";
import { notify } from "@/lib/notify";

// Lot 5f : envoi d'un message dans un fil (acheteur, producteur ou AFRICA NEX). La RLS verifie le
// role, le fil et la demande ; ici, on verifie le texte et l'anonymat des messages d'AFRICA NEX :
//   - vers un producteur : jamais l'entreprise, le nom, l'email ou le telephone de l'acheteur ;
//   - vers l'acheteur : jamais le nom d'un producteur consulte ou d'un fournisseur d'une offre.
export type MessageState = { error?: string; value?: string; attempt?: number };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const one = <T,>(x: unknown) => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null)) as T | null;

export async function sendMessage(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const locale = resolveLocale(text(formData, "locale"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const rfqId = text(formData, "rfqId");
  const dispatchId = text(formData, "dispatchId") || null;
  const body = text(formData, "body");
  const fail = (error: string): MessageState => ({ error, value: body, attempt: Date.now() });
  if (!UUID.test(rfqId) || (dispatchId && !UUID.test(dispatchId))) redirect(`/${locale}/dashboard`);
  if (!body) return fail("errorEmpty");
  if (body.length > 5000) return fail("errorTooLong");
  const supabase = user.supabase;

  let back: string;
  if (user.role === "buyer") {
    if (dispatchId) redirect(`/${locale}/rfq/${rfqId}`);
    back = `/${locale}/rfq/${rfqId}`;
  } else if (user.role === "producer") {
    // Le producteur ecrit dans le fil de son envoi ; la demande de l'acheteur lui reste invisible.
    const { data: d } = dispatchId ? await supabase.from("rfq_dispatches").select("id, rfq_id").eq("id", dispatchId).maybeSingle() : { data: null };
    if (!d || d.rfq_id !== rfqId) redirect(`/${locale}/requests`);
    back = `/${locale}/requests/${dispatchId}`;
  } else if (user.role === "admin") {
    const lower = body.toLowerCase();
    const bodyDigits = digits(body);
    if (dispatchId) {
      const { data: rfq } = await supabase
        .from("rfqs")
        .select("buyer_profile_id, buyer_company_id, buyer:companies!rfqs_buyer_company_id_fkey(company_name)")
        .eq("id", rfqId)
        .maybeSingle();
      const [{ data: profile }, { data: contact }] = await Promise.all([
        rfq ? supabase.from("profiles").select("full_name, email, phone, whatsapp").eq("id", rfq.buyer_profile_id).maybeSingle() : Promise.resolve({ data: null }),
        rfq?.buyer_company_id ? supabase.from("company_private").select("contact_phone, contact_whatsapp").eq("company_id", rfq.buyer_company_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const words = [one<{ company_name: string }>(rfq?.buyer)?.company_name, profile?.full_name, profile?.email].filter((w): w is string => !!w && w.length >= 3);
      const phones = [profile?.phone, profile?.whatsapp, contact?.contact_phone, contact?.contact_whatsapp].map(digits).filter((p) => p.length >= 8);
      if (words.some((w) => lower.includes(w.toLowerCase())) || phones.some((p) => bodyDigits.includes(p.slice(-8)))) return fail("errorLeakBuyer");
    } else {
      const [{ data: dispatches }, { data: offerLines }] = await Promise.all([
        supabase.from("rfq_dispatches").select("company:companies(company_name)").eq("rfq_id", rfqId),
        supabase.from("offer_lines").select("offer_line_margins(company:companies(company_name)), offers!inner(rfq_id)").eq("offers.rfq_id", rfqId),
      ]);
      const names = [
        ...(dispatches ?? []).map((d) => one<{ company_name: string }>(d.company)?.company_name),
        ...(offerLines ?? []).map((l) => one<{ company_name: string }>(one<{ company: unknown }>(l.offer_line_margins)?.company)?.company_name),
      ].filter((n): n is string => !!n && n.length >= 3);
      if (names.some((n) => lower.includes(n.toLowerCase()))) return fail("errorLeakProducer");
    }
    back = `/${locale}/admin/rfqs/${rfqId}`;
  } else {
    redirect(`/${locale}/dashboard`);
  }

  const { error } = await supabase.from("messages").insert({
    rfq_id: rfqId,
    dispatch_id: dispatchId,
    sender_profile_id: user.userId,
    sender_role: user.role as "buyer" | "producer" | "admin",
    body,
  });
  if (error) {
    if (!/row-level security/.test(error.message)) console.error("Message insert failed:", error.code, error.message);
    return fail("errorClosed");
  }

  // Email au destinataire : jamais le texte du message (il ne s'affiche que dans l'espace).
  if (user.role === "admin") {
    if (dispatchId) {
      const { data: d } = await supabase.from("rfq_dispatches").select("company_id, reference").eq("id", dispatchId).maybeSingle();
      if (d) notify.company(d.company_id, { kind: "new_message", variant: "producer", rfqId, path: `/requests/${dispatchId}#messages`, values: { reference: d.reference } });
    } else {
      const { data: r } = await supabase.from("rfqs").select("buyer_profile_id, reference").eq("id", rfqId).maybeSingle();
      if (r) notify.profile(r.buyer_profile_id, { kind: "new_message", variant: "buyer", rfqId, path: `/rfq/${rfqId}#messages`, values: { reference: r.reference } });
    }
  } else if (user.role === "buyer") {
    const { data: r } = await supabase.from("rfqs").select("reference, buyer:companies!rfqs_buyer_company_id_fkey(company_name)").eq("id", rfqId).maybeSingle();
    notify.admin({ kind: "admin_new_message", rfqId, path: `/admin/rfqs/${rfqId}#messages`, values: { reference: r?.reference ?? "", who: one<{ company_name: string }>(r?.buyer)?.company_name ?? "Acheteur" } });
  } else {
    const { data: d } = await supabase.from("rfq_dispatches").select("reference, company:companies(company_name)").eq("id", dispatchId!).maybeSingle();
    notify.admin({ kind: "admin_new_message", rfqId, path: `/admin/rfqs/${rfqId}?thread=${dispatchId}#messages`, values: { reference: d?.reference ?? "", who: one<{ company_name: string }>(d?.company)?.company_name ?? "Producteur" } });
  }
  redirect(`${back}?${user.role === "admin" && dispatchId ? `thread=${dispatchId}&` : ""}msg=sent#messages`);
}
