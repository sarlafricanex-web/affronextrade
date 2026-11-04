import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HeroCrossfade } from "@/components/HeroCrossfade";
import { Reveal } from "@/components/Reveal";

const CAPABILITIES = [
  { key: "b2b", value: "5+ pays" },
  { key: "marketing", value: "IA" },
  { key: "logistics", value: "Maritime, routier, aerien" },
  { key: "consulting", value: "Inclus" },
] as const;

const STATS = [
  { figure: "80+", key: "producers" },
  { figure: "5", key: "countries" },
  { figure: "6", key: "sectors" },
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
      {/* Hero: split-stage */}
      <section className="grid md:grid-cols-2 min-h-svh" style={{ paddingTop: "3.5rem" }}>
        <div
          className="flex flex-col justify-center order-2 md:order-1"
          style={{ padding: "3rem var(--page-margin)" }}
        >
          <Reveal>
            <h1
              className="font-extrabold"
              style={{
                fontSize: "var(--step-display)",
                lineHeight: 0.92,
                letterSpacing: "-0.03em",
                maxWidth: "14ch",
              }}
            >
              {t("hero.title")}
            </h1>
          </Reveal>

          <Reveal delay={1}>
            <p
              className="mt-6"
              style={{
                fontSize: "var(--step-body)",
                color: "var(--muted)",
                maxWidth: "36ch",
              }}
            >
              {t("hero.subtitle")}
            </p>
          </Reveal>

          <Reveal delay={2}>
            <div className="mt-8 flex gap-3">
              <Link
                href="/producers"
                className="text-sm font-semibold px-6 py-3 transition-colors"
                style={{ background: "var(--accent)", color: "white" }}
              >
                {t("hero.ctaProducer")}
              </Link>
              <Link
                href="/buyers"
                className="text-sm font-semibold px-6 py-3 transition-colors"
                style={{
                  background: "transparent",
                  color: "var(--ink)",
                  border: "1px solid var(--field-b)",
                }}
              >
                {t("hero.ctaBuyer")}
              </Link>
            </div>
          </Reveal>
        </div>

        <div className="relative order-1 md:order-2 h-[60svh] md:h-auto md:sticky md:top-0 md:self-start" style={{ height: "100svh" }}>
          <HeroCrossfade />
        </div>
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
                  {stat.figure}
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
              <Reveal key={cap.key} delay={(i + 1) as 1 | 2 | 3 | 4}>
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

      {/* Showcase: split with image */}
      <section className="grid md:grid-cols-2 items-center" style={{ minHeight: "88svh" }}>
        <div className="relative aspect-square md:aspect-auto md:h-full overflow-hidden" style={{ margin: "var(--page-margin)" }}>
          <img
            src="/images/olives-in-olive-oil.jpg"
            alt="Olives vertes dans l'huile d'olive"
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            width={1760}
            height={1168}
          />
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
              {(["agrifood", "industry", "crafts", "cosmetics", "agriculture", "services"] as const).map(
                (key) => (
                  <p key={key} className="font-medium py-2" style={{ fontSize: "var(--step-body)" }}>
                    {t(`categories.${key}`)}
                  </p>
                )
              )}
            </div>
          </Reveal>
          <Reveal delay={3}>
            <Link
              href="/categories"
              className="inline-block mt-8 text-sm font-semibold px-6 py-3"
              style={{ background: "var(--ink)", color: "var(--ground)" }}
            >
              {t("categories.viewAll")}
            </Link>
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
              Resultat : vos produits exportes vers 5+ marches
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
          style={{ filter: "brightness(0.75)" }}
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
              <Link
                href="/contact"
                className="inline-block mt-6 text-sm font-semibold px-6 py-3"
                style={{ background: "var(--ground)", color: "var(--ink)" }}
              >
                {t("cta.producerButton")}
              </Link>
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
                  Notre objectif : 5 millions USD d&apos;export annuel d&apos;ici 2027.
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
              <a
                href="mailto:contact@africanex.com"
                className="flex items-center justify-center shrink-0"
                style={{
                  width: "clamp(3rem, 5vw, 3.5rem)",
                  height: "clamp(3rem, 5vw, 3.5rem)",
                  background: "white",
                  borderRadius: "50%",
                }}
                aria-label="Envoyer un email"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
