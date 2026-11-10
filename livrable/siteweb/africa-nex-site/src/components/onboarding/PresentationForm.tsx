"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { savePresentation, type PresentationField, type PresentationState } from "@/app/[locale]/(app)/onboarding/actions";
import { Alert, Field, TextInput } from "@/components/auth/fields";

export type PresentationDefaults = {
  descriptionFr: string;
  descriptionEn: string;
  descriptionAr: string;
  website: string;
  foundedYear: string;
  headcount: string;
  logoUrl: string | null;
};

const boxStyle = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;
const HEADCOUNTS = ["1-9", "10-49", "50-249", "250+"];

function Description({ id, name, label, hint, dir, defaultValue, min, error }: {
  id: string; name: string; label: string; hint: string; dir: "ltr" | "rtl"; defaultValue: string; min?: number; error: React.ReactNode;
}) {
  const t = useTranslations("onboarding");
  const [length, setLength] = useState(defaultValue.length);
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <textarea
        id={id}
        name={name}
        dir={dir}
        rows={5}
        maxLength={2000}
        minLength={min}
        required={Boolean(min)}
        defaultValue={defaultValue}
        onChange={(e) => setLength(e.target.value.length)}
        className="w-full px-4 py-3 text-sm resize-y"
        style={boxStyle}
      />
      <span className="text-xs" style={{ color: min && length < min ? "#b45309" : "var(--muted)" }}>
        {min && length < min ? t("charsMissing", { count: min - length }) : t("charsCount", { count: length })}
      </span>
      {error}
    </Field>
  );
}

export function PresentationForm({ defaults, mode = "onboarding" }: { defaults: PresentationDefaults; mode?: "onboarding" | "edit" }) {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const [state, action, pending] = useActionState<PresentationState, FormData>(savePresentation, { errors: {} });
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const err = (field: PresentationField) =>
    state.errors[field] ? <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t(state.errors[field]!)}</span> : null;
  const logo = preview ?? defaults.logoUrl;

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="mode" value={mode} />
      {state.formError && <Alert tone="error">{t(state.formError)}</Alert>}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("logo")}</span>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden" style={{ ...boxStyle, background: "white" }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={t("logoAlt")} className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-center px-2" style={{ color: "var(--muted)" }}>{t("noLogo")}</span>
            )}
          </div>
          <label className="cursor-pointer px-5 py-3 text-sm font-bold uppercase" style={{ border: "1px solid var(--ink)", letterSpacing: "0.08em" }}>
            {logo ? t("changeLogo") : t("addLogo")}
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </label>
          <span className="text-xs" style={{ color: "var(--muted)" }}>{t("logoHint")}</span>
        </div>
        {err("logo")}
      </div>

      <Description id="ob-desc-fr" name="descriptionFr" label={t("descriptionFr")} hint={t("descriptionFrHint")} dir="ltr" defaultValue={defaults.descriptionFr} min={80} error={err("descriptionFr")} />
      <Description id="ob-desc-en" name="descriptionEn" label={t("descriptionEn")} hint={t("optional")} dir="ltr" defaultValue={defaults.descriptionEn} error={err("descriptionEn")} />
      <Description id="ob-desc-ar" name="descriptionAr" label={t("descriptionAr")} hint={t("optional")} dir="rtl" defaultValue={defaults.descriptionAr} error={err("descriptionAr")} />
      <p className="text-xs" style={{ color: "var(--muted)" }}>{t("translationNote")}</p>

      <div className="grid sm:grid-cols-3 gap-6">
        <Field label={t("website")} hint={t("optional")} htmlFor="ob-website">
          <TextInput id="ob-website" name="website" dir="ltr" inputMode="url" placeholder="www.exemple.dz" defaultValue={defaults.website} />
          {err("website")}
        </Field>
        <Field label={t("foundedYear")} hint={t("optional")} htmlFor="ob-year">
          <TextInput id="ob-year" name="foundedYear" inputMode="numeric" dir="ltr" maxLength={4} placeholder="2015" defaultValue={defaults.foundedYear} />
          {err("foundedYear")}
        </Field>
        <Field label={t("headcount")} hint={t("optional")} htmlFor="ob-headcount">
          <select id="ob-headcount" name="headcount" defaultValue={defaults.headcount} className="w-full px-4 py-3 text-sm" style={boxStyle}>
            <option value="">{t("choose")}</option>
            {HEADCOUNTS.map((h) => <option key={h} value={h}>{t("employees", { range: h })}</option>)}
          </select>
          {err("headcount")}
        </Field>
      </div>

      {mode === "edit" ? (
        <div className="pt-2" style={{ borderTop: "1px solid var(--field-b)" }}>
          <button type="submit" name="intent" value="save" disabled={pending} className="mt-4 w-full py-4 text-sm font-bold uppercase disabled:opacity-60 sm:w-auto sm:px-10" style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}>
            {pending ? t("saving") : t("saveChanges")}
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 pt-2" style={{ borderTop: "1px solid var(--field-b)" }}>
        <button type="submit" name="intent" value="later" disabled={pending} className="mt-4 py-4 text-sm font-bold uppercase disabled:opacity-60" style={{ background: "white", border: "1px solid var(--ink)", letterSpacing: "0.08em" }}>
          {t("saveLater")}
        </button>
        <button type="submit" name="intent" value="continue" disabled={pending} className="mt-4 py-4 text-sm font-bold uppercase disabled:opacity-60" style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}>
          {pending ? t("saving") : t("continueStep3")}
        </button>
      </div>
      )}
    </form>
  );
}
