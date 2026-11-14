"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { submitQuote } from "@/app/[locale]/(app)/requests/actions";
import type { QuoteField, QuoteState } from "@/lib/quote-input";
import { Alert, Field, TextInput } from "@/components/auth/fields";
import { prepareUpload } from "@/lib/client/prepare-upload";
import { CURRENCIES } from "@/lib/onboarding/reference";

export type QuoteDefaults = { currency: string; unitPrice: string; priceBasis: string; port: string; quantity: string; leadDays: string; availableOn: string; paymentTerms: string; validUntil: string; notes: string };

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const box = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;
const BASES = ["FOB", "FCA", "EXW"] as const;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="flex items-center gap-3 pb-2 text-xs font-bold uppercase" style={{ ...caps, borderBottom: `1px solid ${HAIR}` }}>
        <span className="flex h-6 w-6 items-center justify-center text-[11px]" style={{ background: "var(--ink)", color: "white" }}>{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

// Proposition commerciale du producteur a AFRICA NEX (maquette 16). AFRICA NEX reutilise
// le meme formulaire pour saisir le devis d'un producteur hors ligne (onSubmit et libelles).
export function QuoteForm({
  dispatchId,
  defaults,
  unitLabel,
  update,
  onSubmit = submitQuote,
  labels,
}: {
  dispatchId: string;
  defaults: QuoteDefaults;
  unitLabel: string;
  update: boolean;
  onSubmit?: (prev: QuoteState, formData: FormData) => Promise<QuoteState>;
  labels?: { submit: string; note: string };
}) {
  const t = useTranslations("requests");
  const locale = useLocale();
  const [state, action, pending] = useActionState<QuoteState, FormData>(onSubmit, { errors: {} });
  const v = { ...defaults, ...(state.values ?? {}) };
  const [price, setPrice] = useState(v.unitPrice);
  const [qty, setQty] = useState(v.quantity);
  const [currency, setCurrency] = useState(v.currency || "USD");
  const [file, setFile] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const err = (f: QuoteField) => (state.errors[f] ? <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t(state.errors[f]!)}</span> : null);
  const num = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));
  const total = num(price) * num(qty);

  return (
    <form key={state.attempt ?? 0} action={action} className="flex flex-col gap-8">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={dispatchId} />
      {state.formError && <Alert tone="error">{t(state.formError)}</Alert>}

      <Step n={1} title={t("stepPrice")}>
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <Field label={t("currency")} htmlFor="q-cur">
            <select id="q-cur" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-4 py-3 text-sm" style={box}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {err("currency")}
          </Field>
          <Field label={t("unitPrice", { unit: unitLabel })} htmlFor="q-price">
            <TextInput id="q-price" name="unitPrice" required inputMode="decimal" dir="ltr" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="4,85" />
            {err("unitPrice")}
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("priceBasis")}</legend>
          <div className="grid grid-cols-3 gap-2">
            {BASES.map((b) => (
              <label key={b} className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-semibold" style={{ border: `1px solid ${HAIR}` }}>
                <input type="radio" name="priceBasis" value={b} defaultChecked={v.priceBasis === b} required />
                {b}
              </label>
            ))}
          </div>
          {err("priceBasis")}
        </fieldset>
        <Field label={t("port")} hint={t("portHint")} htmlFor="q-port">
          <TextInput id="q-port" name="port" maxLength={120} defaultValue={v.port} placeholder={t("portPlaceholder")} />
          {err("port")}
        </Field>
        {total > 0 && (
          <p className="flex flex-wrap items-baseline justify-between gap-2 p-4" style={{ background: "#fff8f3", border: `1px solid ${HAIR}` }}>
            <span className="text-sm" style={{ color: "var(--muted)" }}>{t("totalLabel")}</span>
            <strong style={{ fontSize: "1.4rem" }} dir="ltr">{total.toLocaleString(locale, { maximumFractionDigits: 2 })} {currency}</strong>
          </p>
        )}
      </Step>

      <Step n={2} title={t("stepVolume")}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("quantity", { unit: unitLabel })} htmlFor="q-qty">
            <TextInput id="q-qty" name="quantity" required inputMode="decimal" dir="ltr" value={qty} onChange={(e) => setQty(e.target.value)} />
            {err("quantity")}
          </Field>
          <Field label={t("leadDays")} hint={t("leadDaysHint")} htmlFor="q-lead">
            <TextInput id="q-lead" name="leadDays" required inputMode="numeric" dir="ltr" defaultValue={v.leadDays} placeholder="25" />
            {err("leadDays")}
          </Field>
          <Field label={t("availableOn")} hint={t("optional")} htmlFor="q-avail">
            <TextInput id="q-avail" name="availableOn" type="date" dir="ltr" defaultValue={v.availableOn} />
            {err("availableOn")}
          </Field>
        </div>
      </Step>

      <Step n={3} title={t("stepTerms")}>
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <Field label={t("paymentTerms")} hint={t("optional")} htmlFor="q-pay">
            <TextInput id="q-pay" name="paymentTerms" maxLength={500} defaultValue={v.paymentTerms} placeholder={t("paymentTermsPlaceholder")} />
            {err("paymentTerms")}
          </Field>
          <Field label={t("validUntil")} htmlFor="q-valid">
            <TextInput id="q-valid" name="validUntil" type="date" required dir="ltr" defaultValue={v.validUntil} />
            {err("validUntil")}
          </Field>
        </div>
      </Step>

      <Step n={4} title={t("stepNotes")}>
        <Field label={t("notes")} hint={t("optional")} htmlFor="q-notes">
          <textarea id="q-notes" name="notes" rows={4} maxLength={5000} defaultValue={v.notes} placeholder={t("notesPlaceholder")} className="w-full resize-y px-4 py-3 text-sm" style={box} />
          {err("notes")}
        </Field>
        <label className="flex cursor-pointer flex-col items-center gap-1 p-4 text-center" style={{ border: `1px dashed ${HAIR}`, background: "#fff8f3" }}>
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
              const result = await prepareUpload(input, { maxBytes: 4 * 1024 * 1024, allowPdf: true });
              setPreparing(false);
              if (!result.ok) { setFile(null); setFileError(result.reason === "tooBig" ? "errorFileSize" : "errorFileType"); return; }
              setFile(result.file && original ? original.name : null);
            }}
          />
        </label>
        {file && !preparing && <span className="text-sm font-semibold">{file}</span>}
        {fileError ? <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t(fileError)}</span> : err("file")}
      </Step>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between" style={{ borderTop: `1px solid ${HAIR}` }}>
        <p className="text-xs" style={{ color: "var(--muted)", maxWidth: "48ch" }}>{labels?.note ?? t("submitNote")}</p>
        <button type="submit" disabled={pending || preparing} className="mt-4 px-8 py-4 text-sm font-bold uppercase disabled:opacity-60" style={{ ...caps, background: "#10b981", color: "white" }}>
          {pending ? t("sending") : labels?.submit ?? (update ? t("submitUpdate") : t("submit"))}
        </button>
      </div>
    </form>
  );
}
