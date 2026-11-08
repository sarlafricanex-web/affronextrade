import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Reveal } from "@/components/Reveal";
import { MarketGrid } from "@/components/MarketCard";
import { Link } from "@/i18n/navigation";
import { ArrowButton } from "@/components/ArrowButton";
import { makePageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return makePageMetadata({ locale, titleKey: "opportunitiesTitle", descriptionKey: "opportunitiesDescription", path: "/opportunities" });
}

const QUOTES = [
  {
    text: "Africa is not the next frontier. Africa is the frontier.",
    author: "Ajay Banga",
    role: "President, World Bank",
  },
  {
    text: "The gap between perception and reality about Africa is the biggest arbitrage opportunity in the world.",
    author: "Stephen Hayes",
    role: "President, Corporate Council on Africa",
  },
  {
    text: "Markets don't lie. When you see consistent 6-8% growth across a continent, that's not a story, that's a balance sheet.",
    author: "James Mwangi",
    role: "CEO, Equity Group Holdings",
  },
];

const SECTORS = [
  { name: "Agroalimentaire", value: "32.5", key: "agrifood" },
  { name: "Engrais et chimie", value: "22.9", key: "fertilizers" },
  { name: "Ciment et materiaux", value: "17.1", key: "cement" },
  { name: "Sucre", value: "11.4", key: "sugar" },
  { name: "Pharmaceutique", value: "9.8", key: "pharma" },
  { name: "Fer et acier", value: "4.7", key: "steel" },
  { name: "Huiles vegetales", value: "4.4", key: "oils" },
  { name: "Textiles", value: "3.0", key: "textiles" },
];

const STEPS = [
  { number: "01", key: "step1" },
  { number: "02", key: "step2" },
  { number: "03", key: "step3" },
];

export default async function OpportunitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("opportunities");

  return (
    <main>
      {/* Hero */}
      <section
        className="flex flex-col justify-end"
        style={{
          minHeight: "85vh",
          padding: "var(--page-margin)",
          paddingTop: "6rem",
        }}
      >
        <Reveal>
          <p
            className="font-medium uppercase"
            style={{
              fontSize: "var(--step-small)",
              letterSpacing: "0.12em",
              color: "var(--muted)",
            }}
          >
            {t("heroLabel")}
          </p>
        </Reveal>
        <Reveal delay={1}>
          <h1
            className="font-extrabold mt-4"
            style={{
              fontSize: "var(--step-display)",
              letterSpacing: "-0.03em",
              lineHeight: 0.95,
              maxWidth: "18ch",
            }}
          >
            {t("heroTitle")}
          </h1>
        </Reveal>
        <Reveal delay={2}>
          <p
            className="mt-6"
            style={{
              fontSize: "var(--step-body)",
              color: "var(--muted)",
              maxWidth: "52ch",
            }}
          >
            {t("heroSubtitle")}
          </p>
        </Reveal>
      </section>

      {/* Quotes */}
      <section style={{ padding: "var(--page-margin)" }}>
        <div className="grid md:grid-cols-3 gap-px" style={{ background: "var(--field-b)" }}>
          {QUOTES.map((q, i) => (
            <Reveal key={i} delay={i}>
              <div
                className="flex flex-col justify-between"
                style={{
                  background: "var(--ground)",
                  padding: "2.5rem 2rem",
                  minHeight: "280px",
                }}
              >
                <p
                  className="font-medium italic"
                  style={{
                    fontSize: "var(--step-body)",
                    lineHeight: 1.45,
                    color: "var(--ink)",
                  }}
                >
                  &ldquo;{q.text}&rdquo;
                </p>
                <div className="mt-6">
                  <p className="font-bold text-sm">{q.author}</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {q.role}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Market Grid */}
      <section>
        <div style={{ padding: "var(--page-margin)", paddingBottom: "2rem" }}>
          <Reveal>
            <p
              className="font-medium uppercase"
              style={{
                fontSize: "var(--step-small)",
                letterSpacing: "0.12em",
                color: "var(--muted)",
              }}
            >
              {t("marketsLabel")}
            </p>
          </Reveal>
          <Reveal delay={1}>
            <h2
              className="font-extrabold mt-3"
              style={{
                fontSize: "var(--step-heading)",
                letterSpacing: "-0.03em",
              }}
            >
              {t("marketsTitle")}
            </h2>
          </Reveal>
        </div>
        <MarketGrid />
      </section>

      {/* Sectors */}
      <section style={{ padding: "var(--page-margin)", paddingTop: "6rem" }}>
        <Reveal>
          <p
            className="font-medium uppercase"
            style={{
              fontSize: "var(--step-small)",
              letterSpacing: "0.12em",
              color: "var(--muted)",
            }}
          >
            {t("sectorsLabel")}
          </p>
        </Reveal>
        <Reveal delay={1}>
          <h2
            className="font-extrabold mt-3"
            style={{
              fontSize: "var(--step-heading)",
              letterSpacing: "-0.03em",
              maxWidth: "22ch",
            }}
          >
            {t("sectorsTitle")}
          </h2>
        </Reveal>

        <div className="mt-12">
          {SECTORS.map((sector, i) => (
            <Reveal key={sector.key} delay={i % 3}>
              <div
                className="flex items-baseline justify-between py-5"
                style={{ borderBottom: "1px solid var(--field-b)" }}
              >
                <div className="flex items-baseline gap-4">
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--muted)", minWidth: "2rem" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-semibold" style={{ fontSize: "var(--step-body)" }}>
                    {t(`sector_${sector.key}`)}
                  </span>
                </div>
                <span
                  className="font-extrabold"
                  style={{ fontSize: "var(--step-body)", color: "var(--accent)" }}
                >
                  {sector.value} Md
                </span>
              </div>
            </Reveal>
          ))}
          <Reveal>
            <div className="flex items-baseline justify-between py-5 mt-2">
              <span
                className="font-extrabold uppercase"
                style={{ fontSize: "var(--step-body)", letterSpacing: "0.05em" }}
              >
                {t("sectorsTotal")}
              </span>
              <span
                className="font-extrabold"
                style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "var(--accent-warm)" }}
              >
                105.7 Md USD
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: "var(--page-margin)", paddingTop: "6rem" }}>
        <Reveal>
          <p
            className="font-medium uppercase"
            style={{
              fontSize: "var(--step-small)",
              letterSpacing: "0.12em",
              color: "var(--muted)",
            }}
          >
            {t("stepsLabel")}
          </p>
        </Reveal>
        <Reveal delay={1}>
          <h2
            className="font-extrabold mt-3"
            style={{
              fontSize: "var(--step-heading)",
              letterSpacing: "-0.03em",
            }}
          >
            {t("stepsTitle")}
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-px mt-12" style={{ background: "var(--field-b)" }}>
          {STEPS.map((step, i) => (
            <Reveal key={step.key} delay={i}>
              <div
                className="flex flex-col justify-between"
                style={{
                  background: "var(--ground)",
                  padding: "2.5rem 2rem",
                  minHeight: "240px",
                }}
              >
                <p
                  className="font-extrabold"
                  style={{
                    fontSize: "clamp(3rem, 5vw, 5rem)",
                    lineHeight: 1,
                    color: "var(--field-b)",
                  }}
                >
                  {step.number}
                </p>
                <div>
                  <p
                    className="font-bold"
                    style={{ fontSize: "var(--step-body)" }}
                  >
                    {t(`${step.key}_title`)}
                  </p>
                  <p
                    className="mt-2"
                    style={{ fontSize: "var(--step-small)", color: "var(--muted)" }}
                  >
                    {t(`${step.key}_desc`)}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        className="relative flex flex-col justify-end"
        style={{
          minHeight: "60vh",
          marginTop: "6rem",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(/images/cherchell-harbour-01.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "brightness(0.3)",
          }}
        />
        <div className="relative" style={{ padding: "var(--page-margin)", color: "white" }}>
          <Reveal>
            <h2
              className="font-extrabold"
              style={{
                fontSize: "var(--step-heading)",
                letterSpacing: "-0.03em",
                maxWidth: "20ch",
              }}
            >
              {t("ctaTitle")}
            </h2>
          </Reveal>
          <Reveal delay={1}>
            <p
              className="mt-4"
              style={{
                fontSize: "var(--step-body)",
                opacity: 0.8,
                maxWidth: "45ch",
              }}
            >
              {t("ctaSubtitle")}
            </p>
          </Reveal>
          <Reveal delay={2}>
            <div className="flex flex-wrap gap-4 mt-8 mb-8">
              <ArrowButton href="/contact" variant="light">
                {t("ctaButton")}
              </ArrowButton>
              <Link
                href="/producers"
                className="arrow-btn inline-flex items-center gap-0 text-sm font-semibold"
                style={{ border: "1px solid rgba(255,255,255,0.4)", color: "white", background: "transparent" }}
              >
                <span className="arrow-btn-label">{t("ctaSecondary")}</span>
                <span className="arrow-btn-icon" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" />
                  </svg>
                </span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
