"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveIdentity, type IdentityField, type IdentityState } from "@/app/[locale]/(app)/onboarding/actions";
import { Alert, Field, TextInput } from "@/components/auth/fields";
import { PhoneField } from "@/components/phone/PhoneField";
import { LEGAL_FORMS } from "@/lib/onboarding/reference";
import { WilayaCommuneFields } from "@/components/onboarding/WilayaCommuneFields";
import { ActivityCodeField } from "@/components/onboarding/ActivityCodeField";

export type IdentityDefaults = {
  companyName: string;
  legalForm: string;
  sector: string;
  activityCode: string;
  activityDescription: string;
  nif: string;
  nis: string;
  taxArticle: string;
  rc: string;
  wilaya: string;
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
  exportConsent: boolean;
};

const selectStyle = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;

export function IdentityForm({ defaults, mode = "onboarding" }: { defaults: IdentityDefaults; mode?: "onboarding" | "edit" }) {
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
      <input type="hidden" name="mode" value={mode} />
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

      <div className="grid sm:grid-cols-2 gap-6">
        <Field label={t("nif")} hint={t("nifHint")} htmlFor="ob-nif">
          <TextInput id="ob-nif" name="nif" required inputMode="numeric" maxLength={24} dir="ltr" defaultValue={defaults.nif} placeholder="00000000000000000000" {...described("nif")} />
          {err("nif")}
        </Field>
        <Field label={t("nis")} hint={t("nisHint")} htmlFor="ob-nis">
          <TextInput id="ob-nis" name="nis" required inputMode="numeric" maxLength={19} dir="ltr" defaultValue={defaults.nis} placeholder="000000000000000" {...described("nis")} />
          {err("nis")}
        </Field>
        <Field label={t("taxArticle")} hint={t("taxArticleHint")} htmlFor="ob-article">
          <TextInput id="ob-article" name="taxArticle" required inputMode="numeric" maxLength={14} dir="ltr" defaultValue={defaults.taxArticle} placeholder="00000000000" {...described("taxArticle")} />
          {err("taxArticle")}
        </Field>
        <Field label={t("rc")} htmlFor="ob-rc">
          <TextInput id="ob-rc" name="rc" required maxLength={40} dir="ltr" defaultValue={defaults.rc} placeholder="19/00-0000000 B 24" {...described("rc")} />
          {err("rc")}
        </Field>
      </div>

      {/* Juste apres le registre : le code d'activite, l'activite CNRC affichee, puis validee.
          Le secteur n'est plus choisi a la main : il est impose par ce code. */}
      <Field label={t("activityCodeLabel")} hint={t("activityCodeHint")} htmlFor="ob-activity">
        <ActivityCodeField
          defaultCode={defaults.activityCode}
          defaultDescription={defaults.activityDescription}
          error={err("activityCode") ?? err("sector")}
          describedBy={described("activityCode")}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-6">
        <WilayaCommuneFields
          idPrefix="ob"
          defaults={defaults}
          selectStyle={selectStyle}
          wilayaError={err("wilaya")}
          cityError={err("city")}
          describedWilaya={described("wilaya")}
          describedCity={described("city")}
        />
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

      {/* Accord du fournisseur pour l'export par AFRICA NEX (facultatif, revocable). */}
      <div className="flex flex-col gap-2 p-4" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }} data-export-consent="">
        <span className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.08em", color: "#065f46" }}>{t("exportConsentTitle")}</span>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" name="exportConsent" defaultChecked={defaults.exportConsent} className="mt-1 h-4 w-4 shrink-0" />
          <span className="font-semibold">{t("exportConsentLabel")}</span>
        </label>
        <p className="text-xs" style={{ color: "var(--muted)" }}>{t("exportConsentHelp")}</p>
      </div>

      <p className="text-xs" style={{ color: "var(--muted)" }}>{t("privacyNote")}</p>

      {mode === "edit" ? (
        <div className="pt-2" style={{ borderTop: "1px solid var(--field-b)" }}>
          <button type="submit" name="intent" value="save" disabled={pending} className="mt-4 w-full py-4 text-sm font-bold uppercase disabled:opacity-60 sm:w-auto sm:px-10" style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}>
            {pending ? t("saving") : t("saveChanges")}
          </button>
        </div>
      ) : (
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
      )}
    </form>
  );
}
