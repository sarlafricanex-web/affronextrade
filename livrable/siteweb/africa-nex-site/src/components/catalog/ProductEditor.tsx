"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveProduct, type CatalogField, type CatalogState } from "@/app/[locale]/(app)/catalog/actions";
import { Alert } from "@/components/auth/fields";
import { Link } from "@/i18n/navigation";
import { CURRENCIES, PRICE_BASES, UNITS } from "@/lib/onboarding/reference";
import { prepareUpload } from "@/lib/client/prepare-upload";

// Editeur de produit d'apres la maquette Stitch 07 : six blocs numerotes et un panneau
// "Pret a publier ?" mis a jour pendant la saisie.

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

const HAIR = "#d8cebb";
const FIELD = "#faecdc";
const fieldStyle = { background: FIELD, border: `1px solid ${HAIR}`, outline: "none" } as const;
const inputCls = "w-full px-3 py-3 text-sm";
const labelCls = "mb-2 block text-[11px] font-bold uppercase";
const labelStyle = { letterSpacing: "0.08em", color: "var(--muted)" } as const;
const MAX_PHOTOS = 5;

function Block({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="p-6" style={{ background: "white", border: `1px solid ${HAIR}` }}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 pb-3" style={{ borderBottom: `1px solid ${HAIR}` }}>
        <h2 className="font-extrabold uppercase" style={{ letterSpacing: "-0.01em" }}>{title}</h2>
        {aside && <span className="text-[11px] font-bold uppercase" style={labelStyle}>{aside}</span>}
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Label({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return <label htmlFor={htmlFor} className={labelCls} style={labelStyle}>{children}</label>;
}

type Checks = { name: boolean; descFr: boolean; hs: boolean; price: boolean; currency: boolean; unit: boolean; moq: boolean; packaging: boolean; capacity: boolean; photo: boolean };
const REQUIRED: (keyof Checks)[] = ["name", "hs", "price", "currency", "unit", "moq"];

function readChecks(form: HTMLFormElement | null, product: EditorProduct, hasNewPhoto: boolean): Checks {
  const get = (k: string) => (form ? String(new FormData(form).get(k) ?? "") : (product as unknown as Record<string, string>)[k] ?? "").trim();
  const removed = form ? new FormData(form).getAll("removePhoto").length : 0;
  return {
    name: get("productName").length >= 2,
    descFr: get("descriptionFr").length > 0,
    hs: /^\d{4}([.\s]?\d{2}){1,3}$/.test(get("hsCode")),
    price: Number(get("price").replace(",", ".")) > 0,
    currency: get("currency").length > 0,
    unit: get("unit").length > 0,
    moq: Number(get("moq").replace(/\s/g, "").replace(",", ".")) > 0,
    packaging: get("packaging").length > 0,
    capacity: get("cap20").length > 0 || get("cap40").length > 0,
    photo: product.images.length - removed > 0 || hasNewPhoto,
  };
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
  // Apres une erreur, on reaffiche la saisie (le formulaire est remonte via la cle "attempt").
  const product: EditorProduct = state.values ? { ...initial, ...state.values } : initial;
  const [lang, setLang] = useState<"Fr" | "En" | "Ar">("Fr");
  const [checks, setChecks] = useState<{ value: Checks; attempt?: number } | null>(null);
  const current = checks && checks.attempt === state.attempt ? checks.value : readChecks(null, product, false);
  const missing = REQUIRED.filter((k) => !current[k]).length;
  const done = (Object.keys(current) as (keyof Checks)[]).filter((k) => current[k]).length;
  const total = Object.keys(current).length;
  const isPublished = product.status === "published";

  const msg = (key: string) => (c.has(key) ? c(key) : t(key));
  const err = (field: CatalogField) =>
    state.errors[field] ? <span className="mt-1 block text-xs font-semibold" style={{ color: "#dc2626" }}>{msg(state.errors[field]!)}</span> : null;
  const refresh = (form: HTMLFormElement, hasNewPhoto = Boolean(preview)) => setChecks({ value: readChecks(form, product, hasNewPhoto), attempt: state.attempt });

  return (
    <form key={state.attempt ?? 0} action={action} onChange={(e) => refresh(e.currentTarget)} onInput={(e) => refresh(e.currentTarget)} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={product.id} />

      <div className="flex min-w-0 flex-col gap-6">
        {state.formError && <Alert tone="error">{t(state.formError)}</Alert>}

        <Block title={c("block1")}>
          <div>
            <Label htmlFor="pe-name">{t("productName")}</Label>
            <input id="pe-name" name="productName" required maxLength={255} placeholder={t("productNamePlaceholder")} defaultValue={product.productName} className={inputCls} style={fieldStyle} />
            {err("productName")}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold uppercase" style={labelStyle}>{c("descriptionTitle")}</span>
              <div className="flex" role="tablist" aria-label={c("descriptionTitle")}>
                {(["Fr", "En", "Ar"] as const).map((l) => (
                  <button key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => setLang(l)} className="px-3 py-1 text-xs font-bold uppercase" style={{ border: `1px solid ${HAIR}`, background: lang === l ? "var(--ink)" : "white", color: lang === l ? "white" : "var(--ink)" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {(["Fr", "En", "Ar"] as const).map((l) => (
              <div key={l} hidden={lang !== l}>
                <label htmlFor={`pe-desc-${l}`} className="sr-only">{c(`description${l}`)}</label>
                <textarea id={`pe-desc-${l}`} name={`description${l}`} dir={l === "Ar" ? "rtl" : "ltr"} rows={5} maxLength={2000} defaultValue={product[`description${l}`]} placeholder={c(`descPlaceholder${l}`)} className={`${inputCls} resize-y`} style={fieldStyle} />
                {err(`description${l}`)}
              </div>
            ))}
          </div>
        </Block>

        <Block title={c("block2")} aside={c("block2Aside")}>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="pe-hs">{c("hsLabel")}</Label>
              <div className="flex" dir="ltr" style={{ border: `1px solid ${HAIR}` }}>
                <span className="flex items-center px-3 text-xs font-bold" style={{ background: "white", borderInlineEnd: `1px solid ${HAIR}` }}>HS</span>
                <input id="pe-hs" name="hsCode" required inputMode="numeric" placeholder="1509.20" defaultValue={product.hsCode} className={inputCls} style={{ background: FIELD, border: 0, outline: "none" }} />
              </div>
              <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>{t("hsCodeHelp")}</span>
              {err("hsCode")}
            </div>
            <div className="p-4" style={{ background: "#fff2e2", border: `1px solid ${HAIR}` }}>
              <p className="mb-1 text-[11px] font-bold uppercase" style={{ letterSpacing: "0.08em" }}>{c("hsBoxTitle")}</p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>{c("hsBoxText")}</p>
            </div>
          </div>
        </Block>

        <Block title={c("block3")} aside={c("block3Aside")}>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <Label htmlFor="pe-price">{t("price")}</Label>
              <input id="pe-price" name="price" required dir="ltr" inputMode="decimal" placeholder="9,20" defaultValue={product.price} className={`${inputCls} text-end`} style={fieldStyle} />
              {err("price")}
            </div>
            <div>
              <Label htmlFor="pe-currency">{t("currency")}</Label>
              <select id="pe-currency" name="currency" required defaultValue={product.currency || "USD"} className={inputCls} style={fieldStyle}>
                {CURRENCIES.map((cur) => <option key={cur} value={cur}>{cur}</option>)}
              </select>
              {err("currency")}
            </div>
            <div>
              <Label htmlFor="pe-unit">{t("unit")}</Label>
              <select id="pe-unit" name="unit" required defaultValue={product.unit} className={inputCls} style={fieldStyle}>
                <option value="" disabled>{t("choose")}</option>
                {UNITS.map((u) => <option key={u} value={u}>{t(`unit_${u}`)}</option>)}
              </select>
              {err("unit")}
            </div>
            <div>
              <Label htmlFor="pe-moq">{c("moqLabel")}</Label>
              <input id="pe-moq" name="moq" required dir="ltr" inputMode="decimal" placeholder="2000" defaultValue={product.moq} className={`${inputCls} text-end`} style={fieldStyle} />
              {err("moq")}
            </div>
          </div>
          <div className="sm:max-w-xs">
            <Label htmlFor="pe-basis">{t("priceBasis")}</Label>
            <select id="pe-basis" name="priceBasis" required defaultValue={product.priceBasis || "FOB"} className={inputCls} style={fieldStyle}>
              {PRICE_BASES.map((b) => <option key={b} value={b}>{t(`basis_${b}`)}</option>)}
            </select>
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>{c("priceConfidential")}</p>
        </Block>

        <Block title={c("block4")} aside={c("block4Aside")}>
          <div>
            <Label htmlFor="pe-pack">{c("packaging")}</Label>
            <input id="pe-pack" name="packaging" maxLength={200} placeholder={c("packagingPlaceholder")} defaultValue={product.packaging} className={inputCls} style={fieldStyle} />
            {err("packaging")}
          </div>
          <div className="pt-4" style={{ borderTop: `1px solid ${HAIR}` }}>
            <p className="mb-3 text-[11px] font-bold uppercase" style={labelStyle}>{c("containerTitle")}</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="pe-cap20" className="mb-2 block text-sm" style={{ color: "var(--muted)" }}>{c("cap20Long")}</label>
                <input id="pe-cap20" name="cap20" dir="ltr" inputMode="numeric" defaultValue={product.cap20} className={inputCls} style={fieldStyle} />
                {err("cap20")}
              </div>
              <div>
                <label htmlFor="pe-cap40" className="mb-2 block text-sm" style={{ color: "var(--muted)" }}>{c("cap40Long")}</label>
                <input id="pe-cap40" name="cap40" dir="ltr" inputMode="numeric" defaultValue={product.cap40} className={inputCls} style={fieldStyle} />
                {err("cap40")}
              </div>
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>{c("capacityHelp")}</p>
          </div>
        </Block>

        <Block title={c("block5")} aside={c("block5Aside")}>
          <div className="sm:max-w-sm">
            <Label htmlFor="pe-stock">{c("stockLabel")}</Label>
            <input id="pe-stock" name="stock" dir="ltr" inputMode="decimal" defaultValue={product.stock} className={inputCls} style={fieldStyle} />
            <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>{c("stockHelp")}</span>
            {err("stock")}
          </div>
        </Block>

        <Block title={c("block6")} aside={c("block6Aside")}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {product.images.map((img, i) => (
              <label key={img.path} className="flex cursor-pointer flex-col" style={{ border: i === 0 ? "2px solid var(--ink)" : `1px solid ${HAIR}` }}>
                {i === 0 && <span className="px-2 py-1 text-[10px] font-bold uppercase text-white" style={{ background: "var(--ink)", letterSpacing: "0.08em" }}>{c("mainPhoto")}</span>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={c("photoAlt")} className="aspect-square w-full object-cover" />
                <span className="flex items-center gap-1.5 px-2 py-1.5 text-xs"><input type="checkbox" name="removePhoto" value={img.path} /> {c("removePhoto")}</span>
              </label>
            ))}
            {preview && (
              <div className="flex flex-col" style={{ border: "2px solid #10b981" }}>
                <span className="px-2 py-1 text-[10px] font-bold uppercase text-white" style={{ background: "#10b981", letterSpacing: "0.08em" }}>{c("newPhoto")}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt={c("photoAlt")} className="aspect-square w-full object-cover" />
              </div>
            )}
            {/* La case reste dans la page une fois la photo choisie (masquee) : sinon le fichier ne serait pas envoye. */}
            {product.images.length < MAX_PHOTOS && (
              <label hidden={Boolean(preview)} className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 p-3 text-center" style={{ background: "#fff8f3", border: `2px dashed ${HAIR}` }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ color: "var(--muted)" }}><path d="M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6M15 9h.01" /></svg>
                <span className="text-xs font-bold uppercase" style={{ letterSpacing: "0.08em" }}>+ {t("addPhoto")}</span>
                <input
                  type="file"
                  name="photo"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={async (e) => {
                    const form = e.currentTarget.form;
                    // Photo de telephone reduite avant l'envoi : passe sous la limite de 4 Mo.
                    const result = await prepareUpload(e.currentTarget, { maxBytes: 4 * 1024 * 1024 });
                    const url = result.ok && result.file ? URL.createObjectURL(result.file) : null;
                    setPicked(url ? { url, attempt: state.attempt } : null);
                    if (form) refresh(form, Boolean(url));
                  }}
                />
              </label>
            )}
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>{c("photosHelp")}</p>
          {err("photo")}
        </Block>
      </div>

      <aside className="flex flex-col gap-4 p-5 lg:sticky lg:top-20" style={{ background: "white", border: `1px solid ${HAIR}` }}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-extrabold uppercase">{c("readyTitle")}</h2>
          <span className="font-extrabold" style={{ color: "#059669", fontFeatureSettings: '"tnum" 1' }}>{done}/{total}</span>
        </div>
        <p className="text-sm" style={{ color: "var(--muted)" }}>{c("readyText")}</p>
        <div className="h-2 w-full" style={{ background: "#f5efe6", border: `1px solid ${HAIR}` }} role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
          <div className="h-full" style={{ width: `${(done / total) * 100}%`, background: "#059669" }} />
        </div>
        <ul className="flex flex-col gap-1.5 text-sm">
          {(Object.keys(current) as (keyof Checks)[]).map((k) => {
            const ok = current[k];
            const required = REQUIRED.includes(k);
            return (
              <li key={k} className="flex items-center justify-between gap-2 px-1 py-1" style={!ok && required ? { background: "#fff7ed" } : undefined}>
                <span className="flex items-center gap-2" style={{ color: !ok && required ? "#c2410c" : "var(--ink)" }}>
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[10px] font-bold" style={ok ? { background: "#059669", color: "white" } : { background: required ? "#f97316" : "white", border: `1px solid ${required ? "#f97316" : HAIR}` }} aria-hidden="true">{ok ? "✓" : ""}</span>
                  {c(`check_${k}`)}
                </span>
                <span className="text-[10px] font-bold uppercase" style={{ letterSpacing: "0.06em", color: ok ? "#059669" : required ? "#c2410c" : "var(--muted)" }}>
                  {ok ? c("checkOk") : required ? c("checkRequired") : c("checkOptional")}
                </span>
              </li>
            );
          })}
        </ul>
        {missing > 0 && (
          <p className="flex items-start gap-2 p-3 text-sm" style={{ background: "#fff7ed", border: "1px solid #f97316", color: "#9a3412" }}>
            <span aria-hidden="true">⚠</span>
            {c("missingRequired", { count: missing })}
          </p>
        )}
        <button type="submit" name="status" value="draft" disabled={pending} className="w-full py-3 text-sm font-bold uppercase disabled:opacity-60" style={{ border: "1px solid var(--ink)", background: "white", color: "var(--ink)", letterSpacing: "0.08em" }}>
          {pending ? t("saving") : isPublished ? c("saveAsDraft") : c("saveDraft")}
        </button>
        <button type="submit" name="status" value="published" disabled={pending || missing > 0} className="w-full py-3 text-sm font-bold uppercase disabled:opacity-50" style={{ background: "#10b981", color: "white", letterSpacing: "0.08em" }}>
          {isPublished ? c("savePublished") : c("publish")}
        </button>
        <Link href="/catalog" className="text-center text-xs font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.08em" }}>{c("cancel")}</Link>
        <p className="pt-3 text-center text-xs" style={{ borderTop: `1px solid ${HAIR}`, color: "var(--muted)" }}>{c("centralized")}</p>
      </aside>
    </form>
  );
}
