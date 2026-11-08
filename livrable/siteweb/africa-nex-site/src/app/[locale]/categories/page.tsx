import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Reveal } from "@/components/Reveal";
import { makePageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return makePageMetadata({ locale, titleKey: "categoriesTitle", descriptionKey: "categoriesDescription", path: "/categories" });
}

const CATEGORIES = [
  "agrifood", "industry", "automotive", "crafts", "cosmetics", "agriculture", "services",
] as const;

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("categories");

  return (
    <div style={{ paddingTop: "3.5rem" }}>
      <section style={{ padding: "var(--section-gap) var(--page-margin)" }}>
        <Reveal>
          <h1
            className="font-extrabold"
            style={{ fontSize: "var(--step-display)", lineHeight: 0.92, letterSpacing: "-0.03em", maxWidth: "18ch" }}
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
        {CATEGORIES.map((key, i) => {
          const isOdd = i % 2 === 1;
          return (
            <Reveal key={key}>
              <div
                className="py-10 grid md:grid-cols-2 gap-8 items-baseline"
                style={{
                  background: isOdd ? "var(--field-a)" : "transparent",
                  margin: isOdd ? "0 calc(-1 * var(--page-margin))" : "0",
                  padding: isOdd ? "2.5rem var(--page-margin)" : "2.5rem 0",
                }}
              >
                <h2
                  className="font-extrabold"
                  style={{ fontSize: "var(--step-heading)" }}
                >
                  {t(key)}
                </h2>
                <p style={{ color: "var(--muted)", maxWidth: "40ch" }}>
                  {t(`${key}Desc`)}
                </p>
              </div>
            </Reveal>
          );
        })}
      </section>
    </div>
  );
}
