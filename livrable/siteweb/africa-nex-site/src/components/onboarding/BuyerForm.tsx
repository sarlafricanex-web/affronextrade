"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CountryCode } from "libphonenumber-js";
import { saveBuyer, type BuyerField, type BuyerState } from "@/app/[locale]/(app)/onboarding/buyer-actions";
import { Alert, Field, TextInput } from "@/components/auth/fields";
import { PhoneField } from "@/components/phone/PhoneField";
import { CountrySelect } from "@/components/country/CountrySelect";
import { BUYER_TYPES } from "@/lib/onboarding/reference";
import { SECTIONS, SECTOR_SECTIONS } from "@/lib/sectors";

export type BuyerDefaults = {
  companyName: string;
  buyerType: string;
  country: string;
  city: string;
  phone: string;
  whatsapp: string;
  interests: string[];
  website: string;
};

const legend = "mb-2 text-xs font-semibold uppercase";

// next : page ou revenir apres l'enregistrement (ex. le formulaire de demande de devis).
export function BuyerForm({ defaults: initial, mode = "onboarding", next }: { defaults: BuyerDefaults; mode?: "onboarding" | "edit"; next?: string }) {
  const t = useTranslations("onboarding");
  const ts = useTranslations("sectors");
  const locale = useLocale();
  const [state, action, pending] = useActionState<BuyerState, FormData>(saveBuyer, { errors: {} });
  // Apres une erreur, la saisie est reaffichee (React reinitialise le formulaire apres chaque envoi).
  const defaults = state.values ?? initial;
  const [country, setCountry] = useState<CountryCode | null>((defaults.country as CountryCode) || null);
  const err = (field: BuyerField) =>
    state.errors[field] ? (
      <span id={`b-${field}-error`} className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t(state.errors[field]!)}</span>
    ) : null;

  return (
    <form key={state.attempt ?? 0} action={action} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="mode" value={mode} />
      {next && <input type="hidden" name="next" value={next} />}
      {state.formError && <Alert tone="error">{t(state.formError)}</Alert>}

      <Field label={t("companyName")} htmlFor="b-name">
        <TextInput id="b-name" name="companyName" required maxLength={255} defaultValue={defaults.companyName} autoComplete="organization" />
        {err("companyName")}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className={legend} style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("buyerType")}</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BUYER_TYPES.map((type) => (
            <label key={type} className="cursor-pointer">
              <input type="radio" name="buyerType" value={type} defaultChecked={defaults.buyerType === type} required className="peer sr-only" />
              <span className="block px-2 py-3 text-center text-sm font-semibold peer-checked:bg-[var(--ink)] peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2" style={{ border: "1px solid var(--field-b)" }}>
                {t(`buyerType_${type}`)}
              </span>
            </label>
          ))}
        </div>
        {err("buyerType")}
      </fieldset>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <span id="b-country-label" className={legend} style={{ letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 0 }}>{t("country")}</span>
          <CountrySelect id="b-country" name="country" labelId="b-country-label" defaultValue={country} onChange={setCountry} placeholder={t("countryPlaceholder")} />
          {err("country")}
        </div>
        <Field label={t("city")} htmlFor="b-city">
          <TextInput id="b-city" name="city" required maxLength={100} defaultValue={defaults.city} autoComplete="address-level2" />
          {err("city")}
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <Field label={t("phone")} htmlFor="b-phone">
          <PhoneField id="b-phone" name="phone" required defaultValue={defaults.phone || undefined} suggestedCountry={country} />
          {err("phone")}
        </Field>
        <Field label={t("whatsapp")} hint={t("whatsappHint")} htmlFor="b-whatsapp">
          <PhoneField id="b-whatsapp" name="whatsapp" required defaultValue={defaults.whatsapp || undefined} suggestedCountry={country} />
          {err("whatsapp")}
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={legend} style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("interests")}</legend>
        <p className="text-xs" style={{ color: "var(--muted)" }}>{t("interestsHelp")}</p>
        {SECTIONS.map((section) => (
          <div key={section} className="flex flex-col gap-2">
            <p className="mt-2 text-xs font-bold" style={{ color: "var(--ink)" }}>{ts(`section_${section}`)}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SECTOR_SECTIONS[section].map((s) => (
                <label key={s} className="flex cursor-pointer items-start gap-2 px-3 py-2.5 text-sm" style={{ border: "1px solid var(--field-b)" }}>
                  <input type="checkbox" name="interests" value={s} defaultChecked={defaults.interests.includes(s)} className="mt-0.5 shrink-0" />
                  {ts(s)}
                </label>
              ))}
            </div>
          </div>
        ))}
        {err("interests")}
      </fieldset>

      <Field label={t("website")} hint={t("optional")} htmlFor="b-website">
        <TextInput id="b-website" name="website" maxLength={255} dir="ltr" inputMode="url" placeholder="www.exemple.com" defaultValue={defaults.website} />
        {err("website")}
      </Field>

      <p className="text-xs" style={{ color: "var(--muted)" }}>{t("buyerPrivacyNote")}</p>

      <div className="pt-2" style={{ borderTop: "1px solid var(--field-b)" }}>
        <button type="submit" disabled={pending} className="mt-4 w-full py-4 text-sm font-bold uppercase disabled:opacity-60 sm:w-auto sm:px-10" style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}>
          {pending ? t("saving") : mode === "edit" ? t("saveChanges") : t("buyerFinish")}
        </button>
      </div>
    </form>
  );
}
