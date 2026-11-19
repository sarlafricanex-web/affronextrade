import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { makePageMetadata } from "@/lib/seo";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { COMMISSION_TIERS } from "@/lib/offer-pricing";

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return makePageMetadata({ locale, titleKey: "pricingTitle", descriptionKey: "pricingDescription", path: "/pricing" });
}

// Semaine 6 : tarifs des producteurs (maquette 19). Prix du cahier des charges, commission AFRICA NEX
// ajoutee au prix acheteur (pas de "success fee"), aucun paiement en ligne.
export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pricing");
  const tiers = [
    { rate: COMMISSION_TIERS[0].rate, label: t("tier1", { amount: (5000).toLocaleString(locale) }) },
    { rate: COMMISSION_TIERS[1].rate, label: t("tier2", { low: (5000).toLocaleString(locale), high: (500000).toLocaleString(locale) }) },
    { rate: COMMISSION_TIERS[2].rate, label: t("tier3", { amount: (500000).toLocaleString(locale) }) },
  ];

  return (
    <div style={{ paddingTop: "3.5rem" }}>
      <section className="flex flex-col gap-4" style={{ padding: "clamp(2.5rem, 6vw, 4.5rem) var(--page-margin) 2rem" }}>
        <p className="flex items-center gap-2 text-xs font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5" style={{ background: "#10b981" }} />
          {t("eyebrow")}
        </p>
        <h1 className="font-extrabold" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", lineHeight: 1.05, letterSpacing: "-0.02em", maxWidth: "22ch" }}>{t("title")}</h1>
        <p style={{ color: "var(--muted)", maxWidth: "62ch" }}>{t("subtitle")}</p>
      </section>

      <section style={{ padding: "0 var(--page-margin) 3rem" }}>
        <PricingPlans />
      </section>

      <section style={{ padding: "0 var(--page-margin) 3rem" }}>
        <div className="flex flex-col gap-5 p-6" style={{ background: "white", border: `1px solid ${HAIR}` }} data-commission="">
          <div>
            <p className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{t("commissionEyebrow")}</p>
            <h2 className="mt-1 font-extrabold uppercase" style={{ fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)", lineHeight: 1.15 }}>{t("commissionTitle")}</h2>
          </div>
          <div className="grid sm:grid-cols-3" style={{ border: `1px solid ${HAIR}` }}>
            {tiers.map((tier, i) => (
              <div key={tier.rate} className="flex flex-col gap-2 p-4" style={{ borderInlineStart: i ? `1px solid ${HAIR}` : undefined, borderTop: undefined, background: i === 1 ? "#f0fdf4" : "white" }}>
                <span className="text-[10px] font-bold uppercase" style={{ ...caps, color: i === 1 ? "#059669" : "var(--muted)" }}>{t("tierLabel", { n: i + 1 })}</span>
                <span className="text-sm font-semibold">{tier.label}</span>
                <span className="font-extrabold" style={{ fontSize: "2rem", lineHeight: 1, color: i === 1 ? "#059669" : "var(--ink)" }}>{tier.rate} %</span>
              </div>
            ))}
          </div>
          <p className="p-3 text-sm" style={{ background: "#fff8f3", border: `1px solid ${HAIR}` }}>{t("commissionNote")}</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("payment")}</p>
        </div>
      </section>

      <section className="flex flex-col gap-4" style={{ padding: "0 var(--page-margin) 4rem" }}>
        <h2 className="font-extrabold uppercase" style={{ fontSize: "clamp(1.3rem, 3vw, 1.9rem)" }}>{t("faqTitle")}</h2>
        {[1, 2, 3].map((n) => (
          <details key={n} className="p-5" style={{ background: "white", border: `1px solid ${HAIR}` }} open={n === 1}>
            <summary className="cursor-pointer font-bold"><span className="me-2" style={{ color: "#059669" }}>0{n}.</span>{t(`faq${n}Q`)}</summary>
            <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>{t(`faq${n}A`)}</p>
          </details>
        ))}
      </section>

      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center" style={{ background: "var(--ink)", color: "white", padding: "2.5rem var(--page-margin)" }}>
        <div>
          <h2 className="font-extrabold uppercase" style={{ fontSize: "clamp(1.3rem, 3vw, 1.9rem)" }}>{t("ctaTitle")}</h2>
          <p className="mt-2 text-sm" style={{ color: "#cbd5e1", maxWidth: "60ch" }}>{t("ctaText")}</p>
        </div>
        <Link href="/contact" className="shrink-0 px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#10b981", color: "white" }}>{t("contactCta")}</Link>
      </section>
    </div>
  );
}
