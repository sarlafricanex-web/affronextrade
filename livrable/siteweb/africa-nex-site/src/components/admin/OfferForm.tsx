"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveOffer, type OfferField, type OfferState } from "@/app/[locale]/(app)/admin/rfqs/offer-actions";
import { Alert, Field, TextInput } from "@/components/auth/fields";
import { COMMISSION_TIERS, commissionRateFor, priceOffer } from "@/lib/offer-pricing";
import { DELIVERED_INCOTERMS, INCOTERMS } from "@/lib/incoterms";

export type OfferDefaults = Record<OfferField, string>;

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const box = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;
const WITH_FREIGHT: readonly string[] = DELIVERED_INCOTERMS;
const num = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// Composition d'une offre AFRICA NEX a partir d'un devis producteur, avec calculateur :
// prix fournisseur + commission (grille selon le montant) + assurance + fret.
// L'apercu est calcule ici ; le serveur recalcule et enregistre.
export function OfferForm({
  rfqId,
  quoteId,
  currency,
  unitLabel,
  defaults,
  rateFixed,
}: {
  rfqId: string;
  quoteId: string;
  currency: string;
  unitLabel: string;
  defaults: OfferDefaults;
  rateFixed: boolean;
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [state, action, pending] = useActionState<OfferState, FormData>(saveOffer, { errors: {} });
  const v = { ...defaults, ...(state.values ?? {}) };
  const [price, setPrice] = useState(v.producerPrice);
  const [qty, setQty] = useState(v.quantity);
  const [incoterm, setIncoterm] = useState(v.incoterm);
  const [insurance, setInsurance] = useState(v.insuranceRate);
  const [freight, setFreight] = useState(v.freight);
  // Taux de commission : celui de la grille tant qu'AFRICA NEX ne l'a pas change a la main.
  const [manualRate, setManualRate] = useState<string | null>(rateFixed || state.values ? v.commissionRate : null);
  const base = num(price) * num(qty);
  const gridRate = commissionRateFor(base, currency);
  const rate = manualRate ?? String(gridRate);
  const showFreight = WITH_FREIGHT.includes(incoterm);
  const p = priceOffer({ producerUnitPrice: num(price), quantity: num(qty), commissionRate: num(rate), insuranceRate: num(insurance), freight: showFreight ? num(freight) : 0 });
  const money = (n: number) => `${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  const err = (f: OfferField) => (state.errors[f] ? <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t(state.errors[f]!)}</span> : null);
  const pct = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 2 });
  const grid = t("offerGrid", { low: (5000).toLocaleString(locale), high: (500000).toLocaleString(locale), r1: COMMISSION_TIERS[0].rate, r2: COMMISSION_TIERS[1].rate, r3: COMMISSION_TIERS[2].rate });

  return (
    <form key={state.attempt ?? 0} action={action} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="rfqId" value={rfqId} />
      <input type="hidden" name="quoteId" value={quoteId} />
      {!showFreight && <input type="hidden" name="freight" value="" />}

      <div className="flex flex-col gap-6" style={{ minWidth: 0 }}>
        {state.formError && <Alert tone="error">{t(state.formError)}</Alert>}

        <section className="flex flex-col gap-4 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <h2 className="text-xs font-bold uppercase" style={caps}>{t("offerPriceTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-[110px_1fr_1fr]">
            <Field label={t("offerLabel")} htmlFor="o-label">
              <TextInput id="o-label" name="label" required maxLength={20} dir="ltr" defaultValue={v.label} />
              {err("label")}
            </Field>
            <Field label={t("offerProducerPrice", { currency, unit: unitLabel })} hint={t("offerProducerPriceHint")} htmlFor="o-price">
              <TextInput id="o-price" name="producerPrice" required inputMode="decimal" dir="ltr" value={price} onChange={(e) => setPrice(e.target.value)} />
              {err("producerPrice")}
            </Field>
            <Field label={t("offerQuantity", { unit: unitLabel })} htmlFor="o-qty">
              <TextInput id="o-qty" name="quantity" required inputMode="decimal" dir="ltr" value={qty} onChange={(e) => setQty(e.target.value)} />
              {err("quantity")}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <Field label={t("offerIncoterm")} htmlFor="o-incoterm">
              <select id="o-incoterm" name="incoterm" value={incoterm} onChange={(e) => setIncoterm(e.target.value)} className="w-full px-4 py-3 text-sm" style={box}>
                {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
              {err("incoterm")}
            </Field>
            <Field label={t("offerIncotermPlace")} hint={t("offerIncotermPlaceHint")} htmlFor="o-place">
              <TextInput id="o-place" name="incotermPlace" maxLength={200} defaultValue={v.incotermPlace} />
              {err("incotermPlace")}
            </Field>
          </div>
          <div className={`grid gap-4 ${showFreight ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <Field label={t("offerCommissionRate")} htmlFor="o-commission">
              <TextInput id="o-commission" name="commissionRate" required inputMode="decimal" dir="ltr" value={rate} onChange={(e) => setManualRate(e.target.value)} />
              {manualRate !== null && num(manualRate) !== gridRate ? (
                <button type="button" onClick={() => setManualRate(null)} className="w-fit text-xs font-semibold underline" style={{ color: "#065f46" }}>{t("offerUseGrid", { rate: gridRate })}</button>
              ) : (
                <span className="text-xs" style={{ color: "var(--muted)" }}>{t("offerFromGrid")}</span>
              )}
              {err("commissionRate")}
            </Field>
            <Field label={t("offerInsuranceRate")} htmlFor="o-insurance">
              <TextInput id="o-insurance" name="insuranceRate" required inputMode="decimal" dir="ltr" value={insurance} onChange={(e) => setInsurance(e.target.value)} />
              {err("insuranceRate")}
            </Field>
            {showFreight && (
              <Field label={t("offerFreight", { currency })} hint={t("offerFreightHint")} htmlFor="o-freight">
                <TextInput id="o-freight" name="freight" inputMode="decimal" dir="ltr" value={freight} onChange={(e) => setFreight(e.target.value)} />
                {err("freight")}
              </Field>
            )}
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>{grid}</p>
          {incoterm === "CIF" && <p className="text-xs font-semibold" style={{ color: "#c2410c" }}>{t("offerCifNote")}</p>}
        </section>

        <section className="flex flex-col gap-4 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <h2 className="text-xs font-bold uppercase" style={caps}>{t("offerTermsTitle")}</h2>
          <p className="text-xs font-semibold" style={{ color: "#c2410c" }}>{t("offerAnonymous")}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("offerLeadDays")} hint={t("offerOptional")} htmlFor="o-lead">
              <TextInput id="o-lead" name="leadDays" inputMode="numeric" dir="ltr" defaultValue={v.leadDays} />
              {err("leadDays")}
            </Field>
            <Field label={t("offerValidUntil")} htmlFor="o-valid">
              <TextInput id="o-valid" name="validUntil" type="date" required dir="ltr" defaultValue={v.validUntil} />
              {err("validUntil")}
            </Field>
            <Field label={t("offerOrigin")} hint={t("offerOptional")} htmlFor="o-origin">
              <TextInput id="o-origin" name="originRegion" maxLength={200} defaultValue={v.originRegion} />
              {err("originRegion")}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("offerPackaging")} hint={t("offerOptional")} htmlFor="o-packaging">
              <TextInput id="o-packaging" name="packaging" maxLength={200} defaultValue={v.packaging} />
              {err("packaging")}
            </Field>
            <Field label={t("offerCertifications")} hint={t("offerOptional")} htmlFor="o-cert">
              <TextInput id="o-cert" name="certifications" maxLength={200} defaultValue={v.certifications} />
              {err("certifications")}
            </Field>
          </div>
          <Field label={t("offerPaymentTerms")} hint={t("offerOptional")} htmlFor="o-pay">
            <TextInput id="o-pay" name="paymentTerms" maxLength={500} defaultValue={v.paymentTerms} />
            {err("paymentTerms")}
          </Field>
          <Field label={t("offerNotes")} hint={t("offerOptional")} htmlFor="o-notes">
            <textarea id="o-notes" name="notes" rows={4} maxLength={5000} defaultValue={v.notes} className="w-full resize-y px-4 py-3 text-sm" style={box} />
            {err("notes")}
          </Field>
        </section>
      </div>

      <aside className="flex flex-col gap-4 p-5 lg:sticky" style={{ background: "white", border: `1px solid ${HAIR}`, top: "4.5rem" }}>
        <h2 className="text-xs font-bold uppercase" style={caps}>{t("offerCalcTitle")}</h2>
        <dl className="flex flex-col gap-2 text-sm" dir="ltr" data-calc="">
          {[
            [t("offerCalcBase"), p.base, "base"],
            [t("offerCalcCommission", { rate: pct(num(rate)) }), p.commission, "commission"],
            [t("offerCalcInsurance", { rate: pct(num(insurance)) }), p.insurance, "insurance"],
            ...(showFreight ? [[t("offerCalcFreight"), p.freight, "freight"] as const] : []),
          ].map(([label, amount, key]) => (
            <div key={key as string} className="flex justify-between gap-3" data-line={key as string}>
              <dt style={{ color: "var(--muted)" }}>{label}</dt>
              <dd className="font-semibold">{money(amount as number)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 pt-2" style={{ borderTop: `1px solid ${HAIR}` }} data-line="total">
            <dt className="font-bold">{t("offerCalcTotal")}</dt>
            <dd className="font-extrabold">{money(p.total)}</dd>
          </div>
        </dl>
        <p className="flex flex-col gap-1 p-4" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }} data-line="unit">
          <span className="text-xs font-bold uppercase" style={{ ...caps, color: "#065f46" }}>{t("offerCalcUnit", { incoterm })}</span>
          <strong dir="ltr" style={{ fontSize: "1.5rem" }}>{money(p.unitPrice)} / {unitLabel}</strong>
        </p>
        <p className="text-xs font-semibold" style={{ color: "#c2410c" }}>{t("offerCalcPrivate", { margin: money(p.commission) })}</p>
        <button type="submit" name="intent" value="publish" disabled={pending} className="px-6 py-3 text-sm font-bold uppercase disabled:opacity-60" style={{ ...caps, background: "#047857", color: "white" }}>
          {pending ? t("offerSaving") : t("offerPublish")}
        </button>
        <button type="submit" name="intent" value="draft" disabled={pending} className="px-6 py-3 text-xs font-bold uppercase disabled:opacity-60" style={{ ...caps, border: "1px solid var(--ink)", background: "white" }}>
          {t("offerSaveDraft")}
        </button>
      </aside>
    </form>
  );
}
