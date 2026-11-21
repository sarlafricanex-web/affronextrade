import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyCompanyId } from "@/lib/data/company";
import { getMyRequest } from "@/lib/data/requests";
import { countryName } from "@/lib/countries";
import { QuoteForm } from "@/components/requests/QuoteForm";
import { declineRequest } from "../actions";
import { listThread, markThreadRead } from "@/lib/data/messages";
import { MessageThread } from "@/components/messages/MessageThread";
import { MessageForm } from "@/components/messages/MessageForm";
import { isIncoterm } from "@/lib/incoterms";

export const instant = false;

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

// Detail d'une demande recue et formulaire de devis (maquette 16). Le fil de messages arrive au lot 5f.
export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ sent?: string; declined?: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);
  const companyId = await getMyCompanyId(user.supabase, user.userId);
  if (!companyId) redirect(`/${locale}/onboarding`);
  const [t, tm, to, tc, format, req, { sent, declined }] = await Promise.all([
    getTranslations({ locale, namespace: "requests" }),
    getTranslations({ locale, namespace: "thread" }),
    getTranslations({ locale, namespace: "onboarding" }),
    getTranslations({ locale, namespace: "catalog" }),
    getFormatter({ locale }),
    getMyRequest(user.supabase, companyId, id),
    searchParams,
  ]);
  if (!req) notFound();

  // Premiere ouverture : la demande passe "vue" (AFRICA NEX le voit dans sa console).
  if (req.status === "sent") {
    const supabase = user.supabase;
    after(async () => {
      await supabase.from("rfq_dispatches").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", id).eq("status", "sent");
    });
  }
  // Lot 5f : fil avec AFRICA NEX pour cet envoi ; les messages recus passent lus apres l'affichage.
  const thread = await listThread(user.supabase, req.rfq_id, req.id);
  if (thread.some((m) => m.sender_role === "admin" && !m.read_at)) {
    const supabase = user.supabase;
    after(() => markThreadRead(supabase, req.rfq_id, req.id));
  }

  const date = (d: string | null) => (d ? format.dateTime(new Date(`${d.slice(0, 10)}T12:00:00`), { dateStyle: "long" }) : null);
  const unitShort = req.unit ? tc(`unitShort_${req.unit}`) : "";
  const quote = req.quote;
  const locked = req.status === "declined" || req.status === "expired" || (quote && quote.status !== "submitted" && quote.status !== "draft");
  const statusKey = quote ? `quote_${quote.status}` : `dispatch_${req.status}`;
  const specs = [
    { label: t("specVolume"), value: req.quantity != null ? `${Number(req.quantity).toLocaleString(locale)} ${unitShort}`.trim() : null },
    { label: t("specDestination"), value: req.destination_country ? countryName(req.destination_country, locale) : null },
    { label: t("specIncoterm"), value: req.requested_incoterm },
    { label: t("specNeededBy"), value: date(req.needed_by) },
  ];

  return (
    <div className="flex flex-col gap-6">
      {sent && <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #10b981" }}>{t(sent === "update" ? "updatedNotice" : "sentNotice")}</p>}
      {declined && <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #f97316" }}>{t("declinedNotice")}</p>}

      <nav className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
          <Link href="/requests" className="hover:underline">{t("listTitle")}</Link>
          <span aria-hidden="true">/</span>
          <span dir="ltr" style={{ color: "var(--ink)" }}>{req.reference}</span>
        </span>
        <Link href="/requests" className="px-4 py-2 text-[11px] font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)" }}>{t("backList")}</Link>
      </nav>

      <header className="flex flex-col justify-between gap-4 p-5 md:flex-row" style={{ background: "white", border: `1px solid ${HAIR}` }}>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 text-[11px] font-bold" dir="ltr" style={{ background: "var(--ink)", color: "white" }}>{req.reference}</span>
            <span className="px-2 py-1 text-[11px] font-bold uppercase" style={{ ...caps, border: "1px solid #10b981", color: "#065f46", background: "#ecfdf5" }}>{t(statusKey)}</span>
          </div>
          <h1 className="mt-3 font-extrabold" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", lineHeight: 1.15 }}>{req.brief_title}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{t("detailIntro")}</p>
        </div>
        {req.respond_by && (
          <div className="shrink-0 p-4" style={{ border: `2px solid ${req.overdue ? "#dc2626" : "#f97316"}`, background: "#fff7ed", minWidth: 240 }}>
            <p className="text-[10px] font-bold uppercase" style={{ ...caps, color: "#c2410c" }}>{t("deadlineTitle")}</p>
            <p className="mt-1 font-bold">{t("respondBefore", { date: date(req.respond_by) ?? "" })}</p>
            {!quote && req.hoursLeft !== null && (
              <p className="mt-1 text-xs font-semibold" style={{ color: "#c2410c" }}>{req.overdue ? t("overdue") : t("hoursLeft", { hours: req.hoursLeft })}</p>
            )}
          </div>
        )}
      </header>

      <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
        <h2 className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>{t("specsTitle")}</h2>
        <dl className="grid sm:grid-cols-2 lg:grid-cols-4">
          {specs.map((s, i) => (
            <div key={s.label} className="p-4" style={{ borderInlineStart: i ? `1px solid ${HAIR}` : undefined }}>
              <dt className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{s.label}</dt>
              <dd className="mt-1 font-bold" style={{ fontSize: "1.1rem", color: s.value ? "var(--ink)" : "var(--muted)" }}>{s.value ?? t("notSpecified")}</dd>
            </div>
          ))}
        </dl>
        {req.brief_specs && <p className="whitespace-pre-line p-5 text-sm" style={{ borderTop: `1px solid ${HAIR}` }}>{req.brief_specs}</p>}
        <p className="m-5 mt-0 p-3 text-sm" style={{ background: "#fff8f3", border: `1px solid ${HAIR}` }}>{t("buyerProtected")}</p>
      </section>

      {quote && (
        <section className="p-5" style={{ background: "#ecfdf5", border: "1px solid #10b981" }}>
          <p className="font-bold">{t("yourQuote", { date: format.dateTime(new Date(quote.updated_at ?? quote.created_at), { dateStyle: "long" }) })}</p>
          <p className="mt-1 text-sm" dir="ltr" style={{ textAlign: "start" }}>
            {Number(quote.unit_price_ht).toLocaleString(locale)} {quote.currency} / {unitShort} {quote.price_basis ?? ""} · {Number(quote.quantity).toLocaleString(locale)} {unitShort} · {t("leadDaysShort", { days: quote.production_lead_days ?? 0 })}
          </p>
          {!locked && <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{t("canUpdate")}</p>}
        </section>
      )}

      {req.status === "declined" ? (
        <p className="p-5" style={{ background: "white", border: `1px solid ${HAIR}`, color: "var(--muted)" }}>{t("declinedText")}</p>
      ) : locked ? (
        <p className="p-5" style={{ background: "white", border: `1px solid ${HAIR}`, color: "var(--muted)" }}>{t(`locked_${quote?.status ?? "expired"}`)}</p>
      ) : (
        <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4" style={{ background: "var(--ink)", color: "white" }}>
            <div>
              <h2 className="font-bold">{t("formTitle")}</h2>
              <p className="text-xs" style={{ color: "#cbd5e1" }}>{t("formIntro")}</p>
            </div>
          </div>
          <div className="p-5">
            <QuoteForm
              dispatchId={req.id}
              update={Boolean(quote)}
              unitLabel={unitShort || to("unit")}
              defaults={{
                currency: quote?.currency ?? "USD",
                unitPrice: quote ? String(quote.unit_price_ht) : "",
                priceBasis: quote?.price_basis ?? (isIncoterm(req.requested_incoterm) ? req.requested_incoterm : "FOB"),
                port: quote?.port_of_loading ?? "",
                quantity: quote ? String(quote.quantity) : req.quantity != null ? String(req.quantity) : "",
                leadDays: quote?.production_lead_days != null ? String(quote.production_lead_days) : "",
                availableOn: quote?.available_at_port_on ?? "",
                paymentTerms: quote?.payment_terms ?? "",
                validUntil: quote?.valid_until ?? "",
                notes: quote?.notes ?? "",
              }}
            />
          </div>
          {!quote && (req.status === "sent" || req.status === "viewed") && (
            <form action={declineRequest} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4" style={{ borderTop: `1px solid ${HAIR}` }}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={req.id} />
              <p className="text-xs" style={{ color: "var(--muted)" }}>{t("declineHelp")}</p>
              <button type="submit" className="px-4 py-2.5 text-xs font-bold uppercase" style={{ ...caps, border: "1px solid #dc2626", color: "#dc2626", background: "white" }}>{t("decline")}</button>
            </form>
          )}
        </section>
      )}

      {/* Lot 5f : fil avec AFRICA NEX (maquette 16) */}
      <section id="messages" style={{ background: "white", border: `1px solid ${HAIR}`, scrollMarginTop: 16 }} aria-labelledby="messages-title">
        <div className="px-5 py-4" style={{ background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>
          <h2 id="messages-title" className="font-extrabold" style={{ fontSize: "1.1rem" }}>{tm("producerTitle")}</h2>
          <p className="text-xs" style={{ color: "var(--muted)" }}>{tm("producerIntro")}</p>
        </div>
        <MessageThread messages={thread} mine="producer" otherName={tm("africanex")} otherInitials="AN" locale={locale} emptyText={tm("producerEmpty")} />
        <MessageForm rfqId={req.rfq_id} dispatchId={req.id} placeholder={tm("producerPlaceholder")} />
      </section>
    </div>
  );
}
