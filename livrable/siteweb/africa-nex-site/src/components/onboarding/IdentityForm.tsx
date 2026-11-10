"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveIdentity, type IdentityField, type IdentityState } from "@/app/[locale]/(app)/onboarding/actions";
import { Alert, Field, TextInput } from "@/components/auth/fields";
import { PhoneField } from "@/components/phone/PhoneField";
import { LEGAL_FORMS, SECTORS, WILAYAS } from "@/lib/onboarding/reference";

export type IdentityDefaults = {
  companyName: string;
  legalForm: string;
  sector: string;
  nif: string;
  rc: string;
  wilaya: string;
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
};

const selectStyle = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;

export function IdentityForm({ defaults }: { defaults: IdentityDefaults }) {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const [state, action, pending] = useActionState<IdentityState, FormData>(saveIdentity, { errors: {} });
  const err = (field: IdentityField) =>
    state.errors[field] ? (
      <span id={`${field}-error`} className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t(state.errors[field]!)}</span>
    ) : null;
  const described = (field: IdentityField) => (state.errors[field] ? { "aria-invalid": true, "aria-describedby": `${field}-error` } : {});

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      {state.formError && <Alert tone="error">{t(state.formError)}</Alert>}

      <Field label={t("companyName")} hint={t("companyNameHint")} htmlFor="ob-name">
        <TextInput id="ob-name" name="companyName" required maxLength={255} defaultValue={defaults.companyName} autoComplete="organization" {...described("companyName")} />
        {err("companyName")}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("legalForm")}</legend>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {LEGAL_FORMS.map((form) => (
            <label key={form} className="cursor-pointer">
              <input type="radio" name="legalForm" value={form} defaultChecked={defaults.legalForm === form} required className="peer sr-only" />
              <span
                className="block py-3 text-center text-sm font-semibold peer-checked:bg-[var(--ink)] peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
                style={{ border: "1px solid var(--field-b)" }}
              >
                {t(`form${form}`)}
              </span>
            </label>
          ))}
        </div>
        {err("legalForm")}
      </fieldset>

      <Field label={t("sector")} htmlFor="ob-sector">
        <select id="ob-sector" name="sector" required defaultValue={defaults.sector} className="w-full px-4 py-3 text-sm" style={selectStyle} {...described("sector")}>
          <option value="" disabled>{t("choose")}</option>
          {SECTORS.map((s) => <option key={s} value={s}>{t(`sector_${s}`)}</option>)}
        </select>
        {err("sector")}
      </Field>

      <div className="grid sm:grid-cols-2 gap-6">
        <Field label={t("nif")} hint={t("nifHint")} htmlFor="ob-nif">
          <TextInput id="ob-nif" name="nif" required inputMode="numeric" dir="ltr" defaultValue={defaults.nif} placeholder="000000000000000" {...described("nif")} />
          {err("nif")}
        </Field>
        <Field label={t("rc")} htmlFor="ob-rc">
          <TextInput id="ob-rc" name="rc" required maxLength={40} dir="ltr" defaultValue={defaults.rc} placeholder="19/00-0000000 B 24" {...described("rc")} />
          {err("rc")}
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <Field label={t("wilaya")} htmlFor="ob-wilaya">
          <select id="ob-wilaya" name="wilaya" required defaultValue={defaults.wilaya} className="w-full px-4 py-3 text-sm" style={selectStyle} {...described("wilaya")}>
            <option value="" disabled>{t("choose")}</option>
            {WILAYAS.map(([code, name]) => <option key={code} value={code}>{`${code} ${name}`}</option>)}
          </select>
          {err("wilaya")}
        </Field>
        <Field label={t("city")} htmlFor="ob-city">
          <TextInput id="ob-city" name="city" required maxLength={100} defaultValue={defaults.city} autoComplete="address-level2" {...described("city")} />
          {err("city")}
        </Field>
      </div>

      <Field label={t("address")} htmlFor="ob-address">
        <TextInput id="ob-address" name="address" required maxLength={300} defaultValue={defaults.address} autoComplete="street-address" {...described("address")} />
        {err("address")}
      </Field>

      <div className="grid sm:grid-cols-2 gap-6">
        <Field label={t("phone")} htmlFor="ob-phone">
          <PhoneField id="ob-phone" name="phone" required defaultValue={defaults.phone || undefined} />
          {err("phone")}
        </Field>
        <Field label={t("whatsapp")} hint={t("whatsappHint")} htmlFor="ob-whatsapp">
          <PhoneField id="ob-whatsapp" name="whatsapp" required defaultValue={defaults.whatsapp || undefined} />
          {err("whatsapp")}
        </Field>
      </div>

      <p className="text-xs" style={{ color: "var(--muted)" }}>{t("privacyNote")}</p>

      <div className="grid sm:grid-cols-2 gap-3 pt-2" style={{ borderTop: "1px solid var(--field-b)" }}>
        <button
          type="submit"
          name="intent"
          value="later"
          disabled={pending}
          className="mt-4 py-4 text-sm font-bold uppercase disabled:opacity-60"
          style={{ background: "white", border: "1px solid var(--ink)", letterSpacing: "0.08em" }}
        >
          {t("saveLater")}
        </button>
        <button
          type="submit"
          name="intent"
          value="continue"
          disabled={pending}
          className="mt-4 py-4 text-sm font-bold uppercase disabled:opacity-60"
          style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}
        >
          {pending ? t("saving") : t("continue")}
        </button>
      </div>
    </form>
  );
}
