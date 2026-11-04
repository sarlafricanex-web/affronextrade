import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/Reveal";

export default async function BuyersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("buyers");

  return (
    <div style={{ paddingTop: "3.5rem" }}>
      {/* Hero */}
      <section className="grid md:grid-cols-2 items-center" style={{ minHeight: "70svh" }}>
        <div style={{ padding: "var(--section-gap) var(--page-margin) 4rem" }}>
          <Reveal>
            <h1
              className="font-extrabold"
              style={{ fontSize: "var(--step-display)", lineHeight: 0.92, letterSpacing: "-0.03em", maxWidth: "14ch" }}
            >
              {t("title")}
            </h1>
          </Reveal>
          <Reveal delay={1}>
            <p className="mt-6" style={{ color: "var(--muted)", maxWidth: "36ch" }}>
              {t("subtitle")}
            </p>
          </Reveal>
        </div>
        <div className="relative h-[50svh] md:h-full overflow-hidden">
          <img
            src="/images/olives-in-olive-oil.jpg"
            alt="Olives vertes dans l'huile d'olive"
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
            width={1760}
            height={1168}
          />
        </div>
      </section>

      {/* Benefits */}
      <section style={{ padding: "var(--section-gap) var(--page-margin)" }}>
        <div className="max-w-3xl space-y-0">
          {(["benefit1", "benefit2", "benefit3", "benefit4"] as const).map((key, i) => (
            <Reveal key={key} delay={(i + 1) as 1 | 2 | 3 | 4}>
              <div
                className="py-6 grid grid-cols-[3rem_1fr] gap-6 items-baseline"
                style={{
                  borderBottom: i < 3 ? "1px dotted var(--field-b)" : "none",
                }}
              >
                <p className="text-right font-extrabold" style={{ fontSize: "1.5rem", color: "var(--accent-warm)" }}>
                  {i + 1}
                </p>
                <div>
                  <p className="font-bold">{t(key)}</p>
                  <p className="mt-1" style={{ color: "var(--muted)", fontSize: "var(--step-small)" }}>
                    {t(`${key}Desc`)}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        className="relative"
        style={{ height: "60svh", minHeight: "400px" }}
      >
        <img
          src="/images/sunrise-from-algeria-port.jpg"
          alt="Lever de soleil depuis un port algerien"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(0.7)" }}
          loading="lazy"
          decoding="async"
          width={1920}
          height={1440}
        />
        <div
          className="relative h-full flex items-end"
          style={{ padding: "4rem var(--page-margin)" }}
        >
          <div>
            <Reveal>
              <h2 className="font-extrabold" style={{ fontSize: "var(--step-title)", color: "white" }}>
                {t("ctaTitle")}
              </h2>
            </Reveal>
            <Reveal delay={1}>
              <Link
                href="/contact"
                className="inline-block mt-4 text-sm font-semibold px-8 py-3"
                style={{ background: "var(--ground)", color: "var(--ink)" }}
              >
                {t("ctaButton")}
              </Link>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
