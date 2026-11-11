"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Field } from "@/components/auth/fields";
import { WILAYAS } from "@/lib/onboarding/reference";
import { COMMUNES, findCommune } from "@/lib/onboarding/communes";

type Described = { "aria-invalid"?: boolean; "aria-describedby"?: string };

// Wilaya puis commune : la liste des communes suit la wilaya choisie (1 541 communes officielles).
// La valeur envoyee reste le nom francais de la commune ; le serveur verifie qu'elle appartient a la wilaya.
export function WilayaCommuneFields({
  idPrefix,
  defaults,
  selectStyle,
  wilayaError,
  cityError,
  describedWilaya = {},
  describedCity = {},
}: {
  idPrefix: string;
  defaults: { wilaya: string; city: string };
  selectStyle: React.CSSProperties;
  wilayaError?: ReactNode;
  cityError?: ReactNode;
  describedWilaya?: Described;
  describedCity?: Described;
}) {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const [wilaya, setWilaya] = useState(defaults.wilaya);
  // Une ancienne saisie libre ("Setif", "sidi-aich") est rattachee a la commune officielle si possible.
  const [city, setCity] = useState(() => findCommune(defaults.wilaya, defaults.city) ?? "");
  const legacy = defaults.city && !findCommune(defaults.wilaya, defaults.city) && wilaya === defaults.wilaya ? defaults.city : null;
  const communes = COMMUNES[wilaya] ?? [];

  return (
    <>
      <Field label={t("wilaya")} htmlFor={`${idPrefix}-wilaya`}>
        <select
          id={`${idPrefix}-wilaya`}
          name="wilaya"
          required
          value={wilaya}
          onChange={(e) => {
            setWilaya(e.target.value);
            setCity("");
          }}
          className="w-full px-4 py-3 text-sm"
          style={selectStyle}
          {...describedWilaya}
        >
          <option value="" disabled>{t("choose")}</option>
          {WILAYAS.map(([code, name]) => <option key={code} value={code}>{`${code} ${name}`}</option>)}
        </select>
        {wilayaError}
      </Field>
      <Field label={t("commune")} htmlFor={`${idPrefix}-city`}>
        <select
          id={`${idPrefix}-city`}
          name="city"
          required
          disabled={!communes.length}
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full px-4 py-3 text-sm disabled:opacity-60"
          style={selectStyle}
          {...describedCity}
        >
          <option value="" disabled>{communes.length ? t("choose") : t("communeChooseWilaya")}</option>
          {communes.map(([fr, ar]) => <option key={fr} value={fr}>{locale === "ar" ? ar : fr}</option>)}
        </select>
        {legacy && !city && (
          <span className="text-xs" style={{ color: "#c2410c" }}>{t("communeLegacy", { value: legacy })}</span>
        )}
        {cityError}
      </Field>
    </>
  );
}
