"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveFirstProduct, type ProductField, type ProductState } from "@/app/[locale]/(app)/onboarding/actions";
import { Alert, Field, TextInput } from "@/components/auth/fields";
import { Link } from "@/i18n/navigation";
import { CURRENCIES, PRICE_BASES, UNITS } from "@/lib/onboarding/reference";

export type ProductDefaults = {
  productName: string;
  hsCode: string;
  price: string;
  currency: string;
  priceBasis: string;
  unit: string;
  moq: string;
  photoUrl: string | null;
};

const boxStyle = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;

export function ProductForm({ defaults }: { defaults: ProductDefaults }) {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const [state, action, pending] = useActionState<ProductState, FormData>(saveFirstProduct, { errors: {} });
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const err = (field: ProductField) =>
    state.errors[field] ? <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t(state.errors[field]!)}</span> : null;
  const photo = preview ?? defaults.photoUrl;

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      {state.formError && <Alert tone="error">{t(state.formError)}</Alert>}

      <Field label={t("productName")} hint={t("productNameHint")} htmlFor="ob-product">
        <TextInput id="ob-product" name="productName" required maxLength={255} placeholder={t("productNamePlaceholder")} defaultValue={defaults.productName} />
        {err("productName")}
      </Field>

      <Field label={t("hsCode")} hint={t("hsCodeHint")} htmlFor="ob-hs">
        <TextInput id="ob-hs" name="hsCode" required dir="ltr" inputMode="numeric" placeholder="1509.20.00" defaultValue={defaults.hsCode} />
        <span className="text-xs" style={{ color: "var(--muted)" }}>{t("hsCodeHelp")}</span>
        {err("hsCode")}
      </Field>

      <div className="grid sm:grid-cols-[1fr_auto] gap-6">
        <Field label={t("price")} hint={t("priceHint")} htmlFor="ob-price">
          <TextInput id="ob-price" name="price" required dir="ltr" inputMode="decimal" placeholder="9,20" defaultValue={defaults.price} />
          {err("price")}
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("currency")}</legend>
          <div className="grid grid-cols-3">
            {CURRENCIES.map((c) => (
              <label key={c} className="cursor-pointer">
                <input type="radio" name="currency" value={c} required defaultChecked={(defaults.currency || "USD") === c} className="peer sr-only" />
                <span className="block px-4 py-3 text-center text-sm font-semibold peer-checked:bg-[var(--ink)] peer-checked:text-white peer-focus-visible:outline-2" style={{ border: "1px solid var(--field-b)" }}>{c}</span>
              </label>
            ))}
          </div>
          {err("currency")}
        </fieldset>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        <Field label={t("priceBasis")} htmlFor="ob-basis">
          <select id="ob-basis" name="priceBasis" required defaultValue={defaults.priceBasis || "FOB"} className="w-full px-4 py-3 text-sm" style={boxStyle}>
            {PRICE_BASES.map((b) => <option key={b} value={b}>{t(`basis_${b}`)}</option>)}
          </select>
          {err("priceBasis")}
        </Field>
        <Field label={t("unit")} htmlFor="ob-unit">
          <select id="ob-unit" name="unit" required defaultValue={defaults.unit} className="w-full px-4 py-3 text-sm" style={boxStyle}>
            <option value="" disabled>{t("choose")}</option>
            {UNITS.map((u) => <option key={u} value={u}>{t(`unit_${u}`)}</option>)}
          </select>
          {err("unit")}
        </Field>
        <Field label={t("moq")} hint={t("moqHint")} htmlFor="ob-moq">
          <TextInput id="ob-moq" name="moq" required dir="ltr" inputMode="decimal" placeholder="2000" defaultValue={defaults.moq} />
          {err("moq")}
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("photo")}</span>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden" style={{ ...boxStyle, background: "white" }}>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={t("photoAlt")} className="h-full w-full object-cover" />
            ) : (
              <span className="px-2 text-center text-xs" style={{ color: "var(--muted)" }}>{t("noPhoto")}</span>
            )}
          </div>
          <label className="cursor-pointer px-5 py-3 text-sm font-bold uppercase" style={{ border: "1px solid var(--ink)", letterSpacing: "0.08em" }}>
            {photo ? t("changePhoto") : t("addPhoto")}
            <input type="file" name="photo" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }} />
          </label>
          <span className="text-xs" style={{ color: "var(--muted)" }}>{t("photoHint")}</span>
        </div>
        {err("photo")}
      </div>

      <p className="p-4 text-sm" style={{ background: "var(--field-a)", color: "var(--muted)" }}>{t("productNote")}</p>

      <div className="grid sm:grid-cols-[auto_1fr_1fr] gap-3 pt-2 items-stretch" style={{ borderTop: "1px solid var(--field-b)" }}>
        <Link href="/onboarding?step=2" className="mt-4 flex items-center justify-center px-5 py-4 text-sm font-bold uppercase" style={{ border: "1px solid var(--field-b)", letterSpacing: "0.08em" }}>
          {t("back")}
        </Link>
        <button type="submit" name="intent" value="later" disabled={pending} className="mt-4 py-4 text-sm font-bold uppercase disabled:opacity-60" style={{ background: "white", border: "1px solid var(--ink)", letterSpacing: "0.08em" }}>
          {t("saveLater")}
        </button>
        <button type="submit" name="intent" value="finish" disabled={pending} className="mt-4 py-4 text-sm font-bold uppercase disabled:opacity-60" style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}>
          {pending ? t("saving") : t("finish")}
        </button>
      </div>
    </form>
  );
}
