"use client";

import { useActionState, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { dispatchRfq, type DispatchField, type DispatchState } from "@/app/[locale]/(app)/admin/rfqs/actions";
import { Alert, Field, TextInput } from "@/components/auth/fields";
import { UNITS } from "@/lib/onboarding/reference";

export type DispatchProducer = { id: string; name: string; place: string; sector: string; claimed: boolean; online: boolean; sent: boolean };
export type DispatchDefaults = { briefTitle: string; briefSpecs: string; quantity: string; unit: string; country: string; incoterm: string; neededBy: string; respondBy: string };

const HAIR = "#d8cebb";
const box = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;
const INCOTERMS = ["FOB", "FCA", "EXW", "CFR", "CIF", "DAP"] as const;

// Brief anonymise et choix des producteurs (lot 5b). Le serveur refuse un brief qui identifie l'acheteur.
export function DispatchForm({ rfqId, defaults, producers, preselected }: { rfqId: string; defaults: DispatchDefaults; producers: DispatchProducer[]; preselected: string[] }) {
  const t = useTranslations("admin");
  const o = useTranslations("onboarding");
  const locale = useLocale();
  const [state, action, pending] = useActionState<DispatchState, FormData>(dispatchRfq, { errors: {} });
  const v = { ...defaults, ...(state.values ?? {}) };
  const [selected, setSelected] = useState<Set<string>>(new Set(state.companies ?? preselected.filter((id) => !producers.find((p) => p.id === id)?.sent)));
  const [query, setQuery] = useState("");
  const err = (f: DispatchField) => (state.errors[f] ? <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t(state.errors[f]!)}</span> : null);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return producers.filter((p) => !q || `${p.name} ${p.place} ${p.sector}`.toLowerCase().includes(q));
  }, [producers, query]);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <form key={state.attempt ?? 0} action={action} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={rfqId} />
      {state.formError && <Alert tone="error">{t(state.formError)}</Alert>}
      <p className="p-3 text-sm" style={{ background: "#fff7ed", borderInlineStart: "4px solid #f97316" }}>{t("rfqBriefWarning")}</p>

      <Field label={t("rfqBriefTitle")} htmlFor="d-title">
        <TextInput id="d-title" name="briefTitle" required maxLength={200} defaultValue={v.briefTitle} />
        {err("briefTitle")}
      </Field>
      <Field label={t("rfqBriefSpecs")} hint={t("rfqBriefSpecsHint")} htmlFor="d-specs">
        <textarea id="d-specs" name="briefSpecs" rows={6} maxLength={5000} defaultValue={v.briefSpecs} className="w-full resize-y px-4 py-3 text-sm" style={box} />
        {err("briefSpecs")}
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("rfqBriefQuantity")} hint={o("optional")} htmlFor="d-qty">
          <TextInput id="d-qty" name="quantity" inputMode="decimal" dir="ltr" defaultValue={v.quantity} />
          {err("quantity")}
        </Field>
        <Field label={o("unit")} htmlFor="d-unit">
          <select id="d-unit" name="unit" defaultValue={v.unit} className="w-full px-4 py-3 text-sm" style={box}>
            <option value="">-</option>
            {UNITS.map((u) => <option key={u} value={u}>{o(`unit_${u}`)}</option>)}
          </select>
          {err("unit")}
        </Field>
        <Field label={t("rfqBriefIncoterm")} htmlFor="d-inco">
          <select id="d-inco" name="incoterm" defaultValue={v.incoterm} className="w-full px-4 py-3 text-sm" style={box}>
            <option value="">-</option>
            {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          {err("incoterm")}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("rfqBriefCountry")} hint={t("rfqBriefCountryHint")} htmlFor="d-country">
          <TextInput id="d-country" name="country" maxLength={2} dir="ltr" defaultValue={v.country} placeholder="CI" />
          {err("country")}
        </Field>
        <Field label={t("rfqBriefNeededBy")} hint={o("optional")} htmlFor="d-needed">
          <TextInput id="d-needed" name="neededBy" type="date" dir="ltr" defaultValue={v.neededBy} />
          {err("neededBy")}
        </Field>
        <Field label={t("rfqBriefRespondBy")} htmlFor="d-respond">
          <TextInput id="d-respond" name="respondBy" type="date" required dir="ltr" defaultValue={v.respondBy} />
          {err("respondBy")}
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("rfqProducersPick", { count: selected.size })}</legend>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("rfqProducersSearch")} className="w-full px-4 py-2.5 text-sm" style={box} />
        <ul className="flex max-h-80 flex-col overflow-y-auto" style={{ border: `1px solid ${HAIR}` }}>
          {shown.map((p) => (
            <li key={p.id} style={{ borderBottom: `1px solid ${HAIR}` }}>
              <label className={`flex items-start gap-3 px-3 py-2.5 text-sm ${p.sent ? "opacity-60" : "cursor-pointer"}`}>
                <input type="checkbox" name="companies" value={p.id} disabled={p.sent} checked={p.sent || selected.has(p.id)} onChange={() => toggle(p.id)} className="mt-1" />
                <span className="min-w-0">
                  <span className="block font-semibold">{p.name}{p.sent && <span className="ms-2 text-xs font-bold" style={{ color: "#059669" }}>{t("rfqAlreadySent")}</span>}</span>
                  <span className="block text-xs" style={{ color: "var(--muted)" }}>{[p.place, p.sector].filter(Boolean).join(" · ")}</span>
                  {!p.claimed && <span className="block text-xs font-semibold" style={{ color: "#c2410c" }}>{t("rfqOffline")}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {err("companies")}
      </fieldset>

      <button type="submit" disabled={pending || selected.size === 0} className="w-fit px-8 py-3 text-sm font-bold uppercase disabled:opacity-50" style={{ background: "#10b981", color: "white", letterSpacing: "0.08em" }}>
        {pending ? t("rfqSending") : t("rfqSend", { count: selected.size })}
      </button>
    </form>
  );
}
