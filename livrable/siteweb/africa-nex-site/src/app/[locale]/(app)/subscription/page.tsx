import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyCompanyId } from "@/lib/data/company";
import { getPlanGrid } from "@/lib/data/plans";
import { PLANS, PLAN_CTA, PLAN_ITEMS, isPlan } from "@/config/pricing";

export const instant = false;

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

// "Mon abonnement" du producteur (offres du 24 novembre 2026) : offre en vigueur lue en base
// (public.current_plan), ce qu'elle inclut, et l'offre suivante. Aucun paiement en ligne : le
// changement d'offre passe par l'equipe AFRICA NEX.
export default async function SubscriptionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);
  const companyId = await getMyCompanyId(user.supabase, user.userId);
  if (!companyId) redirect(`/${locale}/onboarding`);
  const [t, grid, current] = await Promise.all([
    getTranslations({ locale, namespace: "pricing" }),
    getPlanGrid(),
    user.supabase.rpc("current_plan", { p_company: companyId }),
  ]);
  const tier = isPlan(current.data) ? current.data : "vitrine";
  const next = PLANS[PLANS.indexOf(tier) + 1] ?? null;
  const row = (code: string) => grid.plans.find((p) => p.code === code);
  const nf = (n: number) => n.toLocaleString(locale);
  const items = (code: (typeof PLANS)[number]) => (
    <ul className="flex flex-col gap-2 text-sm">
      {PLAN_ITEMS[code].map((item) => (
        <li key={item.key} className="flex gap-2" style={item.soon ? { color: "var(--muted)" } : undefined}>
          <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center text-xs font-bold" style={{ border: `1px solid ${item.soon ? HAIR : "#10b981"}`, color: "#065f46" }}>{item.soon ? "" : "✓"}</span>
          <span>{t(`item_${item.key}`, { hours: grid.freeDelayHours })}{item.soon ? ` · ${t("soon")}` : ""}</span>
        </li>
      ))}
    </ul>
  );

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
            <p className="font-extrabold" style={{ fontSize: "2.4rem", lineHeight: 1 }} data-current-plan={tier}>{row(tier)?.name ?? t(`plan_${tier}`)}</p>
            <p dir="ltr" style={{ textAlign: "start" }}>
              {(row(tier)?.monthly ?? 0) === 0 ? (
                <span className="font-extrabold" style={{ fontSize: "1.4rem" }}>{t("free")}</span>
              ) : (
                <>
                  <span className="font-extrabold" style={{ fontSize: "1.4rem" }}>{nf(row(tier)!.monthly)} DZD</span>{" "}
                  <span className="text-sm" style={{ color: "var(--muted)" }}>{t("perMonth")}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-3 px-6 py-5">
            <p className="font-bold">{t("subIncluded")}</p>
            {items(tier)}
          </div>
        </section>

        <section className="flex flex-col" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <div className="px-6 py-4" style={{ background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>
            <p className="text-xs font-bold uppercase" style={caps}>{t("subNext")}</p>
          </div>
          <div className="flex flex-1 flex-col gap-4 px-6 py-5">
            {next ? (
              <>
                <h2 className="font-extrabold" style={{ fontSize: "1.8rem", lineHeight: 1.1 }}>{t("subUpgrade", { plan: row(next)?.name ?? t(`plan_${next}`) })}</h2>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {t(`hook_${next}`)} · <strong dir="ltr">{nf(row(next)?.monthly ?? 0)} DZD</strong> {t("perMonth")}
                </p>
                <p className="text-xs font-bold uppercase" style={{ ...caps, color: "#065f46" }}>{t(next === "agent_export" ? "includesVitrine" : "includesAgent")}</p>
                {items(next)}
                <p className="text-xs" style={{ color: "var(--muted)" }}>{t(`status_${next}`, { days: grid.trialDays })}</p>
                <Link href={PLAN_CTA[next].href} className="mt-auto block px-4 py-3 text-center text-xs font-bold uppercase" style={{ ...caps, background: "var(--ink)", color: "white" }}>{t(PLAN_CTA[next].key)}</Link>
              </>
            ) : (
              <p className="text-sm">{t("subTop")}</p>
            )}
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
