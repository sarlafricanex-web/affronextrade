"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MONTHLY_PRICE, PLANS, PLAN_FEATURES, ZONES, type Zone } from "@/config/pricing";

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

// Semaine 6 : forfaits producteurs (maquette 19), onglet par zone et devise. Aucun paiement en
// ligne : chaque forfait se termine par "Nous contacter".
export function PricingPlans() {
  const t = useTranslations("pricing");
  const locale = useLocale();
  const [zone, setZone] = useState<Zone>("dz");
  const currency = ZONES.find((z) => z.key === zone)!.currency;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("zonesLabel")}>
        {ZONES.map((z) => (
          <button
            key={z.key}
            type="button"
            role="tab"
            aria-selected={zone === z.key}
            onClick={() => setZone(z.key)}
            className="px-4 py-2.5 text-sm font-bold"
            style={{ background: zone === z.key ? "white" : "transparent", border: zone === z.key ? "2px solid var(--ink)" : `1px solid ${HAIR}` }}
            data-zone={z.key}
          >
            {t(`zone_${z.key}`)}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const price = MONTHLY_PRICE[plan][currency];
          const featured = plan === "pro";
          return (
            <article
              key={plan}
              className="relative flex flex-col"
              style={{ background: "white", border: featured ? "2px solid #10b981" : `1px solid ${HAIR}` }}
              data-plan={plan}
            >
              {featured && (
                <span className="absolute -top-3 start-6 px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "#047857", color: "white" }}>{t("featured")}</span>
              )}
              <div className="flex flex-col gap-2 p-6">
                <span className="text-[10px] font-bold uppercase" style={{ ...caps, color: featured ? "#065f46" : "var(--muted)" }}>{t(`kicker_${plan}`)}</span>
                <h2 className="font-extrabold uppercase" style={{ fontSize: "1.6rem" }}>{t(`plan_${plan}`)}</h2>
                <p className="text-sm" style={{ color: "var(--muted)" }}>{t(`pitch_${plan}`)}</p>
              </div>
              <div className="mx-6 p-4" style={{ background: "#fff8f3", borderTop: `1px solid ${HAIR}` }} data-price={price ?? "quote"}>
                {price === null ? (
                  <p className="font-extrabold" style={{ fontSize: "1.8rem", lineHeight: 1.1 }}>{t("onQuote")}</p>
                ) : (
                  <p dir="ltr" style={{ textAlign: "start" }}>
                    <span className="font-extrabold" style={{ fontSize: "2.2rem", lineHeight: 1, fontFeatureSettings: '"tnum" 1' }}>{price.toLocaleString(locale)}</span>{" "}
                    <span className="text-sm font-bold">{currency}</span>
                  </p>
                )}
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{price === null ? t("onQuoteNote") : t("perMonth")}</p>
              </div>
              <ul className="flex flex-1 flex-col gap-2 p-6 text-sm">
                {PLAN_FEATURES[plan].map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0" style={{ background: f.startsWith("featureAll") ? "transparent" : "#0f172a", border: f.startsWith("featureAll") ? "none" : undefined }} />
                    <span className={f.startsWith("featureAll") ? "text-xs font-bold uppercase" : ""} style={f.startsWith("featureAll") ? { ...caps, color: "#065f46" } : undefined}>{t(f)}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-2">
                  <span className="flex gap-2"><span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0" style={{ background: "#0f172a" }} />{t("featureTranslation")}</span>
                  <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "#f5efe6", border: `1px solid ${HAIR}` }}>{t("soon")}</span>
                </li>
              </ul>
              <div className="p-6 pt-0">
                <Link href="/contact" className="block px-4 py-3 text-center text-xs font-bold uppercase" style={{ ...caps, ...(featured ? { background: "#047857", color: "white" } : { border: "1px solid var(--ink)" }) }}>
                  {t("contactCta")}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
