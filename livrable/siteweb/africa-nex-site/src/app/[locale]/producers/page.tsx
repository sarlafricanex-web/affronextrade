import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/Reveal";
import { ProducerDirectory } from "@/components/producers/ProducerDirectory";
import { getProducerCards, type ProducerCard } from "@/lib/data/directory";
import { makePageMetadata } from "@/lib/seo";

// Si la base ne repond pas, la page reste en ligne avec un message plutot qu'une erreur.
async function loadProducers(): Promise<{ producers: ProducerCard[]; unavailable: boolean }> {
  try {
    return { producers: await getProducerCards(), unavailable: false };
  } catch (e) {
    console.error("Directory load failed:", e);
    return { producers: [], unavailable: true };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return makePageMetadata({ locale, titleKey: "producersTitle", descriptionKey: "producersDescription", path: "/producers" });
}

export default async function ProducersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, { producers, unavailable }] = await Promise.all([getTranslations("producers"), loadProducers()]);

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
            src="/images/ripe-and-dry-dates-fruit-bunches.jpg"
            alt="Grappes de dattes sur un palmier"
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
            width={1920}
            height={1437}
          />
        </div>
      </section>

      {/* Benefits as figure lines */}
      <section style={{ padding: "var(--section-gap) var(--page-margin)" }}>
        <div className="max-w-3xl space-y-6">
          {(["benefit1", "benefit2", "benefit3", "benefit4"] as const).map((key, i) => (
            <Reveal key={key} delay={(i + 1) as 1 | 2 | 3 | 4}>
              <div className="grid grid-cols-[3rem_1fr] gap-6 items-baseline">
                <p className="text-right font-extrabold" style={{ fontSize: "1.5rem", color: "var(--accent)" }}>
                  {String(i + 1).padStart(1, "0")}
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

      {/* Producer directory */}
      <ProducerDirectory producers={producers} unavailable={unavailable} />

      {/* CTA */}
      <section style={{ background: "var(--field-a)", padding: "var(--section-gap) var(--page-margin)" }}>
        <div className="max-w-xl mx-auto text-center">
          <Reveal>
            <h2 className="font-extrabold" style={{ fontSize: "var(--step-title)" }}>
              {t("ctaTitle")}
            </h2>
          </Reveal>
          <Reveal delay={1}>
            <Link
              href="/contact"
              className="inline-block mt-6 text-sm font-semibold px-8 py-3"
              style={{ background: "var(--accent)", color: "white" }}
            >
              {t("ctaButton")}
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
