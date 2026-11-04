import { getTranslations, setRequestLocale } from "next-intl/server";
import { Reveal } from "@/components/Reveal";

const SERVICES = [
  { key: "b2b", figure: "5+" },
  { key: "marketing", figure: "IA" },
  { key: "logistics", figure: "3" },
  { key: "consulting", figure: "24h" },
] as const;

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services");

  return (
    <div style={{ paddingTop: "3.5rem" }}>
      <section style={{ padding: "var(--section-gap) var(--page-margin)" }}>
        <Reveal>
          <h1
            className="font-extrabold"
            style={{ fontSize: "var(--step-display)", lineHeight: 0.92, letterSpacing: "-0.03em", maxWidth: "16ch" }}
          >
            {t("title")}
          </h1>
        </Reveal>
        <Reveal delay={1}>
          <p className="mt-6" style={{ color: "var(--muted)", maxWidth: "40ch" }}>
            {t("subtitle")}
          </p>
        </Reveal>
      </section>

      <section style={{ padding: "0 var(--page-margin) var(--section-gap)" }}>
        <div className="max-w-3xl">
          {SERVICES.map((s, i) => (
            <Reveal key={s.key} delay={(i + 1) as 1 | 2 | 3 | 4}>
              <div
                className="py-8 grid grid-cols-[6rem_1fr] gap-8 items-baseline"
                style={{
                  borderBottom: i < SERVICES.length - 1 ? "1px dotted var(--field-b)" : "none",
                }}
              >
                <p
                  className="text-right font-extrabold tabular-nums"
                  style={{ fontSize: "clamp(2rem, 3vw, 2.5rem)" }}
                >
                  {s.figure}
                </p>
                <div>
                  <h2 className="font-bold" style={{ fontSize: "1.25rem" }}>
                    {t(s.key)}
                  </h2>
                  <p className="mt-2" style={{ color: "var(--muted)", maxWidth: "40ch" }}>
                    {t(`${s.key}Desc`)}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
