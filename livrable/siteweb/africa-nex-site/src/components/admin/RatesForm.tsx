"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveFxRates, type RatesState } from "@/app/[locale]/(app)/admin/settings/actions";
import { TextInput } from "@/components/auth/fields";

const caps = { letterSpacing: "0.08em" } as const;

// Taux de reference AFRICA NEX : 1 EUR = x DZD, 1 USD = y DZD.
export function RatesForm({ defaults, updated }: { defaults: { EUR: string; USD: string }; updated: { EUR: string | null; USD: string | null } }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [state, action, pending] = useActionState<RatesState, FormData>(saveFxRates, { errors: {} });
  const v = { ...defaults, ...(state.values ?? {}) };
  return (
    <form key={state.attempt ?? 0} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-4 sm:grid-cols-2">
        {(["EUR", "USD"] as const).map((c) => (
          <label key={c} className="flex flex-col gap-1" htmlFor={`rate-${c}`}>
            <span className="text-xs font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("settingsRateLabel", { currency: c })}</span>
            <div className="flex items-center gap-2" dir="ltr">
              <span className="shrink-0 whitespace-nowrap text-sm font-bold">1 {c} =</span>
              <TextInput id={`rate-${c}`} name={c} inputMode="decimal" defaultValue={v[c]} placeholder={c === "EUR" ? "150,00" : "135,00"} />
              <span className="text-sm font-bold">DZD</span>
            </div>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{updated[c] ? t("settingsRateUpdated", { date: updated[c]! }) : t("settingsRateNever")}</span>
            {state.errors[c] && <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{t(state.errors[c]!)}</span>}
          </label>
        ))}
      </div>
      <button type="submit" disabled={pending} className="w-fit px-6 py-3 text-xs font-bold uppercase disabled:opacity-60" style={{ ...caps, background: "var(--ink)", color: "white" }}>
        {t("settingsRatesSave")}
      </button>
    </form>
  );
}
