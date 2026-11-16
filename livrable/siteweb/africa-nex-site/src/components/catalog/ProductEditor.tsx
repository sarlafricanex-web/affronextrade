"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveProduct, type CatalogField, type CatalogState } from "@/app/[locale]/(app)/catalog/actions";
import { Alert } from "@/components/auth/fields";
import { Link } from "@/i18n/navigation";
import { UNITS } from "@/lib/onboarding/reference";
import { EXPORT_CURRENCIES, PACK_LABELS, PACK_LEVELS, PACK_PROTECTIONS, PACK_TYPES, PACK_WEDGING, STARTER_BASES, TIER_BASES, TIER_SLOTS, isDetailedTier, readPackagingInput, type DiscountTier, type PackField, type TierField } from "@/lib/catalog/price-list";
import { CountrySelect } from "@/components/country/CountrySelect";
import type { CountryCode } from "libphonenumber-js";
import { prepareUpload } from "@/lib/client/prepare-upload";
import { STORAGE_CONDITIONS, estimateContainer, type LogisticsInput } from "@/lib/logistics/container";
import { logisticsFromSpec, packagingWarnings, readLogisticsExtras, type PackWarning } from "@/lib/catalog/packaging-logic";

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
  stock: string;
  status: string;
  images: { path: string; url: string }[];
  // Fiche logistique : la capacite par conteneur en est calculee.
  unitsPerCarton: string;
  cartonLength: string;
  cartonWidth: string;
  cartonHeight: string;
  cartonWeight: string;
  maxStack: string;
  storage: string;
  palletized: string;
  cartonsPerPallet: string;
  // Liste de prix : reference, construction du prix selon le forfait, validite, delai, origine.
  sku: string;
  crossRefs: string;
  productCost: string;
  packagingCost: string;
  pricePlace: string;
  priceValidUntil: string;
  leadDays: string;
  originCountry: string;
  stockUpdatedAt: string;
  priceDzd: string;
} & Record<PackField, string> & Record<TierField, string>;


// Logistique deduite des 4 niveaux (meme calcul que le serveur et l'import Excel) + controles de coherence.
function readLogistics(form: HTMLFormElement | null, product: EditorProduct): { input: LogisticsInput; unit: string; warnings: PackWarning[] } {
  const fd = form ? new FormData(form) : null;
  const get = (k: string) => (fd ? String(fd.get(k) ?? "") : String((product as unknown as Record<string, string>)[k] ?? "")).trim();
  const { spec } = readPackagingInput((k) => get(k));
  const extras = readLogisticsExtras((k) => get(k));
  return { unit: get("unit"), input: logisticsFromSpec(spec, extras.storage, extras.maxStack), warnings: packagingWarnings(spec) };
}

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
// La photo est obligatoire pour publier (decision d'Adlene) : un acheteur ne voit jamais de fiche sans image.
const REQUIRED: (keyof Checks)[] = ["name", "hs", "price", "currency", "unit", "moq", "photo"];

function readChecks(form: HTMLFormElement | null, product: EditorProduct, hasNewPhoto: boolean): Checks {
  const get = (k: string) => (form ? String(new FormData(form).get(k) ?? "") : (product as unknown as Record<string, string>)[k] ?? "").trim();
  const removed = form ? new FormData(form).getAll("removePhoto").length : 0;
  return {
    name: get("productName").length >= 2,
    descFr: get("descriptionFr").length > 0,
    hs: /^\d{4}([.\s]?\d{2}){1,3}$/.test(get("hsCode")),
    price: Number(get("price").replace(",", ".")) > 0 || Number(get("productCost").replace(",", ".")) > 0,
    currency: get("currency").length > 0,
    unit: get("unit").length > 0,
    moq: Number(get("moq").replace(/\s/g, "").replace(",", ".")) > 0,
    packaging: get("packaging").length > 0,
    capacity: Boolean(estimateContainer(readLogistics(form, product).input, "20")),
    photo: product.images.length - removed > 0 || hasNewPhoto,
  };
}

export function ProductEditor({ product: initial, tier, defaultTiers }: { product: EditorProduct; tier: string; defaultTiers: DiscountTier[] }) {
  const detailed = isDetailedTier(tier);
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
  const [logi, setLogi] = useState<{ value: ReturnType<typeof readLogistics>; attempt?: number } | null>(null);
  const logistics = logi && logi.attempt === state.attempt ? logi.value : readLogistics(null, product);
  const est20 = estimateContainer(logistics.input, "20", "floor");
  const est40 = estimateContainer(logistics.input, "40", "floor");
  const unitShort = logistics.unit ? c(`unitShort_${logistics.unit}`) : "";
  // Pro / Enterprise : prix FCA = cout produit + cout emballage, affiche pendant la saisie.
  const [costs, setCosts] = useState<{ value: [string, string]; attempt?: number } | null>(null);
  const [pc, pk] = costs && costs.attempt === state.attempt ? costs.value : [product.productCost, product.packagingCost];
  const amount = (s: string) => Number(s.replace(/\s/g, "").replace(",", ".")) || 0;
  const fca = amount(pc) + amount(pk);
  const [live, setLive] = useState<{ value: Record<string, string>; attempt?: number } | null>(null);
  const liveValue = (k: string) => String((live && live.attempt === state.attempt ? live.value[k] : (product as unknown as Record<string, string>)[k]) ?? "").replace(",", ".");
  const refresh = (form: HTMLFormElement, hasNewPhoto = Boolean(preview)) => {
    setChecks({ value: readChecks(form, product, hasNewPhoto), attempt: state.attempt });
    setLogi({ value: readLogistics(form, product), attempt: state.attempt });
    const fd = new FormData(form);
    setLive({ value: Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])), attempt: state.attempt });
    setCosts({ value: [String(fd.get("productCost") ?? ""), String(fd.get("packagingCost") ?? "")], attempt: state.attempt });
  };

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
                <textarea id={`pe-desc-${l}`} name={`description${l}`} dir={l === "Ar" ? "rtl" : "ltr"} lang={l.toLowerCase()} spellCheck rows={5} maxLength={2000} defaultValue={product[`description${l}`]} placeholder={c(`descPlaceholder${l}`)} className={`${inputCls} resize-y`} style={fieldStyle} />
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

        <Block title={c("block3")} aside={c(detailed ? "block3AsideDetailed" : "block3AsideStarter")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="pe-sku">{c("skuLabel")}</Label>
              <input id="pe-sku" name="sku" maxLength={60} dir="ltr" placeholder="AF-018" defaultValue={product.sku} className={inputCls} style={fieldStyle} />
              <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>{c("skuHelp")}</span>
              {err("sku")}
            </div>
            <div>
              <Label htmlFor="pe-cross">{c("crossRefsLabel")}</Label>
              <input id="pe-cross" name="crossRefs" dir="ltr" placeholder="1444 TV, P520A" defaultValue={product.crossRefs} className={inputCls} style={fieldStyle} />
              <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>{c("crossRefsHelp")}</span>
              {err("crossRefs")}
            </div>
          </div>
          {detailed ? (
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <Label htmlFor="pe-cost">{c("productCostLabel")}</Label>
                <input id="pe-cost" name="productCost" required dir="ltr" inputMode="decimal" placeholder="1,60" defaultValue={product.productCost} className={`${inputCls} text-end`} style={fieldStyle} />
                {err("productCost")}
              </div>
              <div>
                <Label htmlFor="pe-packcost">{c("packagingCostLabel")}</Label>
                <input id="pe-packcost" name="packagingCost" dir="ltr" inputMode="decimal" placeholder="0,40" defaultValue={product.packagingCost} className={`${inputCls} text-end`} style={fieldStyle} />
                {err("packagingCost")}
              </div>
              <div className="flex flex-col justify-end p-3" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }} aria-live="polite" data-fca="">
                <span className="text-[11px] font-bold uppercase" style={{ ...labelStyle, color: "#065f46" }}>{c("fcaLabel")}</span>
                <strong dir="ltr" style={{ fontSize: "1.3rem" }}>{fca > 0 ? fca.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</strong>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <Label htmlFor="pe-price">{t("price")}</Label>
                <input id="pe-price" name="price" required dir="ltr" inputMode="decimal" placeholder="9,20" defaultValue={product.price} className={`${inputCls} text-end`} style={fieldStyle} />
                {err("price")}
              </div>
              <div>
                <Label htmlFor="pe-basis">{t("priceBasis")}</Label>
                <select id="pe-basis" name="priceBasis" required defaultValue={product.priceBasis || "FOB"} className={inputCls} style={fieldStyle}>
                  {STARTER_BASES.map((b) => <option key={b} value={b}>{t.has(`basis_${b}`) ? t(`basis_${b}`) : b}</option>)}
                </select>
                {err("priceBasis")}
              </div>
              <div>
                <Label htmlFor="pe-place">{c("pricePlaceLabel")}</Label>
                <input id="pe-place" name="pricePlace" maxLength={120} placeholder={c("pricePlacePlaceholder")} defaultValue={product.pricePlace} className={inputCls} style={fieldStyle} />
                {err("pricePlace")}
              </div>
            </div>
          )}
          <p className="text-xs" style={{ color: "var(--muted)" }}>{c(detailed ? "priceRuleDetailed" : "priceRuleStarter")}</p>
          {/* Deuxieme prix : en dinars HT, confidentiel (AFRICA NEX seule, jamais montre a l'acheteur). */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="pe-dzd">{c("priceDzdLabel")}</Label>
              <div className="flex" dir="ltr" style={{ border: `1px solid ${HAIR}` }}>
                <input id="pe-dzd" name="priceDzd" required inputMode="decimal" placeholder="1 250,00" defaultValue={product.priceDzd} className={`${inputCls} text-end`} style={{ background: FIELD, border: 0, outline: "none" }} />
                <span className="flex items-center px-3 text-xs font-bold" style={{ background: "white", borderInlineStart: `1px solid ${HAIR}` }}>DZD HT</span>
              </div>
              <span className="mt-1 block text-xs" style={{ color: "#c2410c" }}>{c("priceDzdHelp")}</span>
              {err("priceDzd")}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <Label htmlFor="pe-currency">{c("exportCurrencyLabel")}</Label>
              <select id="pe-currency" name="currency" required defaultValue={(EXPORT_CURRENCIES as readonly string[]).includes(product.currency) ? product.currency : ""} className={inputCls} style={fieldStyle}>
                <option value="" disabled>{t("choose")}</option>
                {EXPORT_CURRENCIES.map((cur) => <option key={cur} value={cur}>{cur}</option>)}
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
            <div>
              <Label htmlFor="pe-valid">{c("priceValidUntilLabel")}</Label>
              <input id="pe-valid" name="priceValidUntil" type="date" dir="ltr" defaultValue={product.priceValidUntil} className={inputCls} style={fieldStyle} />
              <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>{c("priceValidUntilHelp")}</span>
              {err("priceValidUntil")}
            </div>
          </div>
          {/* Marge de negociation : remise maximale par paliers, confidentielle, jamais appliquee d'office. */}
          <fieldset className="flex flex-col gap-3 p-4" style={{ border: `1px solid ${HAIR}`, background: "#fffaf3" }} data-tiers="">
            <legend className="px-1 text-[11px] font-bold uppercase" style={labelStyle}>{c("tiersTitle")}</legend>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{c("tiersHelp")}</p>
            {TIER_SLOTS.map((n) => (
              <div key={n} className="grid grid-cols-[auto_1fr] items-end gap-2 sm:grid-cols-[auto_180px_1fr_140px]">
                <span className="mb-3 text-xs font-bold">{c("tierN", { n })}</span>
                <div>
                  <label htmlFor={`pe-t${n}Basis`} className="mb-1 block text-xs" style={{ color: "var(--muted)" }}>{c("tierBasis")}</label>
                  <select id={`pe-t${n}Basis`} name={`t${n}Basis`} defaultValue={product[`t${n}Basis`]} className={inputCls} style={fieldStyle}>
                    <option value="">-</option>
                    {TIER_BASES.map((b) => <option key={b} value={b}>{c(`tierBasis_${b}`)}</option>)}
                  </select>
                  {err(`t${n}Basis`)}
                </div>
                <div>
                  <label htmlFor={`pe-t${n}Threshold`} className="mb-1 block text-xs" style={{ color: "var(--muted)" }}>{c("tierThreshold")}</label>
                  <input id={`pe-t${n}Threshold`} name={`t${n}Threshold`} dir="ltr" inputMode="decimal" defaultValue={product[`t${n}Threshold`]} className={`${inputCls} text-end`} style={fieldStyle} />
                  {err(`t${n}Threshold`)}
                </div>
                <div>
                  <label htmlFor={`pe-t${n}Discount`} className="mb-1 block text-xs" style={{ color: "var(--muted)" }}>{c("tierDiscount")}</label>
                  <div className="flex" dir="ltr" style={{ border: `1px solid ${HAIR}` }}>
                    <input id={`pe-t${n}Discount`} name={`t${n}Discount`} inputMode="decimal" defaultValue={product[`t${n}Discount`]} className={`${inputCls} text-end`} style={{ background: FIELD, border: 0, outline: "none" }} />
                    <span className="flex items-center px-3 text-xs font-bold" style={{ background: "white", borderInlineStart: `1px solid ${HAIR}` }}>%</span>
                  </div>
                  {err(`t${n}Discount`)}
                </div>
              </div>
            ))}
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {defaultTiers.length
                ? c("tiersDefault", { list: defaultTiers.map((d) => `${c(`tierBasis_${d.basis}`)} ≥ ${d.threshold.toLocaleString(locale)} : −${d.discount.toLocaleString(locale)} %`).join(" ; ") })
                : c("tiersNoDefault")}
            </p>
          </fieldset>
          <p className="text-xs" style={{ color: "var(--muted)" }}>{c("priceConfidential")}</p>
        </Block>

        <Block title={c("block4")} aside={c("block4Aside")}>
          <div>
            <Label htmlFor="pe-pack">{c("packaging")}</Label>
            <input id="pe-pack" name="packaging" maxLength={200} placeholder={c("packagingPlaceholder")} defaultValue={product.packaging} className={inputCls} style={fieldStyle} />
            {err("packaging")}
          </div>
          {/* Conditionnement en 4 niveaux : meme fiche que la feuille "Conditionnement" du fichier Excel. */}
          <div className="flex flex-col gap-4 pt-4" style={{ borderTop: `1px solid ${HAIR}` }}>
            <p className="text-[11px] font-bold uppercase" style={labelStyle}>{c("packLevelsTitle")}</p>
            {PACK_LEVELS.map((n) => (
              <fieldset key={n} className="grid grid-cols-2 gap-3 p-3 md:grid-cols-6" style={{ border: `1px solid ${HAIR}` }} data-pack-level={n}>
                <legend className="px-1 text-xs font-bold">{c(`packLevel_${n}`)}</legend>
                {([["Qty", "pkQty", "numeric"], ["Type", "pkType", ""], ["Weight", "pkWeight", "decimal"], ["Length", "pkLength", "numeric"], ["Width", "pkWidth", "numeric"], ["Height", "pkHeight", "numeric"]] as const).map(([part, key, mode]) => {
                  const name = `pk${n}${part}` as PackField;
                  return (
                    <div key={part}>
                      <label htmlFor={`pe-${name}`} className="mb-1 block text-xs" style={{ color: "var(--muted)" }}>{c(key)}</label>
                      {part === "Type" ? (
                        <select id={`pe-${name}`} name={name} defaultValue={product[name]} className={inputCls} style={fieldStyle}>
                          <option value="">-</option>
                          {PACK_TYPES.map((p) => <option key={p} value={p}>{c(`packType_${p}`)}</option>)}
                        </select>
                      ) : (
                        <input id={`pe-${name}`} name={name} dir="ltr" inputMode={mode || undefined} defaultValue={product[name]} className={`${inputCls} text-end`} style={fieldStyle} />
                      )}
                      {/* Dimensions en mm : equivalent en cm affiche pour eviter les confusions d'unite. */}
                      {["Length", "Width", "Height"].includes(part) && Number(liveValue(name)) > 0 && (
                        <span className="mt-1 block text-[11px]" style={{ color: "var(--muted)" }} dir="ltr">= {(Number(liveValue(name)) / 10).toLocaleString(locale)} cm</span>
                      )}
                      {err(name)}
                    </div>
                  );
                })}
              </fieldset>
            ))}
            <div className="grid gap-3 sm:grid-cols-3">
              {([["pkLabel", PACK_LABELS, "packLabel"], ["pkWedging", PACK_WEDGING, "packWedging"], ["pkProtection", PACK_PROTECTIONS, "packProtection"]] as const).map(([name, list, prefix]) => (
                <div key={name}>
                  <Label htmlFor={`pe-${name}`}>{c(`${prefix}Label`)}</Label>
                  <select id={`pe-${name}`} name={name} defaultValue={product[name]} className={inputCls} style={fieldStyle}>
                    <option value="">-</option>
                    {list.map((o) => <option key={o} value={o}>{c(`${prefix}_${o}`)}</option>)}
                  </select>
                  {err(name)}
                </div>
              ))}
            </div>
            <div>
              <Label htmlFor="pe-pkNotes">{c("packNotesLabel")}</Label>
              <textarea id="pe-pkNotes" name="pkNotes" rows={2} maxLength={1000} defaultValue={product.pkNotes} className={`${inputCls} resize-y`} style={fieldStyle} />
              {err("pkNotes")}
            </div>
          </div>
          {/* Conservation et gerbage : avec les 4 niveaux, ils donnent la capacite par conteneur (jamais saisie). */}
          <div className="flex flex-col gap-5 pt-4" style={{ borderTop: `1px solid ${HAIR}` }}>
            {/* Les 4 conditions visibles d'un coup d'oeil (une liste deroulante cachait les choix). */}
            <fieldset>
              <legend className={labelCls} style={labelStyle}>{c("storage")}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {STORAGE_CONDITIONS.map((s) => (
                  <label key={s} className="flex cursor-pointer items-start gap-2 p-3 text-sm" style={{ border: `1px solid ${HAIR}`, background: "white" }}>
                    <input type="radio" name="storage" value={s} defaultChecked={(product.storage || "ambient") === s} className="mt-0.5 h-4 w-4 shrink-0" style={{ accentColor: "var(--ink)" }} />
                    <span>
                      <span className="block font-semibold">{c(`storageName_${s}`)}</span>
                      <span className="block text-xs" style={{ color: "var(--muted)" }}>{c(`storageHint_${s}`)}</span>
                    </span>
                  </label>
                ))}
              </div>
              {err("storage")}
            </fieldset>
            <div className="sm:max-w-xs">
              <Label htmlFor="pe-stack">{c("maxStack")}</Label>
              <input id="pe-stack" name="maxStack" dir="ltr" inputMode="numeric" placeholder="5" defaultValue={product.maxStack} className={`${inputCls} text-end`} style={fieldStyle} />
              <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>{c("maxStackHelp")}</span>
              {err("maxStack")}
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {logistics.input.unitsPerCarton
                ? c("logisticsFromLevels", { units: logistics.input.unitsPerCarton.toLocaleString(locale), pallet: logistics.input.cartonsPerPallet ?? "-" })
                : c("logisticsNeedLevels")}
            </p>
            {logistics.warnings.length > 0 && (
              <ul className="flex flex-col gap-1 p-3 text-sm" style={{ background: "#fff7ed", border: "1px solid #f97316", color: "#9a3412" }} data-pack-warnings={logistics.warnings.length}>
                {logistics.warnings.map((w, i) => (
                  <li key={i}>⚠ {c(w.code, { level: w.level ?? 0, value: w.value ?? 0 })}</li>
                ))}
              </ul>
            )}

            <div className="p-4" style={{ background: "#fff2e2", border: `1px solid ${HAIR}` }} aria-live="polite">
              <p className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.08em" }}>{c("estimateTitle")}</span>
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>{c(est20?.reefer || est40?.reefer ? "estimateReefer" : "estimateDry")}</span>
              </p>
              {est20 || est40 ? (
                <div className="flex flex-col gap-3">
                  {/* Deux modes : palettes (si une palette est decrite) et cartons au sol, avec le taux de remplissage. */}
                  {(logistics.input.palletized ? (["pallet", "floor"] as const) : (["floor"] as const)).map((mode) => (
                    <div key={mode} data-load-mode={mode}>
                      <p className="mb-1 text-[11px] font-bold uppercase" style={labelStyle}>{c(`loadMode_${mode}`)}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(["20", "40"] as const).map((size) => {
                          const e = estimateContainer(logistics.input, size, mode);
                          return (
                            <div key={size} className="p-3" style={{ background: "white", border: `1px solid ${HAIR}` }} data-container={size} data-mode={mode}>
                              <p className="text-xs font-bold uppercase" style={labelStyle}>{c(`container_${size}`)}</p>
                              {e ? (
                                <>
                                  <p className="mt-1 font-extrabold" style={{ fontSize: "1.4rem", fontFeatureSettings: '"tnum" 1' }}>
                                    {e.units.toLocaleString(locale)} {unitShort}
                                  </p>
                                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                                    {c("estimateCartons", { count: e.cartons })} · {c(`limitedBy_${e.limitedBy}`)} · {c("fillRate", { rate: Math.round(e.fillRate * 100) })}
                                  </p>
                                </>
                              ) : (
                                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>-</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--muted)" }}>{c("estimateEmpty")}</p>
              )}
              <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>{c("estimateNote")}</p>
            </div>
          </div>
        </Block>

        <Block title={c("block5")} aside={c("block5Aside")}>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <Label htmlFor="pe-stock">{c("stockLabel")}</Label>
              <input id="pe-stock" name="stock" dir="ltr" inputMode="decimal" defaultValue={product.stock} className={inputCls} style={fieldStyle} />
              <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>
                {product.stockUpdatedAt ? c("stockUpdatedAt", { date: new Date(product.stockUpdatedAt).toLocaleDateString(locale, { dateStyle: "medium" }) }) : c("stockHelp")}
              </span>
              {err("stock")}
            </div>
            <div>
              <Label htmlFor="pe-lead">{c("leadDaysLabel")}</Label>
              <input id="pe-lead" name="leadDays" dir="ltr" inputMode="numeric" placeholder="30" defaultValue={product.leadDays} className={`${inputCls} text-end`} style={fieldStyle} />
              {err("leadDays")}
            </div>
            <div>
              <span id="pe-origin-label" className={labelCls} style={labelStyle}>{c("originLabel")}</span>
              <CountrySelect id="pe-origin" name="originCountry" labelId="pe-origin-label" defaultValue={(product.originCountry || "DZ") as CountryCode} placeholder={t("choose")} fieldStyle={fieldStyle} />
              {err("originCountry")}
            </div>
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
