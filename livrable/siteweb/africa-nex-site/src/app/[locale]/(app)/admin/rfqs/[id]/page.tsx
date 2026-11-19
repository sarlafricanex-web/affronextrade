import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAdminRfq, listDispatchableProducers } from "@/lib/data/admin-rfqs";
import { rfqAttachments, type RfqLine } from "@/lib/data/rfq";
import { RfqLinesTable } from "@/components/rfq/RfqLinesTable";
import { destinationLabel, volumeLabel } from "@/lib/rfq-display";
import { countryName } from "@/lib/countries";
import { WILAYAS } from "@/lib/onboarding/reference";
import { isSector } from "@/lib/sectors";
import { StatusBadge } from "@/components/rfq/RfqList";
import { DispatchForm } from "@/components/admin/DispatchForm";
import { AutoOfferPanel } from "@/components/admin/AutoOfferPanel";
import { computeRfqAutoOffers } from "@/lib/data/auto-offer";
import { closeRfq, qualifyRfq } from "../actions";
import { changeOffer, chooseLineQuote } from "../offer-actions";
import { oneOf } from "@/lib/data/requests";
import { after } from "next/server";
import { listRfqMessages, markThreadRead } from "@/lib/data/messages";
import { MessageThread } from "@/components/messages/MessageThread";
import { MessageForm } from "@/components/messages/MessageForm";

export const instant = false;

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

// Fiche d'une demande cote AFRICA NEX : identite de l'acheteur (jamais transmise aux producteurs),
// qualification, brief anonymise et envoi aux producteurs choisis.
export default async function AdminRfqPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ done?: string; count?: string; line?: string; thread?: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);
  const [t, tm, tr, tc, ts, format, rfq, producers, { done, count, line: lineParam, thread: threadParam }] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getTranslations({ locale, namespace: "thread" }),
    getTranslations({ locale, namespace: "rfq" }),
    getTranslations({ locale, namespace: "catalog" }),
    getTranslations({ locale, namespace: "sectors" }),
    getFormatter({ locale }),
    getAdminRfq(user.supabase, id),
    listDispatchableProducers(user.supabase),
    searchParams,
  ]);
  if (!rfq) notFound();

  const buyer = rfq.buyer as unknown as { id: string; company_name: string; country: string | null; city: string | null; buyer_type: string | null; website: string | null } | null;
  const source = rfq.source as unknown as { id: string; company_name: string; slug: string } | null;
  const product = rfq.product as unknown as { product_name: string; hs_code: string | null } | null;
  const date = (d: string | null) => (d ? format.dateTime(new Date(`${d.slice(0, 10)}T12:00:00`), { dateStyle: "long" }) : null);
  const files = rfqAttachments(rfq);
  const volume = volumeLabel(rfq, tr, tc, locale);
  // Brief prerempli SANS l'identite de l'acheteur : AFRICA NEX le relit avant l'envoi.
  const lines = (rfq.rfq_lines ?? []) as RfqLine[];
  const linePosition = new Map(lines.map((l) => [l.id, l.position]));
  // Lot 6d : brief d'une seule ligne (?line=...), possible tant que la demande est ouverte.
  const consultLine = lineParam ? lines.find((l) => l.id === lineParam) ?? null : null;
  const dispatchable = consultLine
    ? ["submitted", "qualified", "dispatched", "offered"].includes(rfq.status)
    : ["submitted", "qualified", "dispatched"].includes(rfq.status);
  const sentIds = new Set(
    rfq.dispatches
      .filter((d) => (d.rfq_line_id ?? null) === (consultLine?.id ?? null))
      .map((d) => (d.company as unknown as { id: string }).id),
  );
  const lineText = (l: RfqLine) =>
    `${l.position}. ${l.description}${l.reference ? ` (${l.reference})` : ""}${l.quantity != null ? ` : ${Number(l.quantity).toLocaleString(locale)} ${l.unit ? tc(`unitShort_${l.unit}`) : ""}`.trimEnd() : ""}`;
  const specs = [
    lines.length > 1 ? lines.map(lineText).join("\n") : null,
    rfq.quantity_mode === "containers" ? `${tr("specQuantity")} : ${volume}` : null,
    rfq.destination_port ? `${tr("port")} : ${rfq.destination_port}` : null,
    rfq.description,
  ].filter(Boolean).join("\n");

  // Devis recus, compares (meilleur prix par devise) ; offres deja composees par devis.
  type Company = { id: string; company_name: string; slug: string; claim_status: string; owner_profile_id: string | null; wilaya: string | null; city: string | null };
  const quotes = rfq.dispatches
    .flatMap((d) => {
      const q = oneOf(d.quotes);
      return q && q.status !== "withdrawn" && q.status !== "draft" ? [{ d, q, company: d.company as unknown as Company }] : [];
    })
    .sort((a, b) => Number(a.q.unit_price_ht) - Number(b.q.unit_price_ht));
  // Meilleur prix par devise, et par ligne pour les devis d'une ligne.
  const bestKey = (d: { rfq_line_id: string | null }, currency: string) => `${d.rfq_line_id ?? ""}:${currency}`;
  const bestPrice = new Map<string, number>();
  for (const { d, q } of quotes) if (!bestPrice.has(bestKey(d, q.currency))) bestPrice.set(bestKey(d, q.currency), Number(q.unit_price_ht));
  const peers = (d: { rfq_line_id: string | null }) => quotes.filter((x) => (x.d.rfq_line_id ?? null) === (d.rfq_line_id ?? null)).length;
  const offerByQuote = new Map(rfq.offers.map((o) => [oneOf(o.offer_margins)?.source_quote_id ?? "", o]));
  const canOffer = ["qualified", "dispatched", "offered"].includes(rfq.status);
  // Lots 6c et 6d : offre calculee depuis les listes de prix et les devis recus par ligne.
  const [autoResult, { data: choices }] = await Promise.all([
    lines.length ? computeRfqAutoOffers(user.supabase, rfq.id) : Promise.resolve(null),
    lines.length ? user.supabase.from("rfq_line_choices").select("rfq_line_id, quote_id").in("rfq_line_id", lines.map((l) => l.id)) : Promise.resolve({ data: [] }),
  ]);
  const chosenQuotes = new Set((choices ?? []).map((c) => c.quote_id));
  const usedQuotes = new Set((autoResult?.offers ?? []).flatMap((o) => o.lines.map((l) => l.quoteId)).filter(Boolean));
  const autoOffers = rfq.offers.filter((o) => oneOf(o.offer_margins)?.auto);
  const canEnterQuote = (d: (typeof rfq.dispatches)[number]) => {
    const q = oneOf(d.quotes);
    return d.status !== "expired" && (!q || q.status === "submitted" || q.status === "draft") && ["dispatched", "offered", "qualified"].includes(rfq.status);
  };
  const q0Notes = quotes.filter(({ q }) => q.notes).map(({ q, company }) => ({ id: q.id, name: company.company_name, notes: q.notes }));

  // Lot 5f : fils de la demande (acheteur, puis un fil par envoi a un producteur). Les fils avec des
  // messages non lus s'ouvrent d'office et passent lus apres l'affichage.
  const allMessages = await listRfqMessages(user.supabase, rfq.id);
  const threadOf = (dispatchId: string | null) => allMessages.filter((m) => (m.dispatch_id ?? null) === dispatchId);
  const unreadIn = (dispatchId: string | null) => threadOf(dispatchId).filter((m) => m.sender_role !== "admin" && !m.read_at).length;
  const toMark = [null, ...rfq.dispatches.map((d) => d.id)].filter((d) => unreadIn(d) > 0);
  if (toMark.length) {
    const supabase = user.supabase;
    after(async () => { for (const d of toMark) await markThreadRead(supabase, rfq.id, d); });
  }
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "P";

  const rows = [
    { label: tr("specQuantity"), value: volume },
    { label: tr("specDestination"), value: destinationLabel(rfq, locale) || null },
    { label: tr("specIncoterm"), value: rfq.incoterm },
    { label: tr("specNeededBy"), value: date(rfq.needed_by) },
    { label: tr("specTargetPrice"), value: rfq.target_unit_price != null ? `${Number(rfq.target_unit_price).toLocaleString(locale)} ${rfq.currency ?? ""}`.trim() : null },
    { label: t("rfqSource"), value: [product?.product_name, source?.company_name].filter(Boolean).join(" · ") || null },
  ];

  return (
    <div className="flex flex-col gap-6">
      {done && <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #10b981" }}>{t(`rfqDone_${done}`, { count: Number(count) || 0 })}</p>}

      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <nav className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
            <Link href="/admin/rfqs" className="hover:underline">{t("rfqsTitle")}</Link>
            <span aria-hidden="true">/</span>
            <span dir="ltr" style={{ color: "#059669" }}>{rfq.reference}</span>
          </nav>
          <h1 className="font-extrabold" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", lineHeight: 1.15 }}>{rfq.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={rfq.status} label={tr(`status_${rfq.status}`)} />
            <span className="text-sm" style={{ color: "var(--muted)" }}>{tr("openedOn", { date: format.dateTime(new Date(rfq.created_at), { dateStyle: "long" }) })}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {rfq.status === "submitted" && (
            <form action={qualifyRfq}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={rfq.id} />
              <button type="submit" className="px-4 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "var(--ink)", color: "white" }}>{t("rfqQualify")}</button>
            </form>
          )}
          {["submitted", "qualified", "dispatched", "offered"].includes(rfq.status) && (
            <form action={closeRfq}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={rfq.id} />
              <button type="submit" className="px-4 py-3 text-xs font-bold uppercase" style={{ ...caps, border: "1px solid #dc2626", color: "#dc2626", background: "white" }}>{t("rfqClose")}</button>
            </form>
          )}
        </div>
      </header>

      {quotes.length > 0 && (
        <section style={{ background: "white", border: `1px solid ${HAIR}` }} aria-labelledby="quotes-title">
          <h2 id="quotes-title" className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>{t("compareTitle", { count: quotes.length })}</h2>
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm" style={{ minWidth: 760 }}>
              <thead>
                <tr className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)", textAlign: "start" }}>
                  {[t("compareProducer"), t("comparePrice"), t("compareQuantity"), t("compareLead"), t("compareValid"), t("comparePayment"), ""].map((h, i) => (
                    <th key={i} className="px-4 py-3" style={{ textAlign: "start" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotes.map(({ q, d, company }) => {
                  const best = bestPrice.get(bestKey(d, q.currency)) === Number(q.unit_price_ht) && peers(d) > 1;
                  const offer = offerByQuote.get(q.id);
                  const expired = q.valid_until != null && q.valid_until < rfq.today;
                  const lineId = d.rfq_line_id;
                  return (
                    <tr key={q.id} data-quote={q.id} style={{ borderTop: `1px solid ${HAIR}`, background: best ? "#f0fdf4" : undefined }}>
                      <td className="px-4 py-3">
                        {lineId && <span className="mb-1 inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "#f5efe6" }} data-quote-line={linePosition.get(lineId)}>{t("quoteLineLabel", { position: linePosition.get(lineId) ?? "?" })}</span>}
                        <span className="block font-semibold">{company.company_name}</span>
                        <span className="block text-xs" style={{ color: "var(--muted)" }}>{[company.city, WILAYAS.find(([c]) => c === company.wilaya)?.[1]].filter(Boolean).join(", ")}</span>
                        {q.author_profile_id !== company.owner_profile_id && <span className="block text-xs font-semibold" style={{ color: "#c2410c" }}>{t("compareEnteredByUs")}</span>}
                      </td>
                      <td className="px-4 py-3" dir="ltr" style={{ textAlign: "start" }}>
                        <span className="block font-bold">{Number(q.unit_price_ht).toLocaleString(locale)} {q.currency} / {d.unit ? tc(`unitShort_${d.unit}`) : ""}</span>
                        <span className="block text-xs" style={{ color: "var(--muted)" }}>{[q.price_basis, q.port_of_loading].filter(Boolean).join(" · ")}</span>
                        {best && <span className="mt-1 inline-block px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "#10b981", color: "white" }}>{t("compareBest")}</span>}
                      </td>
                      <td className="px-4 py-3" dir="ltr" style={{ textAlign: "start" }}>{Number(q.quantity).toLocaleString(locale)} {d.unit ? tc(`unitShort_${d.unit}`) : ""}</td>
                      <td className="px-4 py-3">{q.production_lead_days != null ? t("offerDays", { days: q.production_lead_days }) : "-"}</td>
                      <td className="px-4 py-3" style={{ color: expired ? "#dc2626" : undefined }}>{date(q.valid_until) ?? "-"}{expired ? ` · ${t("compareExpired")}` : ""}</td>
                      <td className="px-4 py-3 text-xs" style={{ maxWidth: 220 }}>
                        {q.payment_terms ?? "-"}
                        {rfqAttachments(q).map((f, i) => (
                          <a key={f.path} href={`/api/rfq-files/${rfq.id}?quote=${q.id}&i=${i}`} className="mt-1 block font-semibold underline">{f.name}</a>
                        ))}
                      </td>
                      <td className="px-4 py-3">
                        {lineId ? (
                          <span className="flex flex-col items-start gap-1">
                            {chosenQuotes.has(q.id) && <span className="px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "var(--ink)", color: "white" }} data-chosen="1">{t("quoteChosen")}</span>}
                            {usedQuotes.has(q.id) && <span className="px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "#ecfdf5", color: "#065f46" }} data-used="1">{t("quoteUsed")}</span>}
                            {canOffer && ["submitted", "selected"].includes(q.status) && (
                              <form action={chooseLineQuote}>
                                <input type="hidden" name="locale" value={locale} />
                                <input type="hidden" name="rfqId" value={rfq.id} />
                                <input type="hidden" name="lineId" value={lineId} />
                                <input type="hidden" name="quote" value={chosenQuotes.has(q.id) ? "auto" : q.id} />
                                <button type="submit" className="text-xs font-bold uppercase underline" style={caps} data-choose={chosenQuotes.has(q.id) ? "auto" : q.id}>
                                  {chosenQuotes.has(q.id) ? t("quoteChooseAuto") : t("quoteChoose")}
                                </button>
                              </form>
                            )}
                          </span>
                        ) : offer ? (
                          <Link href={`/admin/rfqs/${rfq.id}/offer?quote=${q.id}`} className="text-xs font-bold uppercase underline" style={caps}>{t("compareOfferLink", { label: offer.label })}</Link>
                        ) : canOffer ? (
                          <Link href={`/admin/rfqs/${rfq.id}/offer?quote=${q.id}`} className="inline-block px-3 py-2 text-xs font-bold uppercase" style={{ ...caps, background: "var(--ink)", color: "white" }}>{t("compareCompose")}</Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {q0Notes.length > 0 && (
            <ul className="flex flex-col gap-2 px-5 py-4 text-xs" style={{ borderTop: `1px solid ${HAIR}` }}>
              {q0Notes.map((n) => <li key={n.id}><strong>{n.name} :</strong> {n.notes}</li>)}
            </ul>
          )}
        </section>
      )}

      {autoResult && (
        <AutoOfferPanel
          rfqId={rfq.id}
          locale={locale}
          result={autoResult}
          canCreate={canOffer}
          canConsult={["submitted", "qualified", "dispatched", "offered"].includes(rfq.status)}
          hasAutoDraft={autoOffers.some((o) => o.status === "draft")}
          hasAutoPublished={autoOffers.some((o) => o.status !== "draft")}
        />
      )}

      {rfq.offers.length > 0 && (
        <section style={{ background: "white", border: `1px solid ${HAIR}` }} aria-labelledby="offers-title">
          <h2 id="offers-title" className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>{t("offersTitle")}</h2>
          <ul>
            {rfq.offers.map((o) => {
              const m = oneOf(o.offer_margins);
              const lineCount = oneOf(o.offer_lines as unknown as { count: number }[])?.count ?? 0;
              const total = `${Number(o.total_amount).toLocaleString(locale, { minimumFractionDigits: 2 })} ${o.currency}`;
              return (
                <li key={o.id} data-offer={o.label} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between" style={{ borderTop: `1px solid ${HAIR}` }}>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-bold" style={{ background: "var(--ink)", color: "white" }}>{t("offerName", { label: o.label })}</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, border: `1px solid ${HAIR}`, background: o.status === "published" ? "#ecfdf5" : o.status === "accepted" ? "#10b981" : "#f5efe6", color: o.status === "accepted" ? "white" : undefined }}>{t(`offerStatus_${o.status}`)}</span>
                      {m?.auto && <span className="px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, border: `1px solid ${HAIR}` }}>{t("offerAutoBadge")}{m.export_mode ? ` · ${t(`autoMode_${m.export_mode}`)}` : ""}</span>}
                      {m?.margin_pending && <span className="px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "#fff7ed", color: "#c2410c" }} data-pending="margin">{t("offerPendingMargin")}</span>}
                      {m?.freight_pending && <span className="px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "#fff7ed", color: "#c2410c" }} data-pending="freight">{t("offerPendingFreight")}</span>}
                    </p>
                    <p className="mt-1 font-bold" dir="ltr" style={{ textAlign: "start" }}>
                      {o.unit_price == null
                        ? `${o.incoterm ?? ""} · ${o.freight_amount != null
                          ? t("offerLinesTotalFreight", { count: lineCount, total, freight: `${Number(o.freight_amount).toLocaleString(locale, { minimumFractionDigits: 2 })} ${o.currency}` })
                          : t("offerLinesTotal", { count: lineCount, total })}`
                        : `${Number(o.unit_price).toLocaleString(locale, { minimumFractionDigits: 2 })} ${o.currency} · ${o.incoterm} ${o.incoterm_place ?? ""} · ${t("offerTotal", { total })}`}
                    </p>
                    {m && !m.auto && (
                      <p className="mt-1 text-xs font-semibold" style={{ color: "#c2410c" }}>
                        {t("offerMarginLine", {
                          commission: `${Number(m.commission_amount).toLocaleString(locale, { minimumFractionDigits: 2 })} ${o.currency}`,
                          rate: Number(m.commission_rate).toLocaleString(locale),
                          insurance: `${Number(m.insurance_cost ?? 0).toLocaleString(locale, { minimumFractionDigits: 2 })} ${o.currency}`,
                          producer: `${Number(m.producer_unit_price).toLocaleString(locale)} ${m.producer_currency ?? ""}`,
                        })}
                      </p>
                    )}
                    <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                      {t("offerValidLine", { date: date(o.valid_until) ?? "-" })}
                      {o.decided_at ? ` · ${t("offerDecidedOn", { date: date(o.decided_at) ?? "-" })}` : ""}
                    </p>
                    {o.currency_change_to && o.status === "published" && (
                      <p className="mt-2 px-3 py-2 text-xs font-semibold" style={{ background: "#fff7ed", borderInlineStart: "3px solid #f97316" }} data-currency-request={o.currency_change_to}>
                        {t("offerCurrencyRequest", { currency: o.currency_change_to })}
                        {o.currency_change_note ? <span className="block font-normal">« {o.currency_change_note} »</span> : null}
                      </p>
                    )}
                    {o.status === "declined" && o.decline_reason && (
                      <p className="mt-1 text-xs" data-decline-reason="">{t("offerDeclineReasonAdmin", { reason: o.decline_reason })}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {m?.auto && (
                      <Link href={`/admin/rfqs/${rfq.id}/offers/${o.id}`} className="px-3 py-2 text-xs font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)", ...(o.status === "draft" && (m.margin_pending || m.freight_pending) ? { background: "var(--ink)", color: "white" } : {}) }} data-complete={o.label}>
                        {o.status === "draft" ? t("autoEditLink") : t("autoViewLink")}
                      </Link>
                    )}
                    {o.status === "draft" && m?.source_quote_id && (
                      <Link href={`/admin/rfqs/${rfq.id}/offer?quote=${m.source_quote_id}`} className="px-3 py-2 text-xs font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)" }}>{t("offerEdit")}</Link>
                    )}
                    {(o.status === "draft" ? (["publish", "delete"] as const) : o.status === "published" ? (["withdraw"] as const) : []).map((op) => (
                      <form key={op} action={changeOffer}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="op" value={op} />
                        <button type="submit" className="px-3 py-2 text-xs font-bold uppercase" style={{ ...caps, ...(op === "publish" ? { background: "#10b981", color: "white" } : op === "delete" ? { border: "1px solid #dc2626", color: "#dc2626", background: "white" } : { border: "1px solid var(--ink)", background: "white" }) }}>
                          {t(`offerOp_${op}`)}
                        </button>
                      </form>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Lot 5f : echanges. Jamais de fil entre l'acheteur et un producteur. */}
      <section id="messages" style={{ background: "white", border: `1px solid ${HAIR}`, scrollMarginTop: 16 }} aria-labelledby="messages-title" data-unread-threads={toMark.length}>
        <div className="px-5 py-3" style={{ background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>
          <h2 id="messages-title" className="text-xs font-bold uppercase" style={caps}>{tm("adminTitle")}</h2>
          <p className="mt-1 text-xs" style={{ color: "#c2410c" }}>{tm("adminIntro")}</p>
        </div>
        {[{ id: null as string | null, name: buyer?.company_name ?? tm("buyer"), label: tm("adminBuyerThread", { name: buyer?.company_name ?? tm("buyer") }), sub: null as string | null },
          ...rfq.dispatches.map((d) => {
            const c = d.company as unknown as { company_name: string };
            return { id: d.id as string | null, name: c.company_name, label: tm("adminProducerThread", { name: c.company_name }), sub: `${d.reference}${d.rfq_line_id ? ` · ${t("quoteLineLabel", { position: linePosition.get(d.rfq_line_id) ?? "?" })}` : ""}` };
          }),
        ].map((th) => {
          const msgs = threadOf(th.id);
          const unread = unreadIn(th.id);
          const open = th.id === null || unread > 0 || threadParam === th.id;
          return (
            <details key={th.id ?? "buyer"} open={open} style={{ borderTop: `1px solid ${HAIR}` }} data-thread={th.id ?? "buyer"}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-5 py-3 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block font-semibold">{th.label}</span>
                  {th.sub && <span className="block text-xs" dir="ltr" style={{ color: "var(--muted)", textAlign: "start" }}>{th.sub}</span>}
                </span>
                <span className="flex items-center gap-2 text-xs">
                  {unread > 0 && <span className="px-2 py-0.5 font-bold" style={{ background: "#f97316", color: "white" }} data-thread-unread={unread}>{tm("unreadCount", { count: unread })}</span>}
                  <span style={{ color: "var(--muted)" }}>{tm("messageCount", { count: msgs.length })}</span>
                </span>
              </summary>
              <MessageThread messages={msgs} mine="admin" otherName={th.name} otherInitials={initials(th.name)} locale={locale} emptyText={tm("adminEmpty")} />
              <MessageForm rfqId={rfq.id} dispatchId={th.id} to={th.id ? "producer" : "buyer"} placeholder={th.id ? tm("adminPlaceholderProducer") : tm("adminPlaceholderBuyer")} />
            </details>
          );
        })}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6" style={{ minWidth: 0 }}>
          <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
            <h2 className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>{t("rfqRequestTitle")}</h2>
            <dl className="grid sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((s) => (
                <div key={s.label} className="p-4" style={{ borderTop: `1px solid ${HAIR}`, borderInlineEnd: `1px solid ${HAIR}` }}>
                  <dt className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{s.label}</dt>
                  <dd className="mt-1 font-bold" style={{ color: s.value ? "var(--ink)" : "var(--muted)" }}>{s.value ?? tr("notSpecified")}</dd>
                </div>
              ))}
            </dl>
            {(rfq.description || files.length > 0) && (
              <div className="flex flex-col gap-3 p-5" style={{ borderTop: `1px solid ${HAIR}` }}>
                {rfq.description && <p className="whitespace-pre-line text-sm">{rfq.description}</p>}
                {files.map((f, i) => (
                  <a key={f.path} href={`/api/rfq-files/${rfq.id}?i=${i}`} className="w-fit px-3 py-2 text-sm font-semibold underline" style={{ border: `1px solid ${HAIR}` }}>{f.name}</a>
                ))}
                {files.length > 0 && <p className="text-xs" style={{ color: "#c2410c" }}>{t("rfqFilesNotShared")}</p>}
              </div>
            )}
          </section>

          <RfqLinesTable lines={lines} locale={locale} currency={rfq.currency} />

          {rfq.dispatches.length > 0 && (
            <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
              <h2 className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>{t("rfqDispatchesTitle")}</h2>
              <ul>
                {rfq.dispatches.map((d) => {
                  const c = d.company as unknown as { company_name: string; slug: string; claim_status: string; owner_profile_id: string | null };
                  return (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm" style={{ borderTop: `1px solid ${HAIR}` }}>
                      <span className="min-w-0">
                        {d.rfq_line_id && <span className="mb-1 inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "#f5efe6" }}>{t("quoteLineLabel", { position: linePosition.get(d.rfq_line_id) ?? "?" })}</span>}
                        <span className="block font-semibold">{c.company_name}</span>
                        <span className="block text-xs" dir="ltr" style={{ color: "var(--muted)", textAlign: "start" }}>{d.reference} · {t("rfqRespondBy", { date: date(d.respond_by) ?? "-" })}</span>
                        {!c.owner_profile_id && <span className="block text-xs font-semibold" style={{ color: "#c2410c" }}>{t("rfqOffline")}</span>}
                        {[d.quotes].flat().filter(Boolean).map((q, qi) => q && (
                          <span key={qi} className="mt-1 block text-xs font-semibold" dir="ltr" style={{ color: "#065f46", textAlign: "start" }}>
                            {t("rfqQuoteSummary", { price: Number(q.unit_price_ht).toLocaleString(locale), currency: q.currency, basis: q.price_basis ?? "", quantity: Number(q.quantity).toLocaleString(locale), unit: d.unit ? tc(`unitShort_${d.unit}`) : "", days: q.production_lead_days ?? 0, valid: date(q.valid_until) ?? "-" })}
                          </span>
                        ))}
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        {canEnterQuote(d) && (
                          <Link href={`/admin/rfqs/${rfq.id}/quote/${d.id}`} className="px-2 py-1 text-[10px] font-bold uppercase underline" style={{ ...caps, color: "#c2410c" }}>
                            {oneOf(d.quotes) ? t("quoteEntryEdit") : t("quoteEntryLink")}
                          </Link>
                        )}
                        <span className="px-2 py-1 text-[10px] font-bold uppercase" style={{ ...caps, background: d.status === "quoted" ? "#ecfdf5" : d.status === "declined" ? "#fef2f2" : "#f5efe6", border: `1px solid ${HAIR}` }}>{t(`dispatch_${d.status}`)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {dispatchable && (
            <section id="dispatch" className="p-5" style={{ background: "white", border: `1px solid ${HAIR}`, scrollMarginTop: 16 }} data-consult-line={consultLine?.position}>
              <h2 className="mb-4 font-extrabold" style={{ fontSize: "1.2rem" }}>
                {consultLine ? t("consultLineTitle", { position: consultLine.position }) : rfq.dispatches.length ? t("rfqDispatchMoreTitle") : t("rfqDispatchTitle")}
              </h2>
              {consultLine && (
                <p className="mb-4 text-sm">
                  <Link href={`/admin/rfqs/${rfq.id}`} className="font-semibold underline">{t("consultLineBack")}</Link>
                </p>
              )}
              <DispatchForm
                key={consultLine?.id ?? "whole"}
                rfqId={rfq.id}
                lineId={consultLine?.id}
                defaults={{
                  briefTitle: consultLine ? consultLine.description : rfq.title,
                  briefSpecs: consultLine
                    ? [consultLine.reference ? `${tr("lineReference")} : ${consultLine.reference}` : null, rfq.destination_port ? `${tr("port")} : ${rfq.destination_port}` : null].filter(Boolean).join("\n")
                    : specs,
                  quantity: consultLine
                    ? (consultLine.quantity != null ? String(consultLine.quantity) : "")
                    : rfq.quantity_mode === "units" && rfq.quantity != null ? String(rfq.quantity) : "",
                  unit: consultLine ? (consultLine.unit ?? "") : (rfq.unit ?? ""),
                  country: rfq.destination_country ?? "",
                  incoterm: "FOB",
                  neededBy: rfq.needed_by ?? "",
                  respondBy: rfq.defaultRespondBy,
                }}
                preselected={source && !consultLine ? [source.id] : []}
                producers={producers.map((p) => ({
                  id: p.id,
                  name: p.company_name,
                  place: [p.city, WILAYAS.find(([c]) => c === p.wilaya)?.[1]].filter(Boolean).join(", "),
                  sector: p.sector && isSector(p.sector) ? ts(p.sector) : "",
                  claimed: Boolean(p.owner_profile_id),
                  online: p.visibility === "published",
                  sent: sentIds.has(p.id),
                }))}
              />
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <h2 className="text-xs font-bold uppercase" style={caps}>{t("rfqBuyerTitle")}</h2>
          <p className="text-xs font-semibold" style={{ color: "#c2410c" }}>{t("rfqBuyerPrivate")}</p>
          <dl className="flex flex-col gap-2 text-sm">
            <div><dt className="text-xs" style={{ color: "var(--muted)" }}>{t("rfqBuyerCompany")}</dt><dd className="font-semibold">{buyer?.company_name ?? "-"}</dd></div>
            <div><dt className="text-xs" style={{ color: "var(--muted)" }}>{t("rfqBuyerPlace")}</dt><dd>{[buyer?.city, buyer?.country ? countryName(buyer.country, locale) : null].filter(Boolean).join(", ") || "-"}</dd></div>
            <div><dt className="text-xs" style={{ color: "var(--muted)" }}>{t("rfqBuyerContact")}</dt><dd>{rfq.buyerProfile?.full_name ?? "-"}</dd></div>
            <div><dt className="text-xs" style={{ color: "var(--muted)" }}>Email</dt><dd dir="ltr" style={{ textAlign: "start" }}>{rfq.buyerProfile?.email ?? "-"}</dd></div>
            <div><dt className="text-xs" style={{ color: "var(--muted)" }}>{t("colPhone")}</dt><dd dir="ltr" style={{ textAlign: "start" }}>{rfq.buyerContact?.contact_phone ?? rfq.buyerProfile?.phone ?? "-"}</dd></div>
            <div><dt className="text-xs" style={{ color: "var(--muted)" }}>WhatsApp</dt><dd dir="ltr" style={{ textAlign: "start" }}>{rfq.buyerContact?.contact_whatsapp ?? rfq.buyerProfile?.whatsapp ?? "-"}</dd></div>
            {buyer?.website && <div><dt className="text-xs" style={{ color: "var(--muted)" }}>{t("rfqBuyerWebsite")}</dt><dd dir="ltr" style={{ textAlign: "start" }}>{buyer.website}</dd></div>}
          </dl>
        </aside>
      </div>
    </div>
  );
}
