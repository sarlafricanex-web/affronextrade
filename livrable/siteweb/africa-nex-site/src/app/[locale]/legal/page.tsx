import { getTranslations, setRequestLocale } from "next-intl/server";
import { Reveal } from "@/components/Reveal";

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");

  return (
    <div style={{ paddingTop: "3.5rem" }}>
      <section style={{ padding: "var(--section-gap) var(--page-margin)" }}>
        <Reveal>
          <h1
            className="font-extrabold"
            style={{ fontSize: "var(--step-title)", lineHeight: 0.95, letterSpacing: "-0.03em" }}
          >
            {t("title")}
          </h1>
        </Reveal>
      </section>

      <section style={{ padding: "0 var(--page-margin) var(--section-gap)" }}>
        <div className="max-w-3xl space-y-10">
          <Reveal>
            <div className="space-y-3">
              <h2 className="font-bold text-lg">{t("companyTitle")}</h2>
              <div className="text-sm leading-relaxed space-y-1" style={{ color: "var(--muted)" }}>
                <p>SARL AFRICA NEX</p>
                <p>Cite 50 LSP + 18, Locaux RDC, Batiment 4, Bloc 1, n 52</p>
                <p>Setif, Algerie</p>
                <p>RC : 19/00-0096919 B 26</p>
                <p>NIF : 002619009691970</p>
                <p>Email : sarlafricanex@gmail.com</p>
                <p>Tel : +213 770 96 02 70</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={1}>
            <div className="space-y-3">
              <h2 className="font-bold text-lg">{t("hostingTitle")}</h2>
              <div className="text-sm leading-relaxed space-y-1" style={{ color: "var(--muted)" }}>
                <p>Vercel Inc.</p>
                <p>440 N Barranca Avenue #4133, Covina, CA 91723, USA</p>
                <p>https://vercel.com</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={2}>
            <div className="space-y-3">
              <h2 className="font-bold text-lg">{t("dataTitle")}</h2>
              <div className="text-sm leading-relaxed space-y-2" style={{ color: "var(--muted)" }}>
                <p>{t("dataIntro")}</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>{t("dataItem1")}</li>
                  <li>{t("dataItem2")}</li>
                  <li>{t("dataItem3")}</li>
                </ul>
                <p>{t("dataPurpose")}</p>
                <p>{t("dataRetention")}</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={3}>
            <div className="space-y-3">
              <h2 className="font-bold text-lg">{t("rightsTitle")}</h2>
              <div className="text-sm leading-relaxed space-y-2" style={{ color: "var(--muted)" }}>
                <p>{t("rightsIntro")}</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>{t("rightsAccess")}</li>
                  <li>{t("rightsCorrect")}</li>
                  <li>{t("rightsDelete")}</li>
                  <li>{t("rightsObject")}</li>
                </ul>
                <p>{t("rightsContact")}</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={4}>
            <div className="space-y-3">
              <h2 className="font-bold text-lg">{t("cookiesTitle")}</h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                {t("cookiesText")}
              </p>
            </div>
          </Reveal>

          <Reveal delay={4}>
            <p className="text-xs pt-8" style={{ color: "var(--muted)", opacity: 0.6 }}>
              {t("lastUpdate")}
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
