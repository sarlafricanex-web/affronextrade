import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getFxRates, listSupplierModes } from "@/lib/data/settings";
import { WILAYAS } from "@/lib/onboarding/reference";
import { RatesForm } from "@/components/admin/RatesForm";
import { saveSupplierModes } from "./actions";

export const instant = false;

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;
const box = { background: "var(--field-a)", border: "1px solid var(--field-b)", outline: "none" } as const;

// Reglages AFRICA NEX : taux de reference (offres en devise) et mode d'affaire de chaque fournisseur.
export default async function AdminSettingsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ saved?: string; count?: string; refused?: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);
  const [t, format, rates, suppliers, { saved, count, refused }] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getFormatter({ locale }),
    getFxRates(user.supabase),
    listSupplierModes(user.supabase),
    searchParams,
  ]);
  const str = (n: number | undefined) => (n === undefined ? "" : n.toLocaleString("fr-FR", { maximumFractionDigits: 4, useGrouping: false }));
  const when = (d: string | undefined) => (d ? format.dateTime(new Date(d), { dateStyle: "long", timeStyle: "short" }) : null);
  const undefinedCount = suppliers.filter((s) => !s.export_mode).length;

  return (
    <div className="flex flex-col gap-6">
      {saved && (
        <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #10b981" }}>
          {saved === "rates" ? t("settingsSavedRates") : t("settingsSavedModes", { count: Number(count) || 0 })}
        </p>
      )}
      {saved === "modes" && Number(refused) > 0 && (
        <p role="alert" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #c2410c" }}>{t("settingsModesRefused", { count: Number(refused) })}</p>
      )}
      <header>
        <p className="text-xs font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("accountsEyebrow")}</p>
        <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("settingsTitle")}</h1>
        <p className="mt-3" style={{ color: "var(--muted)" }}>{t("settingsIntro")}</p>
      </header>

      <section className="flex flex-col gap-4 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }} aria-labelledby="rates-title" data-settings="rates">
        <h2 id="rates-title" className="font-extrabold" style={{ fontSize: "1.2rem" }}>{t("settingsRatesTitle")}</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>{t("settingsRatesHelp")}</p>
        <RatesForm
          defaults={{ EUR: str(rates.EUR?.dzd_per_unit), USD: str(rates.USD?.dzd_per_unit) }}
          updated={{ EUR: when(rates.EUR?.updated_at), USD: when(rates.USD?.updated_at) }}
        />
      </section>

      <section className="flex flex-col gap-4 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }} aria-labelledby="modes-title" data-settings="modes">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="modes-title" className="font-extrabold" style={{ fontSize: "1.2rem" }}>{t("settingsModesTitle")}</h2>
          {undefinedCount > 0 && <span className="text-xs font-bold uppercase" style={{ ...caps, color: "#c2410c" }}>{t("settingsModesUndefined", { count: undefinedCount })}</span>}
        </div>
        <p className="text-sm" style={{ color: "var(--muted)" }}>{t("settingsModesHelp")}</p>
        <form action={saveSupplierModes} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          <ul className="flex flex-col">
            {suppliers.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderTop: `1px solid ${HAIR}` }} data-supplier={s.company_name}>
                <span className="min-w-0">
                  <span className="block font-semibold">{s.company_name}</span>
                  <span className="block text-xs" style={{ color: "var(--muted)" }}>
                    {[s.city, WILAYAS.find(([c]) => c === s.wilaya)?.[1]].filter(Boolean).join(", ")}
                    {!s.owner_profile_id ? ` · ${t("rfqOffline")}` : ""}
                  </span>
                  <span className="mt-1 inline-block px-2 py-0.5 text-[10px] font-bold uppercase" data-consent={s.africanex_export_consent ? "yes" : "no"} style={{ ...caps, ...(s.africanex_export_consent ? { background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46" } : { background: "#f5efe6", border: `1px solid ${HAIR}`, color: "var(--muted)" }) }}>
                    {t(s.africanex_export_consent ? "settingsConsentYes" : "settingsConsentNo")}
                  </span>
                </span>
                <input type="hidden" name={`was_${s.id}`} value={s.export_mode ?? ""} />
                <select name={`mode_${s.id}`} defaultValue={s.export_mode ?? ""} aria-label={t("settingsModeFor", { name: s.company_name })} className="w-full px-3 py-2.5 text-sm sm:w-72" style={box}>
                  <option value="">{t("settingsMode_unset")}</option>
                  <option value="self">{t("settingsMode_self")}</option>
                  <option value="africanex" disabled={!s.africanex_export_consent && s.export_mode !== "africanex"}>{t("settingsMode_africanex")}</option>
                </select>
              </li>
            ))}
          </ul>
          <button type="submit" className="w-fit px-6 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "var(--ink)", color: "white" }}>{t("settingsModesSave")}</button>
        </form>
      </section>
    </div>
  );
}
