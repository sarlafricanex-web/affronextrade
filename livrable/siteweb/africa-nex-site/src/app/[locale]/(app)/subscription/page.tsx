import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCompanyTier, getMyCompanyId } from "@/lib/data/company";
import { MONTHLY_PRICE, PLANS, PLAN_FEATURES, isPlan } from "@/config/pricing";

export const instant = false;

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

// Semaine 6 : "Mon abonnement" du producteur, en lecture seule (maquette 19b). La base ne connait
// que le forfait de l'entreprise : aucun etat de paiement n'est affiche (pas de paiement en v1).
export default async function SubscriptionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);
  const companyId = await getMyCompanyId(user.supabase, user.userId);
  if (!companyId) redirect(`/${locale}/onboarding`);
  const [t, tierRaw] = await Promise.all([getTranslations({ locale, namespace: "pricing" }), getCompanyTier(user.supabase, companyId)]);
  const tier = isPlan(tierRaw) ? tierRaw : "starter";
  const next = PLANS[PLANS.indexOf(tier) + 1] ?? null;
  const price = (p: (typeof PLANS)[number]) => MONTHLY_PRICE[p].DZD;

  return (
    <div className="flex flex-col gap-6" data-subscription={tier}>
      <header>
        <p className="text-xs font-semibold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("subEyebrow")}</p>
        <h1 className="mt-2 font-extrabold uppercase" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", lineHeight: 1.05 }}>{t("subTitle")}</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{t("subIntro")}</p>
      </header>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <section className="flex flex-col" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <div className="px-6 py-4" style={{ background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>
            <p className="text-xs font-bold uppercase" style={caps}>{t("subCurrent")}</p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 px-6 py-5" style={{ borderBottom: `1px solid ${HAIR}` }}>
            <p className="font-extrabold" style={{ fontSize: "2.4rem", lineHeight: 1 }} data-current-plan={tier}>{t(`plan_${tier}`)}</p>
            <p dir="ltr" style={{ textAlign: "start" }}>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{t("subPriceLabel")} </span>
              <span className="font-extrabold" style={{ fontSize: "1.4rem" }}>{price(tier)?.toLocaleString(locale) ?? t("onQuote")} DZD</span>{" "}
              <span className="text-sm" style={{ color: "var(--muted)" }}>{t("perMonthShort")}</span>
            </p>
          </div>
          <div className="flex flex-col gap-3 px-6 py-5">
            <p className="font-bold">{t("subIncluded")}</p>
            <ul className="flex flex-col gap-2 text-sm">
              {PLANS.slice(0, PLANS.indexOf(tier) + 1).flatMap((p) => PLAN_FEATURES[p]).filter((f) => !f.startsWith("featureAll")).map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center text-xs font-bold" style={{ border: "1px solid #10b981", color: "#059669" }}>✓</span>
                  {t(f)}
                </li>
              ))}
              <li className="flex items-center gap-2" style={{ color: "var(--muted)" }}>
                <span aria-hidden="true" className="h-5 w-5 shrink-0" style={{ border: `1px solid ${HAIR}` }} />
                {t("featureTranslation")} · {t("soon")}
              </li>
            </ul>
          </div>
        </section>

        <section className="flex flex-col" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <div className="px-6 py-4" style={{ background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>
            <p className="text-xs font-bold uppercase" style={caps}>{t("subNext")}</p>
          </div>
          <div className="flex flex-1 flex-col gap-4 px-6 py-5">
            {next ? (
              <>
                <h2 className="font-extrabold" style={{ fontSize: "1.8rem", lineHeight: 1.1 }}>{t("subUpgrade", { plan: t(`plan_${next}`) })}</h2>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {t(`pitch_${next}`)} · <strong dir="ltr">{price(next)?.toLocaleString(locale) ?? t("onQuote")} DZD</strong> {t("perMonthShort")}
                </p>
                <ol className="flex flex-col gap-2">
                  {PLAN_FEATURES[next].filter((f) => !f.startsWith("featureAll")).map((f, i) => (
                    <li key={f} className="flex gap-3 p-3 text-sm" style={{ border: `1px solid ${HAIR}`, background: "#fffdf9" }}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-xs font-bold" style={{ background: "#10b981", color: "white" }}>{i + 1}</span>
                      {t(f)}
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-sm">{t("subTop")}</p>
            )}
            <Link href="/contact" className="mt-auto block px-4 py-3 text-center text-xs font-bold uppercase" style={{ ...caps, background: "var(--ink)", color: "white" }}>{t("subChange")}</Link>
            <p className="p-3 text-center text-xs" style={{ border: `1px solid ${HAIR}`, color: "var(--muted)" }}>{t("subNoPayment")}</p>
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-2 p-6" style={{ background: "white", border: `1px solid ${HAIR}` }}>
        <h2 className="font-bold">{t("subHelpTitle")}</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>{t("subHelpText")}</p>
        <p className="text-sm font-semibold" dir="ltr" style={{ textAlign: "start" }}>sarlafricanex@gmail.com · +213 770 96 02 70</p>
        <Link href="/pricing" className="text-xs font-bold uppercase underline" style={caps}>{t("subAllPlans")}</Link>
      </section>
    </div>
  );
}
