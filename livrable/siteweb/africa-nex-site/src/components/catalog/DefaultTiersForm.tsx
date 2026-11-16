"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveDefaultTiers, type TiersState } from "@/app/[locale]/(app)/catalog/actions";
import { TIER_BASES, TIER_SLOTS, type TierField } from "@/lib/catalog/price-list";

const HAIR = "#d8cebb";
const box = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;

// Grille de remise par defaut du fournisseur : marge de negociation confidentielle (AFRICA NEX seule).
export function DefaultTiersForm({ defaults }: { defaults: Record<TierField, string> }) {
  const c = useTranslations("catalog");
  const o = useTranslations("onboarding");
  const locale = useLocale();
  const [state, action, pending] = useActionState<TiersState, FormData>(saveDefaultTiers, { errors: {} });
  const v = { ...defaults, ...(state.values ?? {}) } as Record<TierField, string>;
  const err = (f: TierField) => (state.errors[f] ? <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{c.has(state.errors[f]!) ? c(state.errors[f]!) : o(state.errors[f]!)}</span> : null);
  return (
    <form key={state.attempt ?? 0} action={action} className="flex flex-col gap-3" data-default-tiers="">
      <input type="hidden" name="locale" value={locale} />
      {TIER_SLOTS.map((n) => (
        <div key={n} className="grid grid-cols-[auto_1fr] items-end gap-2 sm:grid-cols-[auto_200px_1fr_140px]" style={{ borderTop: n > 1 ? `1px solid ${HAIR}` : undefined, paddingTop: n > 1 ? 8 : 0 }}>
          <span className="mb-3 text-xs font-bold">{c("tierN", { n })}</span>
          <label className="flex flex-col gap-1" htmlFor={`dt-t${n}Basis`}>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{c("tierBasis")}</span>
            <select id={`dt-t${n}Basis`} name={`t${n}Basis`} defaultValue={v[`t${n}Basis`]} className="w-full px-3 py-3 text-sm" style={box}>
              <option value="">-</option>
              {TIER_BASES.map((b) => <option key={b} value={b}>{c(`tierBasis_${b}`)}</option>)}
            </select>
            {err(`t${n}Basis`)}
          </label>
          <label className="flex flex-col gap-1" htmlFor={`dt-t${n}Threshold`}>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{c("tierThreshold")}</span>
            <input id={`dt-t${n}Threshold`} name={`t${n}Threshold`} dir="ltr" inputMode="decimal" defaultValue={v[`t${n}Threshold`]} className="w-full px-3 py-3 text-end text-sm" style={box} />
            {err(`t${n}Threshold`)}
          </label>
          <label className="flex flex-col gap-1" htmlFor={`dt-t${n}Discount`}>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{c("tierDiscount")}</span>
            <input id={`dt-t${n}Discount`} name={`t${n}Discount`} dir="ltr" inputMode="decimal" defaultValue={v[`t${n}Discount`]} className="w-full px-3 py-3 text-end text-sm" style={box} />
            {err(`t${n}Discount`)}
          </label>
        </div>
      ))}
      <button type="submit" disabled={pending} className="w-fit px-5 py-3 text-xs font-bold uppercase disabled:opacity-60" style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}>
        {c("tiersSave")}
      </button>
    </form>
  );
}
