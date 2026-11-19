import { getFormatter, getTranslations } from "next-intl/server";
import type { BuyerOffer, RfqLine } from "@/lib/data/rfq";
import { decideOffer } from "@/app/[locale]/(app)/rfq/actions";

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const CURRENCIES = ["EUR", "USD", "DZD"] as const;
const summaryButton = "flex cursor-pointer list-none items-center justify-center px-4 py-3 text-xs font-bold uppercase [&::-webkit-details-marker]:hidden";

// Lot 5e : offres AFRICA NEX presentees a l'acheteur (maquette 14), sans aucune donnee du calcul.
// Chaque offre se decide separement ; deux offres portant sur les memes produits sont des alternatives.
export async function BuyerOffers({
  rfqId,
  rfqStatus,
  locale,
  offers,
  lines,
  today,
}: {
  rfqId: string;
  rfqStatus: string;
  locale: string;
  offers: BuyerOffer[];
  lines: RfqLine[];
  today: string;
}) {
  const [t, tc, format] = await Promise.all([
    getTranslations({ locale, namespace: "rfq" }),
    getTranslations({ locale, namespace: "catalog" }),
    getFormatter({ locale }),
  ]);
  const money = (n: number | string | null, currency: string) =>
    `${Number(n ?? 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  const qty = (n: number | string) => Number(n).toLocaleString(locale, { maximumFractionDigits: 2 });
  const unit = (u: string | null) => (u ? tc(`unitShort_${u}`) : "");
  const date = (d: string) => format.dateTime(new Date(`${d.slice(0, 10)}T12:00:00`), { dateStyle: "long" });
  const daysLeft = (d: string) => Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 864e5);

  // Produits couverts par chaque offre (une offre sans lignes couvre toute la demande).
  const covered = (o: BuyerOffer) => new Set((o.offer_lines ?? []).map((l) => l.rfq_line_id).filter(Boolean) as string[]);
  const overlaps = (a: BuyerOffer, b: BuyerOffer) => {
    const ca = covered(a), cb = covered(b);
    return !ca.size || !cb.size || [...ca].some((id) => cb.has(id));
  };
  const open = (o: BuyerOffer) => o.status === "published" && rfqStatus === "offered" && (!o.valid_until || o.valid_until >= today);
  const live = offers.filter((o) => o.status === "published" || o.status === "accepted");
  const coveredAll = live.some((o) => !covered(o).size);
  const coveredIds = new Set(live.flatMap((o) => [...covered(o)]));
  const pending = coveredAll ? [] : lines.filter((l) => !coveredIds.has(l.id));
  const accepted = offers.filter((o) => o.status === "accepted");
  const acceptedTotals = [...new Set(accepted.map((o) => o.currency))].map((c) => money(accepted.filter((o) => o.currency === c).reduce((s, o) => s + Number(o.total_amount ?? 0), 0), c));
  const linePosition = new Map(lines.map((l) => [l.id, l.position]));

  return (
    <section id="offers" style={{ background: "white", border: `1px solid ${HAIR}`, scrollMarginTop: 16 }} aria-labelledby="offers-title" data-buyer-offers={offers.length}>
      <div className="flex flex-col gap-2 px-5 py-4" style={{ background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>
        <h2 id="offers-title" className="flex items-center gap-2 font-extrabold" style={{ fontSize: "1.2rem" }}>
          <span aria-hidden="true" className="inline-block h-3 w-3" style={{ background: "var(--ink)" }} />
          {t("offersTitle")}
        </h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>{t("offersIntro", { count: offers.length })}</p>
        {accepted.length > 0 && <p className="text-sm font-semibold" style={{ color: "#065f46" }} data-accepted-total="">{t("offersAccepted", { count: accepted.length, total: acceptedTotals.join(" + ") })}</p>}
        {pending.length > 0 && (
          <p className="text-sm" data-lines-pending={pending.length}>
            <strong>{t("offersPendingLines")}</strong> {pending.map((l) => `${l.position}. ${l.description}`).join(" · ")}
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-2">
        {offers.map((o, i) => {
          const ls = o.offer_lines ?? [];
          const alternatives = offers.filter((x) => x.id !== o.id && x.status === "published" && o.status === "published" && overlaps(o, x));
          const days = o.valid_until ? daysLeft(o.valid_until) : null;
          const expired = o.status === "expired" || (o.status === "published" && days !== null && days < 0);
          const statusKey = expired ? "expired" : o.status;
          const lead = o.lead_time_days ?? (ls.length ? Math.max(0, ...ls.map((l) => l.lead_time_days ?? 0)) || null : null);
          const single = ls.length === 1 ? ls[0] : null;
          const place = [o.incoterm, o.incoterm_place].filter(Boolean).join(" ");
          const rows: [string, string | null][] = [
            [t("offerLead"), lead != null ? t("offerLeadDays", { days: lead }) : null],
            [t("offerOrigin"), o.origin_region],
            [t("offerPackaging"), o.packaging],
            [t("offerCertifications"), o.certifications],
            [t("offerPayment"), o.payment_terms],
            [t("offerInsurance"), o.cagex_insured ? t("offerInsuranceIncluded") : null],
          ];
          return (
            <article
              key={o.id}
              className="flex flex-col"
              style={{ borderTop: `1px solid ${HAIR}`, borderInlineStart: i % 2 ? `1px solid ${HAIR}` : undefined, opacity: o.status === "declined" || expired ? 0.7 : 1 }}
              data-buyer-offer={o.label}
              data-status={statusKey}
            >
              <header className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase" style={{ ...caps, color: "#059669" }}>{t("offerKicker")}</p>
                  <h3 className="font-extrabold" style={{ fontSize: "1.6rem", lineHeight: 1.1 }}>{t("offerName", { label: o.label })}</h3>
                  {ls.length > 0 && lines.length > 1 && (
                    <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{t("offerCovers", { count: ls.length, lines: ls.map((l) => (l.rfq_line_id ? linePosition.get(l.rfq_line_id) : null) ?? l.position).join(", ") })}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 text-end">
                  <span className="px-2 py-1 text-[10px] font-bold uppercase" style={{ ...caps, ...(statusKey === "accepted" ? { background: "#10b981", color: "white" } : statusKey === "published" ? { background: "#fff7ed", color: "#c2410c", border: "1px solid #fdba74" } : { background: "#f5efe6", color: "var(--muted)" }) }}>
                    {t(`offerStatus_${statusKey}`)}
                  </span>
                  {o.valid_until && o.status === "published" && !expired && <span className="text-xs" style={{ color: "var(--muted)" }}>{t("offerValidity", { date: date(o.valid_until), days: days ?? 0 })}</span>}
                  {alternatives.length > 0 && <span className="text-[10px] font-bold uppercase" style={{ ...caps, color: "#92400e" }} data-alternative="">{t("offerAlternative", { labels: alternatives.map((x) => x.label).join(", ") })}</span>}
                </div>
              </header>

              <div className="px-5 py-4" style={{ background: "#ecfdf5", borderTop: `1px solid ${HAIR}`, borderInlineStart: "4px solid #059669" }}>
                {single || !ls.length ? (
                  <>
                    <p className="text-[10px] font-bold uppercase" style={{ ...caps, color: "#065f46" }}>{t("offerUnitPrice", { place })}</p>
                    <p className="mt-1" dir="ltr" style={{ textAlign: "start" }}>
                      <strong style={{ fontSize: "2rem" }}>{Number(single?.unit_price ?? o.unit_price ?? 0).toLocaleString(locale, { minimumFractionDigits: 2 })}</strong>{" "}
                      <span className="font-semibold">{o.currency} / {unit(single?.unit ?? null) || t("offerUnitFallback")}</span>
                    </p>
                    {(single || o.quantity) && <p className="text-xs" style={{ color: "var(--muted)" }}>{single ? `${single.description} · ` : ""}{qty(single?.quantity ?? o.quantity ?? 0)} {unit(single?.unit ?? null)}</p>}
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-bold uppercase" style={{ ...caps, color: "#065f46" }}>{t("offerLinesTitle", { place })}</p>
                    <div style={{ overflowX: "auto" }}>
                      <table className="mt-2 w-full text-sm" style={{ minWidth: 360 }}>
                        <tbody>
                          {ls.map((l) => (
                            <tr key={l.id} style={{ borderTop: `1px solid #a7f3d0` }} data-offer-line={l.position}>
                              <td className="py-1.5 pe-2 font-semibold">{l.description}</td>
                              <td className="py-1.5 pe-2 whitespace-nowrap" dir="ltr" style={{ textAlign: "start" }}>{qty(l.quantity)} {unit(l.unit)}</td>
                              <td className="py-1.5 pe-2 whitespace-nowrap" dir="ltr" style={{ textAlign: "start" }}>{money(l.unit_price, o.currency)}</td>
                              <td className="py-1.5 whitespace-nowrap font-bold" dir="ltr" style={{ textAlign: "end" }}>{money(l.total_amount, o.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              <dl className="text-sm">
                {o.freight_amount != null && (
                  <div className="flex justify-between gap-3 px-5 py-3" style={{ borderTop: `1px solid ${HAIR}` }} data-offer-freight={o.freight_amount}>
                    <dt className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("offerFreight")}</dt>
                    <dd className="font-semibold" dir="ltr">{money(o.freight_amount, o.currency)}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-3 px-5 py-3" style={{ borderTop: `1px solid ${HAIR}` }}>
                  <dt className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("offerTotal", { place })}</dt>
                  <dd className="font-extrabold" dir="ltr" style={{ fontSize: "1.2rem" }} data-offer-total={o.total_amount}>{money(o.total_amount, o.currency)}</dd>
                </div>
                {rows.filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="px-5 py-3" style={{ borderTop: `1px solid ${HAIR}` }}>
                    <dt className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{label}</dt>
                    <dd className="mt-0.5 font-semibold">{value}</dd>
                  </div>
                ))}
                {o.notes && <p className="whitespace-pre-line px-5 py-3 text-sm" style={{ borderTop: `1px solid ${HAIR}` }}>{o.notes}</p>}
              </dl>

              {o.currency_change_to && o.status === "published" && (
                <p className="mx-5 mb-3 px-3 py-2 text-xs font-semibold" style={{ background: "#fff7ed", borderInlineStart: "3px solid #f97316" }} data-currency-requested={o.currency_change_to}>
                  {t("offerCurrencyRequested", { currency: o.currency_change_to })}
                </p>
              )}
              {o.status === "declined" && o.decline_reason && <p className="mx-5 mb-3 text-xs" style={{ color: "var(--muted)" }}>{t("offerYourReason", { reason: o.decline_reason })}</p>}

              {open(o) && (
                <div className="mt-auto flex flex-col gap-2 px-5 py-4" style={{ background: "#fff8f3", borderTop: `1px solid ${HAIR}` }}>
                  <details className="group" data-action="accept">
                    <summary className={summaryButton} style={{ ...caps, background: "#065f46", color: "white" }}>{t("offerAccept", { label: o.label })}</summary>
                    <form action={decideOffer} className="mt-2 flex flex-col gap-2 p-3 text-sm" style={{ background: "white", border: `1px solid ${HAIR}` }}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="rfqId" value={rfqId} />
                      <input type="hidden" name="offerId" value={o.id} />
                      <input type="hidden" name="op" value="accept" />
                      <p>{t("offerAcceptConfirm", { label: o.label, total: money(o.total_amount, o.currency) })}</p>
                      {alternatives.length > 0 && <p className="text-xs font-semibold" style={{ color: "#92400e" }}>{t("offerAcceptAlternatives", { labels: alternatives.map((x) => x.label).join(", ") })}</p>}
                      <button type="submit" className="px-4 py-2.5 text-xs font-bold uppercase" style={{ ...caps, background: "#10b981", color: "white" }}>{t("offerAcceptSubmit")}</button>
                    </form>
                  </details>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <details data-action="decline">
                      <summary className={summaryButton} style={{ ...caps, border: "1px solid var(--ink)", background: "white" }}>{t("offerDecline")}</summary>
                      <form action={decideOffer} className="mt-2 flex flex-col gap-2 p-3 text-sm" style={{ background: "white", border: `1px solid ${HAIR}` }}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="rfqId" value={rfqId} />
                        <input type="hidden" name="offerId" value={o.id} />
                        <input type="hidden" name="op" value="decline" />
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-semibold">{t("offerDeclineReason")}</span>
                          <textarea name="reason" rows={3} maxLength={500} className="w-full resize-y px-3 py-2 text-sm" style={{ background: "var(--field-a)", border: "1px solid var(--field-b)" }} />
                        </label>
                        <button type="submit" className="px-4 py-2.5 text-xs font-bold uppercase" style={{ ...caps, border: "1px solid #dc2626", color: "#dc2626", background: "white" }}>{t("offerDeclineSubmit")}</button>
                      </form>
                    </details>
                    {!o.currency_change_to && (
                      <details data-action="currency">
                        <summary className={summaryButton} style={{ ...caps, border: "1px solid var(--ink)", background: "white" }}>{t("offerCurrency")}</summary>
                        <form action={decideOffer} className="mt-2 flex flex-col gap-2 p-3 text-sm" style={{ background: "white", border: `1px solid ${HAIR}` }}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="rfqId" value={rfqId} />
                          <input type="hidden" name="offerId" value={o.id} />
                          <input type="hidden" name="op" value="currency" />
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold">{t("offerCurrencyChoice", { currency: o.currency })}</span>
                            <select name="currency" required className="w-full px-3 py-2 text-sm" style={{ background: "var(--field-a)", border: "1px solid var(--field-b)" }}>
                              {CURRENCIES.filter((c) => c !== o.currency).map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold">{t("offerCurrencyNote")}</span>
                            <textarea name="note" rows={2} maxLength={500} className="w-full resize-y px-3 py-2 text-sm" style={{ background: "var(--field-a)", border: "1px solid var(--field-b)" }} />
                          </label>
                          <p className="text-xs" style={{ color: "var(--muted)" }}>{t("offerCurrencyHelp")}</p>
                          <button type="submit" className="px-4 py-2.5 text-xs font-bold uppercase" style={{ ...caps, background: "var(--ink)", color: "white" }}>{t("offerCurrencySubmit")}</button>
                        </form>
                      </details>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
