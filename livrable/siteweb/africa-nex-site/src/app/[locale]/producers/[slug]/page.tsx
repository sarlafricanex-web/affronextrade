import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getProducerCards, getProducerProfile } from "@/lib/data/directory";
import { routing } from "@/i18n/routing";
import { WILAYAS } from "@/lib/onboarding/reference";
import { countryName } from "@/lib/countries";
import { ProducerAvatar, SECTOR_FILTER_KEY, Stars, VerifiedBadge } from "@/components/producers/parts";
import { RecordView } from "@/components/producers/RecordView";

type Params = Promise<{ locale: string; slug: string }>;
type Lang = "fr" | "en" | "ar";

// Texte dans la langue de la page, sinon francais, anglais, arabe.
function pick(texts: Record<Lang, string | null>, locale: string) {
  const order: Lang[] = [locale as Lang, "fr", "en", "ar"];
  for (const l of order) if (texts[l]?.trim()) return { text: texts[l]!, lang: l };
  return null;
}

// Fiches publiees pre-rendues a la compilation ; les nouvelles le sont a la premiere visite.
export async function generateStaticParams() {
  const cards = await getProducerCards();
  return routing.locales.flatMap((locale) => cards.map((c) => ({ locale, slug: c.slug })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const profile = await getProducerProfile(slug);
  if (!profile) return {};
  const description = pick(profile.description, locale)?.text.slice(0, 160);
  return {
    title: `${profile.name} | AFRICA NEX`,
    description: description ?? undefined,
    alternates: { canonical: `/${locale}/producers/${slug}` },
  };
}

export default async function ProducerProfilePage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const profile = await getProducerProfile(slug);
  if (!profile) notFound();
  const [t, o, format] = await Promise.all([
    getTranslations("producers"),
    getTranslations("onboarding"),
    getFormatter(),
  ]);

  const about = pick(profile.description, locale);
  const wilaya = WILAYAS.find(([code]) => code === profile.wilaya)?.[1];
  const place = [profile.location, wilaya && !profile.location.includes(wilaya) ? wilaya : null].filter(Boolean).join(" · ");
  const sector = SECTOR_FILTER_KEY[profile.sector] ? t(SECTOR_FILTER_KEY[profile.sector]) : null;
  const avg = profile.reviews.length ? profile.reviews.reduce((s, r) => s + r.rating, 0) / profile.reviews.length : null;
  const facts = [
    sector && { label: t("sector"), value: sector },
    profile.foundedYear && { label: t("founded"), value: String(profile.foundedYear) },
    profile.headcount && { label: o("headcount"), value: profile.headcount },
  ].filter(Boolean) as { label: string; value: string }[];
  const box = { background: "white", border: "1px solid var(--field-b)" } as const;

  return (
    <div style={{ paddingTop: "3.5rem" }}>
      <Suspense fallback={null}>
        <RecordView companyId={profile.id} locale={locale} />
      </Suspense>

      {profile.claimStatus !== "claimed" && (
        <div role="note" className="text-sm" style={{ background: "var(--ink)", color: "white", padding: "0.9rem var(--page-margin)" }}>
          {t("unclaimedBanner")}{" "}
          <Link href="/contact" className="font-bold underline">{t("claimLink")}</Link>
        </div>
      )}

      <section style={{ padding: "3rem var(--page-margin) 2rem" }}>
        <Link href="/producers" className="text-sm font-semibold" style={{ color: "var(--muted)" }}>← {t("backToDirectory")}</Link>
        <div className="mt-6 flex flex-wrap items-center gap-5">
          <ProducerAvatar name={profile.name} logo={profile.logo} initials={profile.initials} color={profile.color} size={72} />
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1, letterSpacing: "-0.02em" }}>{profile.name}</h1>
              {profile.verified && <VerifiedBadge label={t("verified")} />}
            </div>
            <p className="mt-2" style={{ color: "var(--muted)" }}>{place}{place ? " · " : ""}{countryName("DZ", locale)}</p>
            <p className="mt-2 flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
              <Stars rating={avg ?? 0} size={14} />
              {avg ? `${format.number(avg, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} (${profile.reviews.length})` : t("noReviews")}
            </p>
          </div>
        </div>
      </section>

      <section className="grid items-start gap-8 lg:grid-cols-[1fr_320px]" style={{ padding: "0 var(--page-margin) var(--section-gap)" }}>
        <div className="flex min-w-0 flex-col gap-8">
          <article className="p-6" style={box}>
            <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{t("about")}</h2>
            {about ? (
              <p className="mt-3 whitespace-pre-line" lang={about.lang} dir={about.lang === "ar" ? "rtl" : "ltr"} style={{ maxWidth: "70ch" }}>{about.text}</p>
            ) : (
              <p className="mt-3" style={{ color: "var(--muted)" }}>{t("noDescription")}</p>
            )}
            {facts.length > 0 && (
              <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                {facts.map((f) => (
                  <div key={f.label}>
                    <dt className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{f.label}</dt>
                    <dd className="mt-1 font-semibold">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </article>

          <div>
            <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{t("products")}</h2>
            {profile.products.length === 0 ? (
              <p className="mt-3" style={{ color: "var(--muted)" }}>{t("noProducts")}</p>
            ) : (
              <ul className="mt-4 grid gap-px sm:grid-cols-2" style={{ background: "var(--field-b)", border: "1px solid var(--field-b)" }}>
                {profile.products.map((p) => {
                  const desc = pick(p.description, locale);
                  const unit = p.unit ? o(`unit_${p.unit}`) : "";
                  const specs = [
                    p.hsCode && { label: t("hsCode"), value: p.hsCode, ltr: true },
                    p.moq !== null && { label: t("moq"), value: `${format.number(p.moq)} ${unit}` },
                    p.packaging && { label: t("packaging"), value: p.packaging },
                    p.cap20 !== null && { label: t("cap20"), value: `${format.number(p.cap20)} ${unit}` },
                    p.cap40 !== null && { label: t("cap40"), value: `${format.number(p.cap40)} ${unit}` },
                  ].filter(Boolean) as { label: string; value: string; ltr?: boolean }[];
                  return (
                    <li key={p.id} className="flex flex-col gap-3 p-5" style={{ background: "white" }}>
                      {p.photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo} alt={p.name} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                      )}
                      <h3 className="font-bold">{p.name}</h3>
                      {desc && <p className="text-sm" lang={desc.lang} dir={desc.lang === "ar" ? "rtl" : "ltr"} style={{ color: "var(--muted)" }}>{desc.text}</p>}
                      {specs.length > 0 && (
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                          {specs.map((s) => (
                            <div key={s.label} className="contents">
                              <dt style={{ color: "var(--muted)" }}>{s.label}</dt>
                              <dd className="font-semibold" dir={s.ltr ? "ltr" : undefined}>{s.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{t("reviewsTitle")}</h2>
            {profile.reviews.length === 0 ? (
              <p className="mt-3" style={{ color: "var(--muted)" }}>{t("noReviews")}</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-4">
                {profile.reviews.map((r) => (
                  <li key={r.id} className="p-5" style={box}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars rating={r.rating} size={12} />
                      <span className="text-sm font-semibold">{r.author_name}</span>
                      {r.author_company && <span className="text-xs" style={{ color: "var(--muted)" }}>{r.author_company}</span>}
                      {r.author_country && <span className="text-xs" style={{ color: "var(--muted)" }}>· {countryName(r.author_country, locale)}</span>}
                    </div>
                    {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                    <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>{format.dateTime(new Date(r.created_at), { dateStyle: "medium" })}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>{t("reviewsComingSoon")}</p>
          </div>
        </div>

        <aside id="devis" className="flex flex-col gap-4 p-6 lg:sticky lg:top-20" style={{ ...box, scrollMarginTop: "5rem" }}>
          <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{t("quoteTitle")}</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("quoteText")}</p>
          <Link href="/register" className="px-5 py-3 text-center text-sm font-bold uppercase" style={{ background: "var(--accent)", color: "white", letterSpacing: "0.08em" }}>
            {t("requestQuote")}
          </Link>
          <Link href="/contact" className="text-center text-sm font-semibold" style={{ color: "var(--muted)" }}>{t("quoteContact")}</Link>
          <p className="text-xs" style={{ color: "var(--muted)" }}>{t("quoteNote")}</p>
        </aside>
      </section>
    </div>
  );
}
