import { getFormatter, getTranslations } from "next-intl/server";
import type { AutoOffer, AutoResult } from "@/lib/offer-auto";
import { createAutoOffers } from "@/app/[locale]/(app)/admin/rfqs/offer-actions";

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const PRIVATE = "#c2410c";

// Lot 6c : apercu du calcul automatique sur la fiche admin d'une demande. Tout ce panneau est
// reserve a AFRICA NEX (fournisseurs, prix fournisseurs, commission, marge de negociation).
export async function AutoOfferPanel({
  rfqId,
  locale,
  result,
  canCreate,
  hasAutoDraft,
  hasAutoPublished,
}: {
  rfqId: string;
  locale: string;
  result: AutoResult;
  canCreate: boolean;
  hasAutoDraft: boolean;
  hasAutoPublished: boolean;
}) {
  const [t, tc, format] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getTranslations({ locale, namespace: "catalog" }),
    getFormatter({ locale }),
  ]);
  const money = (n: number, currency: string) => `${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  const qty = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 2 });
  const unit = (u: string | null) => (u ? tc(`unitShort_${u}`) : "");
  const date = (d: string) => format.dateTime(new Date(`${d}T12:00:00`), { dateStyle: "long" });

  return (
    <section style={{ background: "white", border: `1px solid ${HAIR}` }} aria-labelledby="auto-title" data-auto-offers={result.offers.length}>
      <h2 id="auto-title" className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>{t("autoTitle")}</h2>
      <div className="flex flex-col gap-2 px-5 py-4 text-sm">
        <p style={{ color: "var(--muted)" }}>{t("autoIntro")}</p>
        {result.offers.length > 0 && (
          <p className="font-semibold" style={{ color: PRIVATE }} data-commission-rate={result.commissionRate}>
            {t("autoDemandTotal", { total: qty(result.demandTotalRef), rate: result.commissionRate })}
          </p>
        )}
      </div>

      {result.offers.map((o) => (
        <OfferBlock key={`${o.mode}-${o.currency}`} o={o} t={t as unknown as T} money={money} qty={qty} unit={unit} date={date} />
      ))}

      {result.skipped.length > 0 && (
        <div className="px-5 py-4" style={{ borderTop: `1px solid ${HAIR}` }} data-auto-skipped={result.skipped.length}>
          <h3 className="text-xs font-bold uppercase" style={caps}>{t("autoSkippedTitle", { count: result.skipped.length })}</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {result.skipped.map((s) => (
              <li key={s.row.line_id} data-issue={s.issue}>
                <strong>{s.row.line_position}. {s.row.line_description}</strong>
                {s.row.company_name ? <span style={{ color: PRIVATE }}> · {s.row.company_name}</span> : null}
                <span style={{ color: "#b91c1c" }}> : {t(`autoIssue_${s.issue}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 px-5 py-4" style={{ borderTop: `1px solid ${HAIR}` }}>
        {!result.offers.length ? (
          <p className="text-sm font-semibold">{t("autoEmpty")}</p>
        ) : hasAutoPublished ? (
          <p className="text-sm font-semibold">{t("autoPublishedNote")}</p>
        ) : canCreate ? (
          <form action={createAutoOffers} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="rfqId" value={rfqId} />
            <button type="submit" className="px-4 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "var(--ink)", color: "white" }}>
              {hasAutoDraft ? t("autoRecreate") : t("autoCreate")}
            </button>
            {hasAutoDraft && <span className="text-xs" style={{ color: "var(--muted)" }}>{t("autoRecreateNote")}</span>}
          </form>
        ) : null}
      </div>
    </section>
  );
}

type T = (key: string, values?: Record<string, string | number>) => string;

function OfferBlock({ o, t, money, qty, unit, date }: { o: AutoOffer; t: T; money: (n: number, c: string) => string; qty: (n: number) => string; unit: (u: string | null) => string; date: (d: string) => string }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4" style={{ borderTop: `1px solid ${HAIR}` }} data-auto-offer={`${o.mode}-${o.currency}`}>
      <p className="flex flex-wrap items-center gap-2">
        <span className="px-2 py-0.5 text-xs font-bold" style={{ background: o.mode === "self" ? "var(--ink)" : "#059669", color: "white" }}>{t(`autoMode_${o.mode}`)}</span>
        <span className="font-bold" dir="ltr">{o.currency}</span>
        {o.fxRate && <span className="text-xs" style={{ color: PRIVATE }} dir="ltr">{t("autoFxRate", { currency: o.currency, rate: o.fxRate.toLocaleString() })}</span>}
      </p>

      <div style={{ overflowX: "auto" }}>
        <table className="w-full text-sm" style={{ minWidth: 820 }}>
          <thead>
            <tr className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
              {[t("autoColProduct"), t("autoColSupplier"), t("autoColQuantity"), t("autoColSupplierPrice"), t("autoColBuyerPrice"), t("autoColTotal"), t("autoColAvailability"), t("autoColDiscount")].map((h) => (
                <th key={h} className="px-3 py-2 text-start">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {o.lines.map((l) => (
              <tr key={l.row.line_id} style={{ borderTop: `1px solid ${HAIR}` }} data-auto-line={l.row.line_position}>
                <td className="px-3 py-2">
                  <span className="block font-semibold">{l.row.line_position}. {l.row.line_description}</span>
                  <span className="block text-xs" style={{ color: "var(--muted)" }}>{[l.incoterm, l.incotermPlace].filter(Boolean).join(" ")}</span>
                  {l.warnings.filter((w) => w !== "stockShort" && w !== "stockUnknown").map((w) => (
                    <span key={w} className="mt-1 me-1 inline-block px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "#fef3c7", color: "#92400e" }}>{t(`autoWarn_${w}`)}</span>
                  ))}
                </td>
                <td className="px-3 py-2 text-xs font-semibold" style={{ color: PRIVATE }}>{l.row.company_name}</td>
                <td className="px-3 py-2" dir="ltr" style={{ textAlign: "start" }}>{qty(l.quantity)} {unit(l.row.line_unit ?? l.row.product_unit)}</td>
                <td className="px-3 py-2" dir="ltr" style={{ textAlign: "start", color: PRIVATE }}>{money(l.supplierUnitPrice, l.supplierCurrency)}</td>
                <td className="px-3 py-2 font-bold" dir="ltr" style={{ textAlign: "start" }} data-buyer-price={l.unitPrice}>{money(l.unitPrice, l.currency)}</td>
                <td className="px-3 py-2" dir="ltr" style={{ textAlign: "start" }}>{money(l.total, l.currency)}</td>
                <td className="px-3 py-2 text-xs">
                  {l.availability === "stock"
                    ? t("autoAvail_stock")
                    : l.availability === "production"
                      ? <span style={{ color: "#b45309", fontWeight: 700 }}>{l.leadDays != null ? t("autoAvail_production", { days: l.leadDays }) : t("autoAvail_productionNoDays")}</span>
                      : t("autoAvail_unknown")}
                </td>
                <td className="px-3 py-2 text-xs font-semibold" style={{ color: PRIVATE }}>{l.maxDiscountRate != null ? `${l.maxDiscountRate.toLocaleString()} %` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2" style={{ maxWidth: 640 }}>
        <dt style={{ color: "var(--muted)" }}>{t("autoSumBase")}</dt><dd dir="ltr" style={{ textAlign: "start", color: PRIVATE }}>{money(o.base, o.currency)}</dd>
        {o.mode === "self" ? (
          <><dt style={{ color: "var(--muted)" }}>{t("autoSumCommission", { rate: o.commissionRate })}</dt><dd dir="ltr" style={{ textAlign: "start", color: PRIVATE }}>{money(o.commission, o.currency)}</dd></>
        ) : (
          <><dt style={{ color: "var(--muted)" }}>{t("autoSumFxMargin", { rate: o.fxMarginRate })}</dt><dd dir="ltr" style={{ textAlign: "start", color: PRIVATE }}>{money(o.fxMargin, o.currency)}</dd></>
        )}
        {o.insurance > 0 && <><dt style={{ color: "var(--muted)" }}>{t("autoSumInsurance", { rate: o.insuranceRate })}</dt><dd dir="ltr" style={{ textAlign: "start" }}>{money(o.insurance, o.currency)}</dd></>}
        <dt className="font-bold">{t("autoSumTotal")}</dt><dd className="font-bold" dir="ltr" style={{ textAlign: "start" }} data-auto-total={o.total}>{money(o.total, o.currency)}</dd>
      </dl>

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        {t("autoValid", { date: date(o.validUntil) })}{o.leadDays != null ? ` · ${t("autoLead", { days: o.leadDays })}` : ""}
      </p>
      {o.maxDiscountAmount > 0 && <p className="text-xs font-semibold" style={{ color: PRIVATE }}>{t("autoSumDiscount", { amount: money(o.maxDiscountAmount, o.currency) })}</p>}
      {o.marginPending && <p className="px-3 py-2 text-xs font-semibold" style={{ background: "#fff7ed", borderInlineStart: `3px solid ${PRIVATE}` }} data-pending="margin">{t("autoMarginPending")}</p>}
      {o.freightPending && <p className="px-3 py-2 text-xs font-semibold" style={{ background: "#fff7ed", borderInlineStart: `3px solid ${PRIVATE}` }} data-pending="freight">{t("autoFreightPending")}</p>}
      {o.mixedIncoterms && <p className="text-xs font-semibold" style={{ color: "#92400e" }}>{t("autoMixedIncoterms")}</p>}
    </div>
  );
}
