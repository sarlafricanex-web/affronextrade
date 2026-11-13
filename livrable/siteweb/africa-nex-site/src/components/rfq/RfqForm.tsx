"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CountryCode } from "libphonenumber-js";
import { createRfq, type RfqField, type RfqState } from "@/app/[locale]/(app)/rfq/actions";
import { Alert, Field, TextInput } from "@/components/auth/fields";
import { CountrySelect } from "@/components/country/CountrySelect";
import { prepareUpload } from "@/lib/client/prepare-upload";
import { CURRENCIES, UNITS } from "@/lib/onboarding/reference";
import { estimateContainer, type LogisticsInput } from "@/lib/logistics/container";

const INCOTERMS = ["FOB", "CFR", "CIF", "DAP"] as const;
const MAX_FILE = 4 * 1024 * 1024;
const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const box = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;

export type RfqFormContext = {
  productId: string | null;
  productName: string | null;
  unit: string | null;
  moq: number | null;
  companyName: string | null;
  producerSlug: string | null;
  logistics: LogisticsInput | null;
};

function Section({ n, title, tag, children }: { n: number; title: string; tag?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
      <div className="flex items-center justify-between gap-3 pb-3" style={{ borderBottom: `1px solid ${HAIR}` }}>
        <h2 className="text-xs font-bold uppercase" style={caps}>{n}. {title}</h2>
        {tag && <span className="px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "#f5efe6", border: `1px solid ${HAIR}`, color: "var(--muted)" }}>{tag}</span>}
      </div>
      {children}
    </section>
  );
}

export function RfqForm({ context }: { context: RfqFormContext | null }) {
  const t = useTranslations("rfq");
  const o = useTranslations("onboarding");
  const locale = useLocale();
  const [state, action, pending] = useActionState<RfqState, FormData>(createRfq, { errors: {} });
  const v = state.values ?? {};
  const [mode, setMode] = useState<"units" | "containers">(v.mode === "containers" ? "containers" : "units");
  const [size, setSize] = useState<"20" | "40">(v.containerSize === "40" ? "40" : "20");
  const [count, setCount] = useState(v.containerCount || "1");
  const [file, setFile] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const err = (f: RfqField) => (state.errors[f] ? <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t(state.errors[f]!)}</span> : null);

  // Estimation depuis la fiche carton du produit (si le producteur l'a remplie).
  const estimate = context?.logistics ? estimateContainer(context.logistics, size) : null;
  const n = Number(count) || 0;
  const unitLabel = context?.unit ? o(`unit_${context.unit}`) : "";

  return (
    <form key={state.attempt ?? 0} action={action} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="productId" value={context?.productId ?? ""} />
      <input type="hidden" name="producer" value={context?.producerSlug ?? ""} />
      <input type="hidden" name="mode" value={mode} />
      {state.formError && <Alert tone="error">{t(state.formError)}</Alert>}

      {context?.companyName && (
        <section className="flex flex-wrap items-start justify-between gap-3 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{context.productName ? t("selectedProduct") : t("selectedProducer")}</p>
            {context.productName && <p className="mt-1 font-extrabold" style={{ fontSize: "1.1rem" }}>{context.productName}</p>}
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{t("producerLabel")} <strong style={{ color: "var(--ink)" }}>{context.companyName}</strong></p>
          </div>
          <a href={`/${locale}/producers`} className="px-3 py-2 text-[11px] font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)" }}>{t("change")}</a>
        </section>
      )}

      <Section n={1} title={t("sectionProduct")}>
        <Field label={t("title")} hint={t("titleHint")} htmlFor="rfq-title">
          <TextInput id="rfq-title" name="title" required maxLength={200} defaultValue={v.title ?? context?.productName ?? ""} placeholder={t("titlePlaceholder")} />
          {err("title")}
        </Field>
      </Section>

      <Section n={2} title={t("sectionQuantity")}>
        <div className="grid grid-cols-2" role="radiogroup" aria-label={t("sectionQuantity")}>
          {(["units", "containers"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className="px-3 py-3 text-xs font-bold uppercase" style={{ ...caps, background: mode === m ? "var(--ink)" : "white", color: mode === m ? "white" : "var(--ink)", border: `1px solid ${mode === m ? "var(--ink)" : HAIR}` }}>
              {t(`mode_${m}`)}
            </button>
          ))}
        </div>
        {mode === "units" ? (
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <Field label={t("quantity")} htmlFor="rfq-qty">
              <TextInput id="rfq-qty" name="quantity" required inputMode="decimal" dir="ltr" defaultValue={v.quantity ?? ""} placeholder="2000" />
              {err("quantity")}
            </Field>
            <Field label={t("unit")} htmlFor="rfq-unit">
              <select id="rfq-unit" name="unit" required defaultValue={v.unit ?? context?.unit ?? ""} className="w-full px-4 py-3 text-sm" style={box}>
                <option value="" disabled>{o("choose")}</option>
                {UNITS.map((u) => <option key={u} value={u}>{o(`unit_${u}`)}</option>)}
              </select>
              {err("unit")}
            </Field>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
              <Field label={t("containerCount")} htmlFor="rfq-count">
                <TextInput id="rfq-count" name="containerCount" required inputMode="numeric" dir="ltr" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 3))} />
                {err("containerCount")}
              </Field>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-xs font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("containerSize")}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["20", "40"] as const).map((s) => (
                    <label key={s} className="flex cursor-pointer items-center gap-2 px-3 py-3 text-sm font-semibold" style={{ border: `1px solid ${size === s ? "var(--ink)" : HAIR}`, background: size === s ? "#f5efe6" : "white" }}>
                      <input type="radio" name="containerSize" value={s} checked={size === s} onChange={() => setSize(s)} />
                      {t(`size_${s}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <label className="flex items-start gap-3 p-3 text-sm" style={{ border: `1px solid ${HAIR}` }}>
              <input type="checkbox" name="reefer" defaultChecked={v.reefer === "on" || Boolean(context?.logistics?.storage && context.logistics.storage !== "ambient")} className="mt-1" />
              <span><span className="block font-semibold">{t("reefer")}</span><span className="block text-xs" style={{ color: "var(--muted)" }}>{t("reeferHelp")}</span></span>
            </label>
            {estimate ? (
              <p className="p-3 text-sm" style={{ background: "#ecfdf5", border: "1px solid #10b981" }}>
                {t("estimate", { perContainer: estimate.units.toLocaleString(locale), unit: unitLabel, total: (estimate.units * n).toLocaleString(locale) })}
              </p>
            ) : (
              <p className="text-xs" style={{ color: "var(--muted)" }}>{t("estimateUnknown")}</p>
            )}
          </>
        )}
        {context?.moq != null && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>{t("moqHint", { moq: context.moq.toLocaleString(locale), unit: unitLabel })}</p>
        )}
      </Section>

      <Section n={3} title={t("sectionDestination")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span id="rfq-country-label" className="text-xs font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("country")}</span>
            <CountrySelect id="rfq-country" name="country" labelId="rfq-country-label" defaultValue={(v.country as CountryCode) || null} placeholder={o("countryPlaceholder")} />
            {err("country")}
          </div>
          <Field label={t("port")} hint={o("optional")} htmlFor="rfq-port">
            <TextInput id="rfq-port" name="port" maxLength={120} defaultValue={v.port ?? ""} placeholder={t("portPlaceholder")} />
            {err("port")}
          </Field>
        </div>
      </Section>

      <Section n={4} title={t("sectionIncoterm")} tag="ICC 2020">
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
          {INCOTERMS.map((i) => (
            <label key={i} className="flex cursor-pointer items-start gap-3 p-4" style={{ border: `1px solid ${HAIR}` }}>
              <input type="radio" name="incoterm" value={i} required defaultChecked={v.incoterm === i} className="mt-1" />
              <span>
                <span className="block font-extrabold">{i} <span className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t(`incoterm_${i}_name`)}</span></span>
                <span className="block text-sm" style={{ color: "var(--muted)" }}>{t(`incoterm_${i}_desc`)}</span>
              </span>
            </label>
          ))}
        </div>
        {err("incoterm")}
        <p className="text-xs" style={{ color: "var(--muted)" }}>{t("incotermHelp")}</p>
      </Section>

      <Section n={5} title={t("sectionPrice")} tag={o("optional")}>
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Field label={t("targetPrice")} htmlFor="rfq-price">
            <TextInput id="rfq-price" name="targetPrice" inputMode="decimal" dir="ltr" defaultValue={v.targetPrice ?? ""} placeholder="8,50" />
            {err("targetPrice")}
          </Field>
          <Field label={t("currency")} htmlFor="rfq-currency">
            <select id="rfq-currency" name="currency" defaultValue={v.currency ?? "USD"} className="w-full px-4 py-3 text-sm" style={box}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {err("currency")}
          </Field>
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>{t("targetPriceHelp")}</p>
      </Section>

      <Section n={6} title={t("sectionSchedule")}>
        <Field label={t("neededBy")} hint={o("optional")} htmlFor="rfq-date">
          <TextInput id="rfq-date" name="neededBy" type="date" dir="ltr" defaultValue={v.neededBy ?? ""} />
          {err("neededBy")}
        </Field>
      </Section>

      <Section n={7} title={t("sectionRequirements")} tag={o("optional")}>
        <Field label={t("description")} htmlFor="rfq-desc">
          <textarea id="rfq-desc" name="description" rows={4} maxLength={5000} defaultValue={v.description ?? ""} placeholder={t("descriptionPlaceholder")} className="w-full resize-y px-4 py-3 text-sm" style={box} />
          {err("description")}
        </Field>
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer flex-col items-center gap-1 p-5 text-center" style={{ border: `1px dashed ${HAIR}`, background: "#fff8f3" }}>
            <span className="text-sm font-bold">{t("file")}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{t("fileHelp")}</span>
            <input
              type="file"
              name="file"
              accept="application/pdf,image/jpeg,image/png"
              className="sr-only"
              onChange={async (e) => {
                const input = e.currentTarget;
                setFileError(null);
                setPreparing(true);
                const original = input.files?.[0];
                const result = await prepareUpload(input, { maxBytes: MAX_FILE, allowPdf: true });
                setPreparing(false);
                if (!result.ok) { setFile(null); setFileError(result.reason === "tooBig" ? "errorFileSize" : "errorFileType"); return; }
                setFile(result.file && original ? original.name : null);
              }}
            />
          </label>
          {preparing && <span className="text-sm" style={{ color: "var(--muted)" }}>{t("preparing")}</span>}
          {file && !preparing && <span className="text-sm font-semibold">{file}</span>}
          {fileError ? <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t(fileError)}</span> : err("file")}
        </div>
      </Section>

      <p className="p-4 text-sm" style={{ background: "#fff8f3", border: `1px solid ${HAIR}` }}>{t("privacyNote")}</p>
      <button type="submit" disabled={pending || preparing} className="w-full py-4 text-sm font-bold uppercase disabled:opacity-60 sm:w-auto sm:self-end sm:px-10" style={{ background: "#10b981", color: "white", ...caps }}>
        {pending ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
