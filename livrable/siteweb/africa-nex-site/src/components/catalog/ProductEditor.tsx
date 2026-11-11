"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveProduct, type CatalogField, type CatalogState } from "@/app/[locale]/(app)/catalog/actions";
import { Alert, Field, TextInput } from "@/components/auth/fields";
import { Link } from "@/i18n/navigation";
import { CURRENCIES, PRICE_BASES, UNITS } from "@/lib/onboarding/reference";

export type EditorProduct = {
  id: string;
  productName: string;
  hsCode: string;
  descriptionFr: string;
  descriptionEn: string;
  descriptionAr: string;
  price: string;
  currency: string;
  priceBasis: string;
  unit: string;
  moq: string;
  packaging: string;
  cap20: string;
  cap40: string;
  stock: string;
  status: string;
  images: { path: string; url: string }[];
};

const box = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;
const legend = "mb-2 text-xs font-semibold uppercase";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-6 p-5" style={{ border: "1px solid var(--field-b)" }}>
      <legend className="px-2 font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

export function ProductEditor({ product: initial }: { product: EditorProduct }) {
  const t = useTranslations("onboarding");
  const c = useTranslations("catalog");
  const locale = useLocale();
  const [state, action, pending] = useActionState<CatalogState, FormData>(saveProduct, { errors: {} });
  // L'apercu est lie a la tentative en cours : apres un envoi rate, le champ fichier est vide, l'apercu aussi.
  const [picked, setPicked] = useState<{ url: string; attempt?: number } | null>(null);
  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked.url); }, [picked]);
  const preview = picked && picked.attempt === state.attempt ? picked.url : null;
  const setPreview = (url: string | null) => setPicked(url ? { url, attempt: state.attempt } : null);
  // Apres une erreur, on reaffiche la saisie (le formulaire est remonte via la cle "attempt").
  const product: EditorProduct = state.values ? { ...initial, ...state.values } : initial;

  const msg = (key: string) => (c.has(key) ? c(key) : t(key));
  const err = (field: CatalogField) =>
    state.errors[field] ? <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{msg(state.errors[field]!)}</span> : null;

  return (
    <form key={state.attempt ?? 0} action={action} className="flex flex-col gap-8">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={product.id} />
      {state.formError && <Alert tone="error">{t(state.formError)}</Alert>}

      <Section title={c("sectionIdentity")}>
        <Field label={t("productName")} hint={t("productNameHint")} htmlFor="pe-name">
          <TextInput id="pe-name" name="productName" required maxLength={255} placeholder={t("productNamePlaceholder")} defaultValue={product.productName} />
          {err("productName")}
        </Field>
        <Field label={t("hsCode")} hint={t("hsCodeHint")} htmlFor="pe-hs">
          <TextInput id="pe-hs" name="hsCode" required dir="ltr" inputMode="numeric" placeholder="1509.20.00" defaultValue={product.hsCode} />
          <span className="text-xs" style={{ color: "var(--muted)" }}>{t("hsCodeHelp")}</span>
          {err("hsCode")}
        </Field>
        {(["Fr", "En", "Ar"] as const).map((lang) => (
          <Field key={lang} label={c(`description${lang}`)} hint={t("optional")} htmlFor={`pe-desc-${lang}`}>
            <textarea id={`pe-desc-${lang}`} name={`description${lang}`} dir={lang === "Ar" ? "rtl" : "ltr"} rows={3} maxLength={2000} defaultValue={product[`description${lang}`]} className="w-full resize-y px-4 py-3 text-sm" style={box} />
            {err(`description${lang}`)}
          </Field>
        ))}
      </Section>

      <Section title={c("sectionPrice")}>
        <div className="grid sm:grid-cols-[1fr_auto] gap-6">
          <Field label={t("price")} hint={t("priceHint")} htmlFor="pe-price">
            <TextInput id="pe-price" name="price" required dir="ltr" inputMode="decimal" placeholder="9,20" defaultValue={product.price} />
            {err("price")}
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className={legend} style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("currency")}</legend>
            <div className="grid grid-cols-3">
              {CURRENCIES.map((cur) => (
                <label key={cur} className="cursor-pointer">
                  <input type="radio" name="currency" value={cur} required defaultChecked={(product.currency || "USD") === cur} className="peer sr-only" />
                  <span className="block px-4 py-3 text-center text-sm font-semibold peer-checked:bg-[var(--ink)] peer-checked:text-white peer-focus-visible:outline-2" style={{ border: "1px solid var(--field-b)" }}>{cur}</span>
                </label>
              ))}
            </div>
            {err("currency")}
          </fieldset>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          <Field label={t("priceBasis")} htmlFor="pe-basis">
            <select id="pe-basis" name="priceBasis" required defaultValue={product.priceBasis || "FOB"} className="w-full px-4 py-3 text-sm" style={box}>
              {PRICE_BASES.map((b) => <option key={b} value={b}>{t(`basis_${b}`)}</option>)}
            </select>
          </Field>
          <Field label={t("unit")} htmlFor="pe-unit">
            <select id="pe-unit" name="unit" required defaultValue={product.unit} className="w-full px-4 py-3 text-sm" style={box}>
              <option value="" disabled>{t("choose")}</option>
              {UNITS.map((u) => <option key={u} value={u}>{t(`unit_${u}`)}</option>)}
            </select>
            {err("unit")}
          </Field>
          <Field label={t("moq")} hint={t("moqHint")} htmlFor="pe-moq">
            <TextInput id="pe-moq" name="moq" required dir="ltr" inputMode="decimal" placeholder="2000" defaultValue={product.moq} />
            {err("moq")}
          </Field>
        </div>
      </Section>

      <Section title={c("sectionLogistics")}>
        <Field label={c("packaging")} hint={t("optional")} htmlFor="pe-pack">
          <TextInput id="pe-pack" name="packaging" maxLength={200} placeholder={c("packagingPlaceholder")} defaultValue={product.packaging} />
          {err("packaging")}
        </Field>
        <div className="grid sm:grid-cols-3 gap-6">
          <Field label={c("cap20")} hint={t("optional")} htmlFor="pe-cap20">
            <TextInput id="pe-cap20" name="cap20" dir="ltr" inputMode="numeric" defaultValue={product.cap20} />
            {err("cap20")}
          </Field>
          <Field label={c("cap40")} hint={t("optional")} htmlFor="pe-cap40">
            <TextInput id="pe-cap40" name="cap40" dir="ltr" inputMode="numeric" defaultValue={product.cap40} />
            {err("cap40")}
          </Field>
          <Field label={c("stock")} hint={t("optional")} htmlFor="pe-stock">
            <TextInput id="pe-stock" name="stock" dir="ltr" inputMode="decimal" defaultValue={product.stock} />
            {err("stock")}
          </Field>
        </div>
        <span className="text-xs" style={{ color: "var(--muted)" }}>{c("capacityHelp")}</span>
      </Section>

      <Section title={c("sectionPhotos")}>
        <div className="flex flex-wrap gap-4">
          {product.images.map((img) => (
            <label key={img.path} className="flex w-28 cursor-pointer flex-col gap-1 text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={c("photoAlt")} className="h-28 w-28 object-cover" style={{ border: "1px solid var(--field-b)" }} />
              <span className="flex items-center gap-1"><input type="checkbox" name="removePhoto" value={img.path} /> {c("removePhoto")}</span>
            </label>
          ))}
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={c("photoAlt")} className="h-28 w-28 object-cover" style={{ border: "2px solid var(--accent)" }} />
          )}
        </div>
        {product.images.length < 5 && (
          <label className="w-fit cursor-pointer px-5 py-3 text-sm font-bold uppercase" style={{ border: "1px solid var(--ink)", letterSpacing: "0.08em" }}>
            {t("addPhoto")}
            <input type="file" name="photo" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }} />
          </label>
        )}
        <span className="text-xs" style={{ color: "var(--muted)" }}>{c("photosHelp")}</span>
        {err("photo")}
      </Section>

      <Section title={c("sectionStatus")}>
        <div className="grid sm:grid-cols-2 gap-3">
          {(["draft", "published"] as const).map((s) => (
            <label key={s} className="flex cursor-pointer items-start gap-3 p-4" style={{ border: "1px solid var(--field-b)" }}>
              <input type="radio" name="status" value={s} defaultChecked={(product.status || "draft") === s} className="mt-1" />
              <span>
                <span className="block font-bold">{c(`status_${s}`)}</span>
                <span className="block text-sm" style={{ color: "var(--muted)" }}>{c(`status_${s}_help`)}</span>
              </span>
            </label>
          ))}
        </div>
        {err("status")}
      </Section>

      <div className="flex flex-wrap gap-3">
        <Link href="/catalog" className="px-6 py-4 text-sm font-bold uppercase" style={{ border: "1px solid var(--field-b)", letterSpacing: "0.08em" }}>
          {c("cancel")}
        </Link>
        <button type="submit" disabled={pending} className="px-10 py-4 text-sm font-bold uppercase disabled:opacity-60" style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}>
          {pending ? t("saving") : c("save")}
        </button>
      </div>
    </form>
  );
}
