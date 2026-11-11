"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveAdminProducer, type AdminProducerField, type AdminProducerState } from "@/app/[locale]/(app)/admin/producers/actions";
import { Alert, Field, TextInput } from "@/components/auth/fields";
import { PhoneField } from "@/components/phone/PhoneField";
import { SECTORS, WILAYAS } from "@/lib/onboarding/reference";

export type AdminProducerDefaults = {
  id: string;
  companyName: string;
  sector: string;
  wilaya: string;
  city: string;
  descriptionFr: string;
  descriptionEn: string;
  descriptionAr: string;
  website: string;
  nif: string;
  contactEmail: string;
  contactPhone: string;
};

const box = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;

// Saisie rapide d'un producteur pour son compte : l'essentiel d'abord, le reste facultatif.
export function AdminProducerForm({ defaults: initial }: { defaults: AdminProducerDefaults }) {
  const t = useTranslations("admin");
  const o = useTranslations("onboarding");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AdminProducerState, FormData>(saveAdminProducer, { errors: {} });
  const d = { ...initial, products: "", visibility: "published", ...(state.values ?? {}) };
  const isNew = !initial.id;
  const err = (f: AdminProducerField) => {
    const key = state.errors[f];
    if (!key) return null;
    return <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t.has(key) ? t(key) : o(key)}</span>;
  };

  return (
    <form key={state.attempt ?? 0} action={action} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={initial.id} />
      {state.formError && <Alert tone="error">{o(state.formError)}</Alert>}

      <Field label={o("companyName")} htmlFor="ap-name">
        <TextInput id="ap-name" name="companyName" required maxLength={255} defaultValue={d.companyName} autoFocus={isNew} />
        {err("companyName")}
      </Field>

      <div className="grid gap-6 sm:grid-cols-3">
        <Field label={o("sector")} htmlFor="ap-sector">
          <select id="ap-sector" name="sector" required defaultValue={d.sector} className="w-full px-4 py-3 text-sm" style={box}>
            <option value="" disabled>{o("choose")}</option>
            {SECTORS.map((s) => <option key={s} value={s}>{o(`sector_${s}`)}</option>)}
          </select>
          {err("sector")}
        </Field>
        <Field label={o("wilaya")} htmlFor="ap-wilaya">
          <select id="ap-wilaya" name="wilaya" required defaultValue={d.wilaya} className="w-full px-4 py-3 text-sm" style={box}>
            <option value="" disabled>{o("choose")}</option>
            {WILAYAS.map(([code, name]) => <option key={code} value={code}>{`${code} ${name}`}</option>)}
          </select>
          {err("wilaya")}
        </Field>
        <Field label={o("city")} htmlFor="ap-city">
          <TextInput id="ap-city" name="city" required maxLength={100} defaultValue={d.city} />
          {err("city")}
        </Field>
      </div>

      <Field label={isNew ? t("apProducts") : t("apAddProducts")} hint={t("apProductsHint")} htmlFor="ap-products">
        <textarea id="ap-products" name="products" rows={4} defaultValue={d.products} placeholder={t("apProductsPlaceholder")} className="w-full resize-y px-4 py-3 text-sm" style={box} />
        {err("products")}
      </Field>

      {(["Fr", "En", "Ar"] as const).map((lang) => (
        <Field key={lang} label={t(`apDescription${lang}`)} hint={o("optional")} htmlFor={`ap-desc-${lang}`}>
          <textarea id={`ap-desc-${lang}`} name={`description${lang}`} rows={3} maxLength={2000} dir={lang === "Ar" ? "rtl" : "ltr"} defaultValue={d[`description${lang}`]} className="w-full resize-y px-4 py-3 text-sm" style={box} />
          {err(`description${lang}`)}
        </Field>
      ))}

      <fieldset className="flex flex-col gap-6 p-5" style={{ border: "1px solid var(--field-b)" }}>
        <legend className="px-2 font-bold">{t("apPrivate")}</legend>
        <p className="text-xs" style={{ color: "var(--muted)" }}>{t("apPrivateHint")}</p>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label={o("nif")} hint={o("optional")} htmlFor="ap-nif">
            <TextInput id="ap-nif" name="nif" inputMode="numeric" dir="ltr" defaultValue={d.nif} placeholder="000000000000000" />
            {err("nif")}
          </Field>
          <Field label={o("website")} hint={o("optional")} htmlFor="ap-web">
            <TextInput id="ap-web" name="website" dir="ltr" defaultValue={d.website} placeholder="www.exemple.dz" />
            {err("website")}
          </Field>
          <Field label={t("apContactEmail")} hint={o("optional")} htmlFor="ap-email">
            <TextInput id="ap-email" name="contactEmail" type="email" dir="ltr" defaultValue={d.contactEmail} />
            {err("contactEmail")}
          </Field>
          <Field label={o("phone")} hint={o("optional")} htmlFor="ap-phone">
            <PhoneField id="ap-phone" name="contactPhone" defaultValue={d.contactPhone || undefined} />
            {err("contactPhone")}
          </Field>
        </div>
      </fieldset>

      {isNew && (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("apVisibility")}</legend>
          {(["published", "draft"] as const).map((v) => (
            <label key={v} className="flex cursor-pointer items-start gap-3 p-4" style={{ border: "1px solid var(--field-b)" }}>
              <input type="radio" name="visibility" value={v} defaultChecked={d.visibility === v} className="mt-1" />
              <span>
                <span className="block font-bold">{t(`apVisibility_${v}`)}</span>
                <span className="block text-sm" style={{ color: "var(--muted)" }}>{t(`apVisibility_${v}_help`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="pt-2" style={{ borderTop: "1px solid var(--field-b)" }}>
        <button type="submit" disabled={pending} className="mt-4 w-full py-4 text-sm font-bold uppercase disabled:opacity-60 sm:w-auto sm:px-10" style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}>
          {pending ? o("saving") : isNew ? t("apCreate") : o("saveChanges")}
        </button>
      </div>
    </form>
  );
}
