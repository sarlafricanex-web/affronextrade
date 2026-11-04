import { getTranslations, setRequestLocale } from "next-intl/server";
import { Reveal } from "@/components/Reveal";

const TEAM = [
  { name: "Adlene", roleKey: "ceo", initial: "A", color: "var(--accent)" },
  { name: "Omar", roleKey: "cto", initial: "O", color: "var(--ink)" },
  { name: "Hamza", roleKey: "cco", initial: "H", color: "var(--accent-warm)" },
  { name: "Mehdi", roleKey: "cfo", initial: "M", color: "var(--muted)" },
] as const;

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  return (
    <div style={{ paddingTop: "3.5rem" }}>
      {/* Mission & Vision */}
      <section style={{ padding: "var(--section-gap) var(--page-margin)" }}>
        <Reveal>
          <h1
            className="font-extrabold"
            style={{ fontSize: "var(--step-display)", lineHeight: 0.92, letterSpacing: "-0.03em", maxWidth: "16ch" }}
          >
            {t("title")}
          </h1>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-16 mt-16">
          <Reveal delay={1}>
            <div>
              <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)", color: "var(--accent)" }}>
                {t("mission")}
              </h2>
              <p className="mt-4" style={{ color: "var(--muted)", lineHeight: 1.6 }}>
                {t("missionText")}
              </p>
            </div>
          </Reveal>

          <Reveal delay={2}>
            <div>
              <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)", color: "var(--accent-warm)" }}>
                {t("vision")}
              </h2>
              <p className="mt-4" style={{ color: "var(--muted)", lineHeight: 1.6 }}>
                {t("visionText")}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Image break */}
      <div className="w-full overflow-hidden" style={{ height: "50svh" }}>
        <img
          src="/images/new-inventions-of-modern-times-nova-reperta.jpg"
          alt="Gravure ancienne : l'invention du pressoir a huile d'olive, XVIe siecle"
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          width={3591}
          height={2666}
        />
      </div>

      {/* Team */}
      <section style={{ padding: "var(--section-gap) var(--page-margin)" }}>
        <Reveal>
          <h2 className="font-extrabold text-center" style={{ fontSize: "var(--step-title)" }}>
            {t("team")}
          </h2>
        </Reveal>
        <Reveal delay={1}>
          <p className="mt-3 text-center mx-auto" style={{ color: "var(--muted)", maxWidth: "36ch" }}>
            {t("teamDesc")}
          </p>
        </Reveal>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16">
          {TEAM.map((member, i) => (
            <Reveal key={member.name} delay={(i + 1) as 1 | 2 | 3 | 4}>
              <div className="text-center">
                <div
                  className="w-16 h-16 mx-auto flex items-center justify-center font-extrabold text-lg text-white"
                  style={{ background: member.color, borderRadius: "50%" }}
                >
                  {member.initial}
                </div>
                <p className="mt-4 font-bold text-lg">{member.name}</p>
                <p style={{ fontSize: "var(--step-small)", color: "var(--muted)" }}>
                  {t(member.roleKey)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
