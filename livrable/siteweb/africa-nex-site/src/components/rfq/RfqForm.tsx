"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CountryCode } from "libphonenumber-js";
import { createRfq, type RfqField, type RfqState } from "@/app/[locale]/(app)/rfq/actions";
import { Alert, Field, TextInput } from "@/components/auth/fields";
import { CountrySelect } from "@/components/country/CountrySelect";
import { prepareUpload } from "@/lib/client/prepare-upload";
import { CURRENCIES, UNITS } from "@/lib/onboarding/reference";
import { estimateContainer, type LogisticsInput } from "@/lib/logistics/container";
import { LOGISTICS, incotermsFor, type Logistics } from "@/lib/incoterms";

const MAX_FILE = 4 * 1024 * 1024;
const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const box = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;

export type RfqFormContext = {
  productId: string | null;
  productName: string | null;
  unit: string | null;
  moq: number | null;
  companyName: string | null;
  producerSlug: string | null;
  logistics: LogisticsInput | null;
};

const MAX_LINES = 50;
type Line = { key: number; desc: string; ref: string; qty: string; unit: string };
let lineKey = 0;
const newLine = (): Line => ({ key: ++lineKey, desc: "", ref: "", qty: "", unit: "" });
function parseLines(raw: string | undefined): Line[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as { desc: string; ref: string; qty: string; unit: string }[];
    return arr.map((l) => ({ ...newLine(), ...l }));
  } catch {
    return [];
  }
}

function Section({ n, title, tag, children }: { n: number; title: string; tag?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
      <div className="flex items-center justify-between gap-3 pb-3" style={{ borderBottom: `1px solid ${HAIR}` }}>
        <h2 className="text-xs font-bold uppercase" style={caps}>{n}. {title}</h2>
        {tag && <span className="px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "#f5efe6", border: `1px solid ${HAIR}`, color: "var(--muted)" }}>{tag}</span>}
      </div>
      {children}
    </section>
  );
}

export function RfqForm({ context }: { context: RfqFormContext | null }) {
  const t = useTranslations("rfq");
  const o = useTranslations("onboarding");
  const locale = useLocale();
  const [state, action, pending] = useActionState<RfqState, FormData>(createRfq, { errors: {} });
  const v = state.values ?? {};
  const [mode, setMode] = useState<"units" | "containers">(v.mode === "containers" ? "containers" : "units");
  // Transport : choix de l'acheteur des le depart ; les incoterms proposes en dependent.
  const [logistics, setLogistics] = useState<Logistics | null>((LOGISTICS as readonly string[]).includes(v.logistics ?? "") ? (v.logistics as Logistics) : null);
  const [size, setSize] = useState<"20" | "40">(v.containerSize === "40" ? "40" : "20");
  const [count, setCount] = useState(v.containerCount || "1");
  const [file, setFile] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  // Lignes de la demande : saisie renvoyee apres une erreur, sinon le produit choisi en 1re ligne.
  const [lines, setLines] = useState<Line[]>(() => {
    const back = parseLines(v.lines);
    if (back.length) return back;
    return [{ ...newLine(), desc: context?.productName ?? "", unit: context?.unit ?? "" }];
  });
  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const err = (f: RfqField) => (state.errors[f] ? <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t(state.errors[f]!)}</span> : null);

  // Estimation depuis la fiche carton du produit (si le producteur l'a remplie).
  const estimate = context?.logistics ? estimateContainer(context.logistics, size) : null;
  const n = Number(count) || 0;
  const unitLabel = context?.unit ? o(`unit_${context.unit}`) : "";

  return (
    <form key={state.attempt ?? 0} action={action} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="productId" value={context?.productId ?? ""} />
      <input type="hidden" name="producer" value={context?.producerSlug ?? ""} />
      <input type="hidden" name="mode" value={mode} />
      {state.formError && <Alert tone="error">{t(state.formError)}</Alert>}

      {context?.companyName && (
        <section className="flex flex-wrap items-start justify-between gap-3 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{context.productName ? t("selectedProduct") : t("selectedProducer")}</p>
            {context.productName && <p className="mt-1 font-extrabold" style={{ fontSize: "1.1rem" }}>{context.productName}</p>}
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{t("producerLabel")} <strong style={{ color: "var(--ink)" }}>{context.companyName}</strong></p>
          </div>
          <a href={`/${locale}/producers`} className="px-3 py-2 text-[11px] font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)" }}>{t("change")}</a>
        </section>
      )}

      {/* Produits demandes : une ligne par produit (50 au plus). La 1re ligne garde les champs
          historiques (rfq-title, rfq-qty, rfq-unit) : liens "Demander un devis" et tests inchanges. */}
      <Section n={1} title={t("sectionLines")} tag={t("linesCount", { count: lines.length })}>
        <p className="text-xs" style={{ color: "var(--muted)" }}>{t("linesHelp")}</p>
        <ol className="flex flex-col gap-3">
          {lines.map((line, i) => {
            const le = state.lineErrors?.[i] ?? {};
            const lerr = (f: string) => (le[f] ? <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t(le[f])}</span> : null);
            const id = (base: string) => (i === 0 ? base : `${base}-${i + 1}`);
            return (
              <li key={line.key} className="flex flex-col gap-3 p-3" style={{ border: `1px solid ${HAIR}` }} data-line={i + 1}>
                <div className="flex items-start gap-3">
                <span className="mt-6 flex h-8 w-8 shrink-0 items-center justify-center text-xs font-bold" style={{ background: "var(--ink)", color: "white" }}>{i + 1}</span>
                <label className="flex min-w-0 flex-1 flex-col gap-1" htmlFor={id("rfq-title")}>
                  <span className="text-[11px] font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("lineDescription")}</span>
                  <TextInput id={id("rfq-title")} name="lineDesc" required maxLength={300} value={line.desc} onChange={(e) => update(i, { desc: e.target.value })} placeholder={i === 0 ? t("titlePlaceholder") : ""} />
                  {lerr("description")}
                </label>
                {lines.length > 1 && (
                  <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="mt-6 shrink-0 px-3 py-3 text-[11px] font-bold uppercase" style={{ ...caps, border: "1px solid #dc2626", color: "#dc2626", background: "white" }} aria-label={t("lineRemove", { n: i + 1 })}>
                    {t("lineRemoveShort")}
                  </button>
                )}
                </div>
                <div className="grid gap-3 sm:grid-cols-3 sm:ps-11">
                <label className="flex flex-col gap-1" htmlFor={id("rfq-ref")}>
                  <span className="text-[11px] font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("lineReference")}</span>
                  <TextInput id={id("rfq-ref")} name="lineRef" maxLength={60} dir="ltr" value={line.ref} onChange={(e) => update(i, { ref: e.target.value })} placeholder={t("lineReferencePlaceholder")} />
                  {lerr("reference")}
                </label>
                <label className="flex flex-col gap-1" htmlFor={id("rfq-qty")}>
                  <span className="text-[11px] font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("quantity")}{mode === "containers" ? ` (${o("optional")})` : ""}</span>
                  <TextInput id={id("rfq-qty")} name="lineQty" required={mode === "units"} inputMode="decimal" dir="ltr" value={line.qty} onChange={(e) => update(i, { qty: e.target.value })} placeholder="2000" />
                  {lerr("quantity")}
                </label>
                <label className="flex flex-col gap-1" htmlFor={id("rfq-unit")}>
                  <span className="text-[11px] font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("unit")}</span>
                  <select id={id("rfq-unit")} name="lineUnit" required={mode === "units"} value={line.unit} onChange={(e) => update(i, { unit: e.target.value })} className="w-full px-3 py-3 text-sm" style={box}>
                    <option value="">{o("choose")}</option>
                    {UNITS.map((u) => <option key={u} value={u}>{o(`unit_${u}`)}</option>)}
                  </select>
                  {lerr("unit")}
                </label>
                </div>
              </li>
            );
          })}
        </ol>
        {lines.length < MAX_LINES && (
          <button type="button" onClick={() => setLines((ls) => [...ls, newLine()])} className="w-fit px-4 py-2.5 text-xs font-bold uppercase" style={{ ...caps, border: "1px dashed var(--ink)", background: "white" }}>
            + {t("lineAdd")}
          </button>
        )}
        {err("title")}
      </Section>

      <Section n={2} title={t("sectionQuantity")}>
        <div className="grid grid-cols-2" role="radiogroup" aria-label={t("sectionQuantity")}>
          {(["units", "containers"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className="px-3 py-3 text-xs font-bold uppercase" style={{ ...caps, background: mode === m ? "var(--ink)" : "white", color: mode === m ? "white" : "var(--ink)", border: `1px solid ${mode === m ? "var(--ink)" : HAIR}` }}>
              {t(`mode_${m}`)}
            </button>
          ))}
        </div>
        {mode === "units" ? (
          <p className="text-xs" style={{ color: "var(--muted)" }}>{t("unitsPerLine")}</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
              <Field label={t("containerCount")} htmlFor="rfq-count">
                <TextInput id="rfq-count" name="containerCount" required inputMode="numeric" dir="ltr" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 3))} />
                {err("containerCount")}
              </Field>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-xs font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("containerSize")}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["20", "40"] as const).map((s) => (
                    <label key={s} className="flex cursor-pointer items-center gap-2 px-3 py-3 text-sm font-semibold" style={{ border: `1px solid ${size === s ? "var(--ink)" : HAIR}`, background: size === s ? "#f5efe6" : "white" }}>
                      <input type="radio" name="containerSize" value={s} checked={size === s} onChange={() => setSize(s)} />
                      {t(`size_${s}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <label className="flex items-start gap-3 p-3 text-sm" style={{ border: `1px solid ${HAIR}` }}>
              <input type="checkbox" name="reefer" defaultChecked={v.reefer === "on" || Boolean(context?.logistics?.storage && context.logistics.storage !== "ambient")} className="mt-1" />
              <span><span className="block font-semibold">{t("reefer")}</span><span className="block text-xs" style={{ color: "var(--muted)" }}>{t("reeferHelp")}</span></span>
            </label>
            {estimate ? (
              <p className="p-3 text-sm" style={{ background: "#ecfdf5", border: "1px solid #10b981" }}>
                {t("estimate", { perContainer: estimate.units.toLocaleString(locale), unit: unitLabel, total: (estimate.units * n).toLocaleString(locale) })}
              </p>
            ) : (
              <p className="text-xs" style={{ color: "var(--muted)" }}>{t("estimateUnknown")}</p>
            )}
          </>
        )}
        {context?.moq != null && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>{t("moqHint", { moq: context.moq.toLocaleString(locale), unit: unitLabel })}</p>
        )}
      </Section>

      <Section n={3} title={t("sectionDestination")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span id="rfq-country-label" className="text-xs font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("country")}</span>
            <CountrySelect id="rfq-country" name="country" labelId="rfq-country-label" defaultValue={(v.country as CountryCode) || null} placeholder={o("countryPlaceholder")} />
            {err("country")}
          </div>
          <Field label={t("port")} hint={o("optional")} htmlFor="rfq-port">
            <TextInput id="rfq-port" name="port" maxLength={120} defaultValue={v.port ?? ""} placeholder={t("portPlaceholder")} />
            {err("port")}
          </Field>
        </div>
      </Section>

      <Section n={4} title={t("sectionIncoterm")} tag="ICC 2020">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("logisticsQuestion")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {LOGISTICS.map((l) => (
              <label key={l} className="flex cursor-pointer items-start gap-3 p-4" style={{ border: `${logistics === l ? 2 : 1}px solid ${logistics === l ? "#10b981" : HAIR}`, background: logistics === l ? "#ecfdf5" : "white" }}>
                <input type="radio" name="logistics" value={l} required checked={logistics === l} onChange={() => setLogistics(l)} className="mt-1" />
                <span>
                  <span className="block font-extrabold">{t(`logistics_${l}_name`)}</span>
                  <span className="block text-sm" style={{ color: "var(--muted)" }}>{t(`logistics_${l}_desc`)}</span>
                </span>
              </label>
            ))}
          </div>
          {err("logistics")}
        </fieldset>
        {logistics ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("incotermQuestion")}</legend>
            <div key={logistics} className="grid gap-2 sm:grid-cols-2">
              {incotermsFor(logistics).map((i) => (
                <label key={i} className="flex cursor-pointer items-start gap-3 p-4" style={{ border: `1px solid ${HAIR}` }}>
                  <input type="radio" name="incoterm" value={i} required defaultChecked={v.incoterm === i} className="mt-1" />
                  <span>
                    <span className="block font-extrabold">{i} <span className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t(`incoterm_${i}_name`)}</span></span>
                    <span className="block text-sm" style={{ color: "var(--muted)" }}>{t(`incoterm_${i}_desc`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("logisticsFirst")}</p>
        )}
        {err("incoterm")}
        <p className="text-xs" style={{ color: "var(--muted)" }}>{t("incotermHelp")}</p>
      </Section>

      {/* Devise de l'offre : choix obligatoire de l'acheteur, aucune devise par defaut. */}
      <Section n={5} title={t("sectionCurrency")}>
        <div className="sm:max-w-xs">
          <Field label={t("currency")} hint={t("currencyHint")} htmlFor="rfq-currency">
            <select id="rfq-currency" name="currency" required defaultValue={v.currency ?? ""} className="w-full px-4 py-3 text-sm" style={box}>
              <option value="" disabled>{o("choose")}</option>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {err("currency")}
          </Field>
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>{t("currencyHelp")}</p>
      </Section>

      <Section n={6} title={t("sectionSchedule")}>
        <Field label={t("neededBy")} hint={o("optional")} htmlFor="rfq-date">
          <TextInput id="rfq-date" name="neededBy" type="date" dir="ltr" defaultValue={v.neededBy ?? ""} />
          {err("neededBy")}
        </Field>
      </Section>

      <Section n={7} title={t("sectionRequirements")} tag={o("optional")}>
        <Field label={t("description")} htmlFor="rfq-desc">
          <textarea id="rfq-desc" name="description" rows={4} maxLength={5000} defaultValue={v.description ?? ""} placeholder={t("descriptionPlaceholder")} className="w-full resize-y px-4 py-3 text-sm" style={box} />
          {err("description")}
        </Field>
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer flex-col items-center gap-1 p-5 text-center" style={{ border: `1px dashed ${HAIR}`, background: "#fff8f3" }}>
            <span className="text-sm font-bold">{t("file")}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{t("fileHelp")}</span>
            <input
              type="file"
              name="file"
              accept="application/pdf,image/jpeg,image/png"
              className="sr-only"
              onChange={async (e) => {
                const input = e.currentTarget;
                setFileError(null);
                setPreparing(true);
                const original = input.files?.[0];
                const result = await prepareUpload(input, { maxBytes: MAX_FILE, allowPdf: true });
                setPreparing(false);
                if (!result.ok) { setFile(null); setFileError(result.reason === "tooBig" ? "errorFileSize" : "errorFileType"); return; }
                setFile(result.file && original ? original.name : null);
              }}
            />
          </label>
          {preparing && <span className="text-sm" style={{ color: "var(--muted)" }}>{t("preparing")}</span>}
          {file && !preparing && <span className="text-sm font-semibold">{file}</span>}
          {fileError ? <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t(fileError)}</span> : err("file")}
        </div>
      </Section>

      <p className="p-4 text-sm" style={{ background: "#fff8f3", border: `1px solid ${HAIR}` }}>{t("privacyNote")}</p>
      <button type="submit" disabled={pending || preparing} className="w-full py-4 text-sm font-bold uppercase disabled:opacity-60 sm:w-auto sm:self-end sm:px-10" style={{ background: "#047857", color: "white", ...caps }}>
        {pending ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
