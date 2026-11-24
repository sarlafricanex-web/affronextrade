import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PLANS, PLAN_CTA, PLAN_ITEMS, isPlan } from "@/config/pricing";
import type { PlanGrid } from "@/lib/data/plans";

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

// Offres du 24 novembre 2026 : Passeport (gratuit), Agent Export, Ambassadeur. Prix lus en base, en
// dinars HT. Chaque point de l'Agent Export et de l'Ambassadeur part d'un probleme d'exportateur ;
// les services pas encore construits sont marques « Bientôt ».
export async function PricingPlans({ grid, locale }: { grid: PlanGrid; locale: string }) {
  const t = await getTranslations({ locale, namespace: "pricing" });
  const nf = (n: number) => n.toLocaleString(locale);
  const discount = Math.round(grid.annualDiscount * 100);
  const plans = PLANS.map((code) => grid.plans.find((p) => p.code === code)).filter((p) => p && isPlan(p.code));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {plans.map((plan) => {
        const code = plan!.code as (typeof PLANS)[number];
        const featured = code === "agent_export";
        const free = plan!.monthly === 0;
        return (
          <article
            key={code}
            className="relative flex flex-col"
            style={{ background: "white", border: featured ? "2px solid #10b981" : `1px solid ${HAIR}` }}
            data-plan={code}
          >
            {featured && (
              <span className="absolute -top-3 start-6 px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "#047857", color: "white" }}>{t("featured")}</span>
            )}
            <div className="flex flex-col gap-2 p-6">
              <span className="text-[10px] font-bold uppercase" style={{ ...caps, color: featured ? "#065f46" : "var(--muted)" }}>{t(`kicker_${code}`)}</span>
              <h2 className="font-extrabold" style={{ fontSize: "1.7rem", lineHeight: 1.1 }}>{plan!.name}</h2>
              <p className="font-semibold">{t(`hook_${code}`)}</p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>{t(`pitch_${code}`)}</p>
            </div>
            <div className="mx-6 p-4" style={{ background: "#fff8f3", borderTop: `1px solid ${HAIR}` }} data-price={plan!.monthly}>
              {free ? (
                <p className="font-extrabold" style={{ fontSize: "2.2rem", lineHeight: 1 }}>{t("free")}</p>
              ) : (
                <p dir="ltr" style={{ textAlign: "start" }}>
                  <span className="font-extrabold" style={{ fontSize: "2.2rem", lineHeight: 1, fontFeatureSettings: '"tnum" 1' }}>{nf(plan!.monthly)}</span>{" "}
                  <span className="text-sm font-bold">DZD</span>
                </p>
              )}
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                {free ? t("freeNote") : t("perMonth")}
              </p>
              {!free && (
                <p className="mt-2 text-xs font-semibold" data-annual={plan!.annual}>
                  {t("annual", { amount: nf(plan!.annual), discount })}
                </p>
              )}
            </div>
            {code !== "vitrine" && (
              <p className="mx-6 mt-4 text-xs font-bold uppercase" style={{ ...caps, color: "#065f46" }}>{t(code === "agent_export" ? "includesVitrine" : "includesAgent")}</p>
            )}
            <ul className="flex flex-1 flex-col gap-3 p-6 text-sm">
              {PLAN_ITEMS[code].map((item) => (
                <li key={item.key} className="flex gap-2" data-soon={item.soon || undefined}>
                  <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0" style={{ background: item.soon ? "transparent" : "#047857", border: item.soon ? "1px solid #94a3b8" : undefined }} />
                  <span className="flex flex-col gap-0.5">
                    {item.problem && <span className="text-xs italic" style={{ color: "var(--muted)" }}>« {t(`problem_${item.key}`)} »</span>}
                    <span>
                      {t(`item_${item.key}`, { hours: grid.freeDelayHours })}
                      {item.soon && (
                        <span className="ms-2 inline-block px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase" style={{ ...caps, background: "#f5efe6", border: `1px solid ${HAIR}` }}>{t("soon")}</span>
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 p-6 pt-0">
              {code !== "vitrine" && <p className="text-center text-xs" style={{ color: "var(--muted)" }}>{t(`status_${code}`, { days: grid.trialDays })}</p>}
              <Link
                href={PLAN_CTA[code].href}
                className="block px-4 py-3 text-center text-xs font-bold uppercase"
                style={{ ...caps, ...(featured || code === "vitrine" ? { background: "#047857", color: "white" } : { border: "1px solid var(--ink)" }) }}
              >
                {t(PLAN_CTA[code].key)}
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
