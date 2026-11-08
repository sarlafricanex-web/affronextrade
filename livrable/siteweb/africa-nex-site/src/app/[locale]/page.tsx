import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ScrollExpandMedia from "@/components/ui/scroll-expansion-hero";
import { Reveal } from "@/components/Reveal";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { PanoramaScroll } from "@/components/PanoramaScroll";
import { ArrowButton } from "@/components/ArrowButton";

const CAPABILITIES = [
  { key: "b2b", value: "8+ pays" },
  { key: "marketing", value: "IA" },
  { key: "logistics", value: "Maritime, routier, aerien" },
  { key: "consulting", value: "Inclus" },
  { key: "insurance", value: "CAGEX" },
  { key: "compliance", value: "SH" },
] as const;

const STATS = [
  { figure: "80+", key: "producers" },
  { figure: "8", key: "countries" },
  { figure: "7", key: "sectors" },
  { figure: "500+", key: "transactions" },
] as const;

const STEPS = [
  { time: "Jour 1", key: "step1", label: "Inscription et verification", desc: "Creez votre profil producteur. Nous verifions vos documents." },
  { time: "Jour 2-3", key: "step2", label: "Catalogue en ligne", desc: "Vos produits sont publies et visibles par les acheteurs internationaux." },
  { time: "Semaine 1", key: "step3", label: "Premieres demandes", desc: "Les acheteurs vous contactent. Notre IA optimise votre visibilite." },
  { time: "En continu", key: "step4", label: "Export et croissance", desc: "Logistique geree, paiements securises, croissance pilotee par les donnees." },
] as const;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <>
      {/* Hero: scroll-to-expand */}
      <ScrollExpandMedia
        mediaType="image"
        mediaSrc="/images/sunrise-from-algeria-port.jpg"
        bgImageSrc="/images/boat-in-harbor-algeria.jpg"
        title={t("hero.title")}
        scrollToExpand={t("hero.tagline")}
        textBlend
      >
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
          <p
            style={{
              fontSize: "var(--step-body)",
              color: "var(--muted)",
              maxWidth: "42ch",
            }}
          >
            {t("hero.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ArrowButton href="/producers" variant="primary">
              {t("hero.ctaProducer")}
            </ArrowButton>
            <ArrowButton href="/buyers" variant="outline">
              {t("hero.ctaBuyer")}
            </ArrowButton>
          </div>
        </div>
      </ScrollExpandMedia>

      {/* Trust: partner logos */}
      <section
        style={{
          padding: "clamp(3rem, 6vw, 5rem) var(--page-margin)",
          borderTop: "1px solid var(--field-b)",
          borderBottom: "1px solid var(--field-b)",
        }}
      >
        <Reveal>
          <p
            className="text-center text-xs font-semibold uppercase tracking-widest mb-10"
            style={{ color: "var(--muted)" }}
          >
            {t("partners.title")}
          </p>
        </Reveal>
        <Reveal delay={1}>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
            <img
              src="/images/logos/bna.svg"
              alt="BNA - Banque Nationale d'Algerie"
              className="h-10 md:h-12 w-auto object-contain"
              loading="lazy"
            />
            <img
              src="/images/logos/cagex.png"
              alt="CAGEX - Assurance et Garantie des Exportations"
              className="h-10 md:h-12 w-auto object-contain"
              loading="lazy"
            />
            <span
              className="font-extrabold tracking-wide"
              style={{
                color: "var(--ink)",
                fontSize: "clamp(1.4rem, 2.5vw, 1.8rem)",
              }}
            >
              AFG Bank
            </span>
          </div>
        </Reveal>
      </section>

      {/* Stats: quiet figure lines */}
      <section style={{ padding: "var(--section-gap) var(--page-margin)" }}>
        <Reveal>
          <h2
            className="font-extrabold mb-12"
            style={{ fontSize: "var(--step-heading)", maxWidth: "20ch" }}
          >
            {t("stats.title")}
          </h2>
        </Reveal>

        <div className="space-y-6 max-w-3xl">
          {STATS.map((stat, i) => (
            <Reveal key={stat.key} delay={(i + 1) as 1 | 2 | 3 | 4}>
              <div className="grid grid-cols-[7rem_1fr] gap-6 items-baseline">
                <p
                  className="text-right font-medium tabular-nums"
                  style={{ fontSize: "clamp(1.75rem, 2.4vw, 2rem)" }}
                >
                  <AnimatedCounter value={stat.figure} />
                </p>
                <p style={{ color: "var(--muted)", maxWidth: "40ch" }}>
                  {t(`stats.${stat.key}`)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features: capabilities as a menu */}
      <section style={{ background: "var(--field-a)" }}>
        <div
          className="mx-auto max-w-2xl"
          style={{ padding: "var(--section-gap) var(--page-margin)" }}
        >
          <Reveal>
            <h2
              className="font-extrabold text-center mb-10"
              style={{ fontSize: "var(--step-title)" }}
            >
              {t("services.title")}
            </h2>
          </Reveal>

          <div className="space-y-0">
            {CAPABILITIES.map((cap, i) => (
              <Reveal key={cap.key} delay={Math.min(i + 1, 4) as 1 | 2 | 3 | 4}>
                <div
                  className="py-5 flex items-baseline justify-between gap-4"
                  style={{
                    borderBottom: i < CAPABILITIES.length - 1 ? "1px dotted var(--field-b)" : "none",
                  }}
                >
                  <div>
                    <p className="font-bold" style={{ fontSize: "1.1875rem" }}>
                      {t(`services.${cap.key}`)}
                    </p>
                    <p className="mt-1" style={{ fontSize: "var(--step-small)", color: "var(--muted)", maxWidth: "34ch" }}>
                      {t(`services.${cap.key}Desc`)}
                    </p>
                  </div>
                  <p className="text-sm font-medium shrink-0" style={{ color: "var(--muted)" }}>
                    {cap.value}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase: split with panorama */}
      <section className="grid md:grid-cols-2 items-center" style={{ minHeight: "70svh" }}>
        <div style={{ margin: "var(--page-margin)" }}>
          <Reveal>
            <PanoramaScroll
              src="/images/cargo-port-containers.jpg"
              alt="Port cargo international avec conteneurs"
            />
          </Reveal>
        </div>
        <div style={{ padding: "4rem var(--page-margin)" }}>
          <Reveal>
            <h2
              className="font-extrabold"
              style={{ fontSize: "var(--step-title)", maxWidth: "16ch" }}
            >
              {t("categories.title")}
            </h2>
          </Reveal>
          <Reveal delay={1}>
            <p className="mt-6" style={{ color: "var(--muted)", maxWidth: "34ch" }}>
              {t("categories.subtitle")}
            </p>
          </Reveal>
          <Reveal delay={2}>
            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3">
              {(["agrifood", "industry", "automotive", "crafts", "cosmetics", "agriculture", "services"] as const).map(
                (key) => (
                  <p key={key} className="font-medium py-2" style={{ fontSize: "var(--step-body)" }}>
                    {t(`categories.${key}`)}
                  </p>
                )
              )}
            </div>
          </Reveal>
          <Reveal delay={3}>
            <ArrowButton href="/categories" variant="secondary" className="mt-8">
              {t("categories.viewAll")}
            </ArrowButton>
          </Reveal>
        </div>
      </section>

      {/* How it works: itinerary on a slip */}
      <section className="grid md:grid-cols-2 gap-12 items-start" style={{ padding: "var(--section-gap) var(--page-margin)" }}>
        <div>
          <Reveal>
            <h2
              className="font-extrabold"
              style={{ fontSize: "var(--step-title)", maxWidth: "14ch" }}
            >
              {t("trust.title")}
            </h2>
          </Reveal>
          <Reveal delay={1}>
            <p className="mt-4" style={{ color: "var(--muted)", maxWidth: "30ch" }}>
              De l&apos;inscription a l&apos;export, chaque etape est accompagnee.
            </p>
          </Reveal>
        </div>

        <div
          style={{
            background: "var(--field-a)",
            padding: "2.5rem 2rem",
          }}
        >
          {STEPS.map((step, i) => (
            <Reveal key={step.key} delay={(i + 1) as 1 | 2 | 3 | 4}>
              <div
                className="py-4 flex items-baseline justify-between gap-4"
                style={{
                  borderBottom: i < STEPS.length - 1 ? "1px dotted var(--field-b)" : "none",
                }}
              >
                <div>
                  <p className="font-bold">{step.label}</p>
                  <p className="mt-1" style={{ fontSize: "var(--step-small)", color: "var(--muted)" }}>
                    {step.desc}
                  </p>
                </div>
                <p className="text-sm font-medium shrink-0 tabular-nums" style={{ color: "var(--muted)" }}>
                  {step.time}
                </p>
              </div>
            </Reveal>
          ))}

          <Reveal delay={4}>
            <div
              className="mt-4 py-3 px-4 text-center font-semibold text-sm"
              style={{ background: "var(--ink)", color: "var(--ground)" }}
            >
              Resultat : vos produits exportes vers 8+ marches
            </div>
          </Reveal>
        </div>
      </section>

      {/* CAGEX trust badge */}
      <section style={{ background: "var(--ink)", color: "var(--ground)", padding: "clamp(3rem, 6vw, 5rem) var(--page-margin)" }}>
        <div className="max-w-4xl mx-auto grid md:grid-cols-[auto_1fr] gap-8 items-center">
          <Reveal>
            <img
              src="/images/logos/cagex.png"
              alt="CAGEX"
              className="h-16 md:h-20 w-auto object-contain mx-auto md:mx-0"
              style={{ filter: "brightness(0) invert(1)" }}
              loading="lazy"
            />
          </Reveal>
          <Reveal delay={1}>
            <div>
              <h3 className="font-extrabold text-lg md:text-xl">
                {t("trust.cagex")}
              </h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)", maxWidth: "50ch" }}>
                {t("trust.cagexDesc")}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA: last photograph, text beside */}
      <section className="relative" style={{ height: "90svh" }}>
        <img
          src="/images/cherchell-harbour-01.jpg"
          alt="Port de Cherchell, Algerie"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(0.85)" }}
          loading="lazy"
          decoding="async"
          width={1920}
          height={1280}
        />
        <div
          className="relative h-full flex items-end md:items-center justify-end"
          style={{ padding: "4rem var(--page-margin)" }}
        >
          <div className="max-w-md md:mr-[5%]">
            <Reveal>
              <h2
                className="font-extrabold"
                style={{
                  fontSize: "var(--step-title)",
                  color: "white",
                  lineHeight: 1,
                }}
              >
                {t("cta.producerTitle")}
              </h2>
            </Reveal>
            <Reveal delay={1}>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.8)", maxWidth: "34ch" }}>
                {t("cta.producerDesc")}
              </p>
            </Reveal>
            <Reveal delay={2}>
              <ArrowButton href="/contact" variant="light" className="mt-6">
                {t("cta.producerButton")}
              </ArrowButton>
            </Reveal>
          </div>
        </div>
      </section>

      {/* About: founder's letter */}
      <section style={{ padding: "var(--section-gap) 0" }}>
        <div className="mx-auto" style={{ maxWidth: "520px", padding: "0 var(--page-margin)" }}>
          <Reveal>
            <div
              className="w-11 h-11 flex items-center justify-center font-extrabold text-sm"
              style={{
                background: "var(--accent)",
                color: "white",
                borderRadius: "50%",
              }}
            >
              A
            </div>
          </Reveal>

          <Reveal delay={1}>
            <div className="mt-7 space-y-4" style={{ fontSize: "var(--step-body)", lineHeight: 1.55 }}>
              <p>
                J&apos;ai fonde AFRICA NEX parce que je voyais chaque jour des producteurs algeriens de classe mondiale, incapables d&apos;atteindre les marches qui les attendent.
              </p>
              <p>
                Notre huile d&apos;olive, nos dattes, nos produits artisanaux rivalisent avec les meilleurs au monde. Ce qui manque, c&apos;est le pont entre celui qui produit et celui qui achete.
              </p>
              <p>
                Nous construisons ce pont. Avec de la technologie, de l&apos;intelligence artificielle, et surtout avec la conviction que le commerce est le meilleur levier de developpement pour l&apos;Algerie et l&apos;Afrique.
              </p>
              <p>
                <span style={{ background: "rgba(16,185,129,0.15)", padding: "0 4px" }}>
                  Notre objectif : 10 millions USD d&apos;export annuel d&apos;ici 2027.
                </span>
              </p>
            </div>
          </Reveal>

          <Reveal delay={2}>
            <p className="mt-8 text-lg italic font-medium">Adlene</p>
            <p style={{ fontSize: "var(--step-small)", color: "var(--muted)" }}>
              CEO et Fondateur, SARL AFRICA NEX
            </p>
          </Reveal>
        </div>
      </section>

      {/* Contact: address in display rows */}
      <section style={{ background: "var(--field-a)" }}>
        <div style={{ padding: "var(--section-gap) 0" }}>
          {[
            { text: "SARL AFRICA NEX", tone: "var(--field-a)" },
            { text: "Cite 50 LSP + 18, Bloc 1, n52", tone: "var(--ground)" },
            { text: "Setif, Algerie", tone: "var(--field-a)" },
            { text: "0770 96 02 70", tone: "var(--ground)", href: "tel:+213770960270" },
          ].map((row, i) => (
            <Reveal key={i} delay={(i + 1) as 1 | 2 | 3 | 4}>
              <div
                className="flex items-end"
                style={{
                  background: row.tone,
                  padding: "0 var(--page-margin)",
                  height: "clamp(5rem, 10vw, 9.5rem)",
                }}
              >
                {row.href ? (
                  <a
                    href={row.href}
                    className="font-extrabold pb-4"
                    style={{
                      fontSize: "clamp(2.75rem, 6vw, 5.5rem)",
                      lineHeight: 1,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {row.text}
                  </a>
                ) : (
                  <p
                    className="font-extrabold pb-4"
                    style={{
                      fontSize: "clamp(2.75rem, 6vw, 5.5rem)",
                      lineHeight: 1,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {row.text}
                  </p>
                )}
              </div>
            </Reveal>
          ))}

          <Reveal delay={4}>
            <div
              className="flex items-center justify-between"
              style={{
                background: "var(--accent)",
                padding: "0 var(--page-margin)",
                height: "clamp(5rem, 10vw, 9.5rem)",
              }}
            >
              <p
                className="font-extrabold text-white"
                style={{
                  fontSize: "clamp(2.75rem, 6vw, 5.5rem)",
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                }}
              >
                {t("nav.getStarted")}
              </p>
              <Link
                href="/contact"
                className="cta-arrow flex items-center justify-center shrink-0"
                style={{
                  width: "clamp(3rem, 5vw, 3.5rem)",
                  height: "clamp(3rem, 5vw, 3.5rem)",
                  background: "white",
                  borderRadius: "50%",
                }}
                aria-label="Aller à la page contact"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
