"use client";

import { useActionState, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { saveAutoOffer, type AutoOfferField, type AutoOfferState } from "@/app/[locale]/(app)/admin/rfqs/offer-actions";
import { Alert, Field, TextInput } from "@/components/auth/fields";
import { repriceOffer, type RepriceLine } from "@/lib/offer-reprice";
import { DEFAULT_INSURANCE_RATE } from "@/lib/offer-pricing";

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const box = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;
const PRIVATE = "#c2410c";
const num = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export type AutoOfferLine = RepriceLine & { id: string; position: number; description: string; unitLabel: string; supplier: string };
export type AutoOfferDefaults = { commissionRate: string; marginKind: "rate" | "amount"; margin: string; freight: string; incotermPlace: string; validUntil: string; paymentTerms: string; notes: string };

// Lot 6e : saisie d'AFRICA NEX sur une offre calculee, avec apercu du prix acheteur.
// Le serveur recalcule et enregistre ; marge ou fret laisses vides restent "a saisir".
export function AutoOfferForm({
  rfqId,
  offerId,
  mode,
  currency,
  incoterm,
  freightManaged,
  gridRate,
  maxValid,
  lines,
  defaults,
}: {
  rfqId: string;
  offerId: string;
  mode: "self" | "africanex";
  currency: string;
  incoterm: string | null;
  freightManaged: boolean;
  gridRate: number;
  maxValid: string;
  lines: AutoOfferLine[];
  defaults: AutoOfferDefaults;
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const format = useFormatter();
  const [state, action, pending] = useActionState<AutoOfferState, FormData>(saveAutoOffer, { errors: {} });
  const v = { ...defaults, ...(state.values ?? {}) } as AutoOfferDefaults;
  const [rate, setRate] = useState(v.commissionRate);
  const [marginKind, setMarginKind] = useState<"rate" | "amount">(v.marginKind === "amount" ? "amount" : "rate");
  const [margin, setMargin] = useState(v.margin);
  const [freight, setFreight] = useState(v.freight);

  const p = repriceOffer({
    mode,
    lines,
    commissionRate: num(rate),
    margin: mode === "africanex" && margin.trim() ? { kind: marginKind, value: num(margin) } : null,
    freight: freightManaged && freight.trim() ? num(freight) : null,
  });
  const money = (n: number) => `${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  const pct = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 2 });
  const err = (f: AutoOfferField) => (state.errors[f] ? <span className="text-xs font-semibold" style={{ color: "#dc2626" }} data-error={f}>{t(state.errors[f]!)}</span> : null);
  const marginMissing = mode === "africanex" && !margin.trim();
  const freightMissing = freightManaged && !freight.trim();
  const marginRateOfCost = p.base > 0 ? (p.margin / p.base) * 100 : 0;

  return (
    <form key={state.attempt ?? 0} action={action} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="rfqId" value={rfqId} />
      <input type="hidden" name="offerId" value={offerId} />

      <div className="flex flex-col gap-6" style={{ minWidth: 0 }}>
        {state.formError && <Alert tone="error">{t(state.formError)}</Alert>}

        <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <h2 className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>{t("autoEditLinesTitle")}</h2>
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm" style={{ minWidth: 640 }}>
              <thead>
                <tr className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
                  {[t("autoColProduct"), t("autoColSupplier"), t("autoColQuantity"), t("autoEditColCost"), t("autoColBuyerPrice"), t("autoColTotal")].map((h) => (
                    <th key={h} className="px-3 py-2 text-start">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.id} style={{ borderTop: `1px solid ${HAIR}` }} data-edit-line={l.position}>
                    <td className="px-3 py-2 font-semibold">{l.position}. {l.description}</td>
                    <td className="px-3 py-2 text-xs font-semibold" style={{ color: PRIVATE }}>{l.supplier}</td>
                    <td className="px-3 py-2" dir="ltr" style={{ textAlign: "start" }}>{l.quantity.toLocaleString(locale)} {l.unitLabel}</td>
                    <td className="px-3 py-2" dir="ltr" style={{ textAlign: "start", color: PRIVATE }}>{money(l.base)}</td>
                    <td className="px-3 py-2 font-bold" dir="ltr" style={{ textAlign: "start" }} data-edit-price={p.lines[i].unitPrice}>{money(p.lines[i].unitPrice)}</td>
                    <td className="px-3 py-2" dir="ltr" style={{ textAlign: "start" }}>{money(p.lines[i].total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-4 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <h2 className="text-xs font-bold uppercase" style={caps}>{t("autoEditPricingTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === "self" ? (
              <Field label={t("offerCommissionRate")} htmlFor="a-commission">
                <TextInput id="a-commission" name="commissionRate" required inputMode="decimal" dir="ltr" value={rate} onChange={(e) => setRate(e.target.value)} />
                {num(rate) !== gridRate ? (
                  <button type="button" onClick={() => setRate(String(gridRate))} className="w-fit text-xs font-semibold underline" style={{ color: "#059669" }}>{t("offerUseGrid", { rate: gridRate })}</button>
                ) : (
                  <span className="text-xs" style={{ color: "var(--muted)" }}>{t("autoEditGridNote")}</span>
                )}
                {err("commissionRate")}
              </Field>
            ) : (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-xs font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("autoEditMargin")}</legend>
                <div className="flex gap-4 text-sm">
                  {(["rate", "amount"] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="radio" name="marginKind" value={k} checked={marginKind === k} onChange={() => setMarginKind(k)} />
                      {k === "rate" ? t("autoEditMarginRate") : t("autoEditMarginAmount", { currency })}
                    </label>
                  ))}
                </div>
                <TextInput id="a-margin" name="margin" inputMode="decimal" dir="ltr" value={margin} onChange={(e) => setMargin(e.target.value)} aria-label={t("autoEditMargin")} />
                <span className="text-xs" style={{ color: PRIVATE }}>{t("autoEditMarginHint")}</span>
                {err("margin")}
              </fieldset>
            )}
            {freightManaged ? (
              <Field label={t("offerFreight", { currency })} htmlFor="a-freight">
                <TextInput id="a-freight" name="freight" inputMode="decimal" dir="ltr" value={freight} onChange={(e) => setFreight(e.target.value)} />
                <span className="text-xs" style={{ color: "var(--muted)" }}>{t("autoEditFreightHint")}</span>
                {err("freight")}
              </Field>
            ) : (
              <p className="self-end text-xs" style={{ color: "var(--muted)" }}>{t("autoEditNoFreight")}</p>
            )}
          </div>
          {incoterm === "CIF" && <p className="text-xs font-semibold" style={{ color: PRIVATE }}>{t("offerCifNote")}</p>}
        </section>

        <section className="flex flex-col gap-4 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <h2 className="text-xs font-bold uppercase" style={caps}>{t("offerTermsTitle")}</h2>
          <p className="text-xs font-semibold" style={{ color: PRIVATE }}>{t("autoEditAnonymous")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("offerIncotermPlace")} hint={t("offerIncotermPlaceHint")} htmlFor="a-place">
              <TextInput id="a-place" name="incotermPlace" maxLength={200} defaultValue={v.incotermPlace} />
              {err("incotermPlace")}
            </Field>
            <Field label={t("offerValidUntil")} htmlFor="a-valid">
              <TextInput id="a-valid" name="validUntil" type="date" required dir="ltr" defaultValue={v.validUntil} />
              <span className="text-xs" style={{ color: "var(--muted)" }}>{t("autoEditValidityHint", { date: format.dateTime(new Date(`${maxValid}T12:00:00`), { dateStyle: "long" }) })}</span>
              {err("validUntil")}
            </Field>
          </div>
          <Field label={t("offerPaymentTerms")} hint={t("offerOptional")} htmlFor="a-pay">
            <TextInput id="a-pay" name="paymentTerms" maxLength={500} defaultValue={v.paymentTerms} />
            {err("paymentTerms")}
          </Field>
          <Field label={t("offerNotes")} hint={t("offerOptional")} htmlFor="a-notes">
            <textarea id="a-notes" name="notes" rows={4} maxLength={5000} defaultValue={v.notes} className="w-full resize-y px-4 py-3 text-sm" style={box} />
            {err("notes")}
          </Field>
        </section>
      </div>

      <aside className="flex flex-col gap-4 p-5 lg:sticky" style={{ background: "white", border: `1px solid ${HAIR}`, top: "4.5rem" }}>
        <h2 className="text-xs font-bold uppercase" style={caps}>{t("offerCalcTitle")}</h2>
        <dl className="flex flex-col gap-2 text-sm" dir="ltr" data-calc="">
          {[
            [t("autoSumBase"), p.base, "base", true],
            ...(mode === "self"
              ? [[t("offerCalcCommission", { rate: pct(num(rate)) }), p.commission, "commission", true] as const]
              : [
                  [t("autoSumFxMargin", { rate: pct(lines[0]?.fxMarginRate ?? 0) }), p.fxMargin, "fx", true] as const,
                  [t("autoEditCalcMargin"), p.margin, "margin", true] as const,
                ]),
            ...(p.insurance > 0 ? [[t("autoSumInsurance", { rate: pct(DEFAULT_INSURANCE_RATE) }), p.insurance, "insurance", false] as const] : []),
            [t("autoEditCalcLines"), p.linesTotal, "lines", false],
            ...(freightManaged ? [[t("offerCalcFreight"), p.freight, "freight", false] as const] : []),
          ].map(([label, amount, key, secret]) => (
            <div key={key as string} className="flex justify-between gap-3" data-line={key as string}>
              <dt style={{ color: secret ? PRIVATE : "var(--muted)" }}>{label}</dt>
              <dd className="font-semibold" style={{ color: secret ? PRIVATE : undefined }}>
                {(key === "freight" && freightMissing) || (key === "margin" && marginMissing) ? t("autoEditToEnter") : money(amount as number)}
              </dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 pt-2" style={{ borderTop: `1px solid ${HAIR}` }} data-line="total">
            <dt className="font-bold">{t("offerCalcTotal")}</dt>
            <dd className="font-extrabold" data-edit-total={p.total}>{money(p.total)}</dd>
          </div>
        </dl>
        {mode === "africanex" && p.margin > 0 && <p className="text-xs font-semibold" style={{ color: PRIVATE }}>{t("autoEditMarginShare", { rate: pct(marginRateOfCost) })}</p>}
        {p.maxDiscountAmount > 0 && <p className="text-xs font-semibold" style={{ color: PRIVATE }}>{t("autoSumDiscount", { amount: money(p.maxDiscountAmount) })}</p>}
        {(marginMissing || freightMissing) && (
          <p className="px-3 py-2 text-xs font-semibold" style={{ background: "#fff7ed", borderInlineStart: `3px solid ${PRIVATE}` }} data-still-pending="">
            {[marginMissing ? t("offerPendingMargin") : null, freightMissing ? t("offerPendingFreight") : null].filter(Boolean).join(" · ")} : {t("autoEditPendingNote")}
          </p>
        )}
        <button type="submit" name="intent" value="publish" disabled={pending} className="px-6 py-3 text-sm font-bold uppercase disabled:opacity-60" style={{ ...caps, background: "#10b981", color: "white" }}>
          {pending ? t("offerSaving") : t("autoEditPublish")}
        </button>
        <button type="submit" name="intent" value="draft" disabled={pending} className="px-6 py-3 text-xs font-bold uppercase disabled:opacity-60" style={{ ...caps, border: "1px solid var(--ink)", background: "white" }}>
          {t("offerSaveDraft")}
        </button>
      </aside>
    </form>
  );
}
