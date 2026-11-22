import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getProducerCards, getProducerProfile } from "@/lib/data/directory";
import { routing } from "@/i18n/routing";
import { WILAYAS } from "@/lib/onboarding/reference";
import { countryName } from "@/lib/countries";
import { ProducerAvatar, Stars } from "@/components/producers/parts";
import { isSector } from "@/lib/sectors";
import { RecordView } from "@/components/producers/RecordView";
import { ReviewSlot } from "@/components/producers/ReviewSlot";

// Fiche producteur publique d'apres la maquette Stitch 09, alimentee uniquement par nos donnees.
// Jamais de prix producteur : l'acheteur recoit l'offre AFRICA NEX via une demande de devis.

type Params = Promise<{ locale: string; slug: string }>;
type Lang = "fr" | "en" | "ar";

const HAIR = "#d8cebb";
const STRIP = "#fff2e2";
const CAPS = "text-xs font-bold uppercase";
const capsStyle = { letterSpacing: "0.08em" } as const;

// Texte dans la langue de la page, sinon francais, anglais, arabe.
function pick(texts: Record<Lang, string | null>, locale: string) {
  const order: Lang[] = [locale as Lang, "fr", "en", "ar"];
  for (const l of order) if (texts[l]?.trim()) return { text: texts[l]!, lang: l };
  return null;
}

const ICONS = {
  building: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6",
  box: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8",
  seal: "M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3zM9 12l2 2 4-4",
  doc: "M14 2H6v20h12V6l-4-4zM14 2v4h4M9 13h6M9 17h6",
  star: "M12 2l3 6.5 7 1-5 5 1.2 7L12 18l-6.2 3.5L7 14.5l-5-5 7-1L12 2z",
  pin: "M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  tag: "M20 12l-8 8-9-9V3h8l9 9zM7 7h.01",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  check: "M20 6L9 17l-5-5",
  chart: "M3 3v18h18M7 15l4-4 3 3 5-6",
  truck: "M1 4h14v12H1zM15 9h4l3 3v4h-7M5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  eye: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  gavel: "M14 13l-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10M16 16l6-6M8 8l6-6M9 7l8 8",
} as const;

function Icon({ name, size = 18, className = "" }: { name: keyof typeof ICONS; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={ICONS[name]} />
    </svg>
  );
}

// Bloc a bandeau titre, comme les "feuilles" de la maquette.
function Sheet({ icon, title, aside, id, children }: { icon: keyof typeof ICONS; title: string; aside?: ReactNode; id?: string; children: ReactNode }) {
  return (
    <section id={id} style={{ background: "white", border: `1px solid ${HAIR}`, scrollMarginTop: "5rem" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5" style={{ background: STRIP, borderBottom: `1px solid ${HAIR}` }}>
        <h2 className={`flex items-center gap-2 ${CAPS}`} style={capsStyle}>
          <Icon name={icon} />
          {title}
        </h2>
        {aside}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
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
  const [t, o, td, ts, format] = await Promise.all([
    getTranslations("producers"),
    getTranslations("onboarding"),
    getTranslations("documents"),
    getTranslations("sectors"),
    getFormatter(),
  ]);

  const about = pick(profile.description, locale);
  const wilaya = WILAYAS.find(([code]) => code === profile.wilaya)?.[1];
  const place = [profile.location, wilaya && !profile.location.toLowerCase().includes(wilaya.toLowerCase()) ? wilaya : null, countryName("DZ", locale)].filter(Boolean).join(", ");
  const sector = isSector(profile.sector) ? ts(profile.sector) : null;
  const avg = profile.reviews.length ? profile.reviews.reduce((s, r) => s + r.rating, 0) / profile.reviews.length : null;
  const avgText = avg === null ? null : format.number(avg, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const unitLabel = (u: string | null) => (u ? (o.has(`unit_${u}`) ? o(`unit_${u}`) : u) : "");
  const packagings = [...new Set(profile.products.map((p) => p.packaging).filter(Boolean))] as string[];
  const metrics = [
    profile.monthlyCapacity !== null && { label: t("metricCapacity"), hint: t("metricCapacityHint"), value: `${format.number(profile.monthlyCapacity)} ${unitLabel(profile.monthlyCapacityUnit)}` },
    profile.exportPorts && { label: t("metricPorts"), hint: t("metricPortsHint"), value: profile.exportPorts },
    profile.foundedYear && { label: t("founded"), hint: null, value: String(profile.foundedYear) },
    profile.headcount && { label: o("headcount"), hint: null, value: profile.headcount },
  ].filter(Boolean) as { label: string; hint: string | null; value: string }[];

  return (
    <div style={{ paddingTop: "3.5rem", background: "#fff8f3" }}>
      <Suspense fallback={null}>
        <RecordView companyId={profile.id} locale={locale} />
      </Suspense>

      {profile.claimStatus === "unclaimed" && (
        <div role="note" className="text-sm" style={{ background: "var(--ink)", color: "white", padding: "0.9rem var(--page-margin)" }}>
          {t("unclaimedBanner")}{" "}
          <Link href={`/claim/${profile.slug}`} className="font-bold underline" style={{ color: "white" }}>{t("claimLink")}</Link>
        </div>
      )}
      {profile.claimStatus === "claim_pending" && (
        <div role="note" className="text-sm" style={{ background: "var(--ink)", color: "white", padding: "0.9rem var(--page-margin)" }}>
          {t("claimPendingBanner")}
        </div>
      )}

      <div className="mx-auto w-full" style={{ maxWidth: 1440, padding: "2rem var(--page-margin) 4rem" }}>
        <nav aria-label={t("breadcrumb")} className={`mb-6 flex flex-wrap items-center gap-2 ${CAPS} font-semibold`} style={{ ...capsStyle, color: "var(--muted)" }}>
          <Link href="/" className="hover:underline">{t("breadcrumbHome")}</Link>
          <span aria-hidden="true" style={{ color: HAIR }}>/</span>
          <Link href="/producers" className="hover:underline">{t("breadcrumbProducers")}</Link>
          <span aria-hidden="true" style={{ color: HAIR }}>/</span>
          <span style={{ color: "var(--ink)" }}>{profile.name}</span>
        </nav>

        {/* En-tete : couverture (si fournie) puis identite */}
        <div className="mb-8" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          {profile.cover && (
            <div className="relative h-60 w-full overflow-hidden md:h-80" style={{ borderBottom: `1px solid ${HAIR}`, background: "#e5d8c8" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.cover} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="p-6">
            <div className="flex flex-col justify-between gap-6 pb-6 lg:flex-row lg:items-center" style={{ borderBottom: `1px solid ${HAIR}` }}>
              <div className="flex min-w-0 items-start gap-4">
                <div className="p-1" style={{ border: "2px solid var(--ink)", background: "white" }}>
                  <ProducerAvatar name={profile.name} logo={profile.logo} initials={profile.initials} color={profile.color} size={64} />
                </div>
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <h1 className="font-extrabold" style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", lineHeight: 1.2, letterSpacing: "-0.025em" }}>{profile.name}</h1>
                    {profile.verified ? (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 ${CAPS}`} style={{ ...capsStyle, background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46" }}>
                        <Icon name="seal" size={15} />
                        {t("verifiedProducer")}
                      </span>
                    ) : (
                      <span className={`px-3 py-1 ${CAPS} font-semibold`} style={{ ...capsStyle, background: "#f5efe6", border: `1px solid ${HAIR}`, color: "var(--muted)" }}>
                        {t("referenced")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" style={{ color: "var(--muted)" }}>
                    <span className="flex items-center gap-1.5"><Icon name="pin" size={16} /><span style={{ color: "var(--ink)" }}>{place}</span></span>
                    {sector && <span className="flex items-center gap-1.5"><Icon name="tag" size={16} /><span style={{ color: "var(--ink)" }}>{sector}</span></span>}
                    <span className="flex items-center gap-1.5">
                      {avgText ? (
                        <>
                          <span className="font-extrabold" style={{ color: "#c2410c", fontFeatureSettings: '"tnum" 1' }}>★ {avgText} / 5</span>
                          <span>({t("reviewsCount", { count: profile.reviews.length })})</span>
                        </>
                      ) : (
                        <span>{t("noReviews")}</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 lg:max-w-md" style={{ background: "#faecdc", border: `1px solid ${HAIR}` }}>
                <Icon name="gavel" size={24} />
                <div>
                  <p className="text-[11px] font-bold uppercase" style={capsStyle}>{t("frameTitle")}</p>
                  <p className="mt-0.5 text-sm leading-tight">{t("frameText")}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 pt-4 text-sm" style={{ color: "var(--muted)" }}>
              <span className="flex items-center gap-2"><span className="h-2 w-2" style={{ background: "#10b981" }} />{t("ribbon1")}</span>
              <span className="flex items-center gap-2"><span className="h-2 w-2" style={{ background: "var(--ink)" }} />{t("ribbon2")}</span>
              <span className="flex items-center gap-2"><span className="h-2 w-2" style={{ background: "#10b981" }} />{t("ribbon3")}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-8 lg:col-span-8">
            <Sheet icon="building" title={t("about")}>
              {about ? (
                <p className="whitespace-pre-line leading-relaxed" lang={about.lang} dir={about.lang === "ar" ? "rtl" : "ltr"} style={{ maxWidth: "75ch" }}>{about.text}</p>
              ) : (
                <p style={{ color: "var(--muted)" }}>{t("noDescription")}</p>
              )}
              {profile.products.length > 0 && (
                <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${HAIR}` }}>
                  <p className="mb-3 text-[11px] font-semibold uppercase" style={{ ...capsStyle, color: "var(--muted)" }}>{t("specialties")}</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.products.slice(0, 8).map((p) => (
                      <span key={p.id} className="px-3 py-1.5 text-sm font-semibold" style={{ background: "#faecdc", border: `1px solid ${HAIR}` }}>{p.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </Sheet>

            <Sheet
              icon="box"
              title={t("productsTitle", { count: profile.products.length })}
              aside={profile.products.length > 0 ? <span className="text-[11px] font-bold uppercase" style={{ ...capsStyle, color: "#065f46" }}>{t("catalogActive")}</span> : null}
            >
              {profile.products.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>{t("noProducts")}</p>
              ) : (
                <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {profile.products.map((p) => {
                    const desc = pick(p.description, locale);
                    const unit = unitLabel(p.unit);
                    const rows = [
                      p.moq !== null && { label: t("moq"), value: `${format.number(p.moq)} ${unit}` },
                      p.packaging && { label: t("packaging"), value: p.packaging },
                      p.cap20 !== null && { label: t("cap20"), value: `${format.number(p.cap20)} ${unit}` },
                      p.cap40 !== null && { label: t("cap40"), value: `${format.number(p.cap40)} ${unit}` },
                    ].filter(Boolean) as { label: string; value: string }[];
                    return (
                      <li key={p.id} className="flex flex-col justify-between" style={{ border: `1px solid ${HAIR}` }}>
                        <div>
                          {/* Sans photo, pas de grand cadre vide : le code SH passe a cote du nom. */}
                          {p.photo && (
                            <div className="relative h-48 w-full overflow-hidden" style={{ background: "#e5d8c8", borderBottom: `1px solid ${HAIR}` }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.photo} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                              {p.hsCode && (
                                <span className="absolute end-2 top-2 px-2 py-0.5 text-[10px] font-bold" dir="ltr" style={{ background: "white", border: `1px solid ${HAIR}`, letterSpacing: "0.04em" }}>SH {p.hsCode}</span>
                              )}
                            </div>
                          )}
                          <div className="p-4">
                            <div className="mb-1 flex items-start justify-between gap-3">
                              <h3 className="font-bold">{p.name}</h3>
                              {!p.photo && p.hsCode && (
                                <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold" dir="ltr" style={{ background: "#fff8f3", border: `1px solid ${HAIR}`, letterSpacing: "0.04em" }}>SH {p.hsCode}</span>
                              )}
                            </div>
                            {desc && <p className="mb-3 text-sm" lang={desc.lang} dir={desc.lang === "ar" ? "rtl" : "ltr"} style={{ color: "var(--muted)" }}>{desc.text}</p>}
                            {rows.length > 0 && (
                              <dl className="space-y-1.5 pt-3 text-sm" style={{ borderTop: `1px solid ${HAIR}` }}>
                                {rows.map((r) => (
                                  <div key={r.label} className="flex items-center justify-between gap-3">
                                    <dt className="text-[11px] font-semibold uppercase" style={{ ...capsStyle, color: "var(--muted)" }}>{r.label}</dt>
                                    <dd className="text-end font-semibold" style={{ fontFeatureSettings: '"tnum" 1' }}>{r.value}</dd>
                                  </div>
                                ))}
                              </dl>
                            )}
                          </div>
                        </div>
                        <div className="p-4 pt-0">
                          <Link href={`/register?role=buyer&next=${encodeURIComponent(`/${locale}/rfq/new?product=${p.id}`)}`} className={`block w-full py-2.5 text-center ${CAPS}`} style={{ ...capsStyle, border: "1px solid var(--ink)", color: "var(--ink)" }}>{t("requestQuoteProduct")}</Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Sheet>

            {profile.documents.length > 0 && (
              <Sheet icon="seal" title={t("certificationsTitle")} aside={<span className="text-[11px] font-semibold uppercase" style={{ ...capsStyle, color: "var(--muted)" }}>{t("checkedByAfricaNex")}</span>}>
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {profile.documents.map((d) => {
                    return (
                      <li key={d.id} className="flex flex-col justify-between p-4" style={{ background: "#fff8f3", border: `1px solid ${HAIR}` }}>
                        <div className="flex items-start gap-3">
                          <span className="p-2" style={{ background: "#faecdc", border: `1px solid ${HAIR}` }}><Icon name="doc" /></span>
                          <div className="min-w-0">
                            <h3 className="font-bold">{d.title || td(`kind_${d.kind}`)}</h3>
                            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{td(`kind_${d.kind}`)}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-2 pt-3" style={{ borderTop: `1px solid ${HAIR}` }}>
                          <span className="text-[10px] font-bold uppercase" style={{ ...capsStyle, color: "#065f46" }}>
                            {d.expires_on
                              ? td("validUntil", { date: format.dateTime(new Date(`${d.expires_on}T12:00:00`), { dateStyle: "medium" }) })
                              : td("status_accepted")}
                          </span>
                          <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener" className="text-[10px] font-bold uppercase underline" style={{ ...capsStyle, color: "var(--ink)" }}>{td("open")}</a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Sheet>
            )}

            <section id="avis" style={{ background: "white", border: `1px solid ${HAIR}`, scrollMarginTop: "5rem" }}>
              <div className="flex flex-col justify-between gap-4 px-6 py-4 sm:flex-row sm:items-center" style={{ background: STRIP, borderBottom: `1px solid ${HAIR}` }}>
                <div className="flex items-center gap-3">
                  <Icon name="star" />
                  <div>
                    <h2 className={CAPS} style={capsStyle}>{t("reviewsTitle")}</h2>
                    {avgText ? (
                      <p className="mt-0.5 flex items-center gap-2 text-sm">
                        <span className="font-bold" style={{ fontFeatureSettings: '"tnum" 1' }}>{avgText} / 5</span>
                        <Stars rating={avg ?? 0} size={14} />
                        <span style={{ color: "var(--muted)" }}>({t("reviewsCount", { count: profile.reviews.length })})</span>
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>{t("noReviews")}</p>
                    )}
                  </div>
                </div>
                <a href="#laisser-un-avis" className={`px-4 py-2 ${CAPS}`} style={{ ...capsStyle, border: "1px solid var(--ink)", background: "white", color: "var(--ink)" }}>{t("leaveReview")}</a>
              </div>
              <div className="p-6">
                {profile.reviews.length > 0 && (
                  <ul>
                    {profile.reviews.map((r, i) => (
                      <li key={r.id} className="py-6 first:pt-0" style={{ borderTop: i ? `1px solid ${HAIR}` : undefined }}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <Stars rating={r.rating} size={14} />
                          <span className="text-[11px] font-semibold uppercase" style={{ ...capsStyle, color: "var(--muted)" }}>
                            {format.dateTime(new Date(r.created_at), { month: "long", year: "numeric" })}
                          </span>
                        </div>
                        {r.comment && <p className="italic leading-relaxed">« {r.comment} »</p>}
                        <p className="mt-2 text-[11px] font-semibold uppercase" style={{ ...capsStyle, color: "var(--muted)" }}>
                          {r.author_name}{r.author_country ? ` · ${countryName(r.author_country, locale)}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <div id="laisser-un-avis" style={{ scrollMarginTop: "5rem" }}>
                  <Suspense fallback={null}>
                    <ReviewSlot companyId={profile.id} slug={profile.slug} locale={locale} producerName={profile.name} />
                  </Suspense>
                </div>
              </div>
            </section>
          </div>

          {/* Sur telephone, le bloc devis passe juste sous l'en-tete (sinon il arrive apres les avis). */}
          <aside className="order-first flex flex-col gap-6 lg:sticky lg:top-20 lg:order-none lg:col-span-4">
            <div id="devis" className="p-6" style={{ background: "var(--ink)", color: "white", scrollMarginTop: "5rem" }}>
              <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase" style={{ ...capsStyle, color: "#065f46" }}>
                <Icon name="lock" size={16} />
                {t("channelLabel")}
              </p>
              <h2 className="mb-2 font-extrabold" style={{ fontSize: "1.75rem", lineHeight: 1.2, letterSpacing: "-0.025em" }}>{t("quoteTitle")}</h2>
              <p className="mb-6 leading-relaxed" style={{ color: "#f4e6d6" }}>{t("quoteText")}</p>
              {/* Visiteur : inscription acheteur puis formulaire ; deja connecte : le proxy l'envoie directement au formulaire. */}
              <Link href={`/register?role=buyer&next=${encodeURIComponent(`/${locale}/rfq/new?producer=${profile.slug}`)}`} className="mb-4 block w-full px-4 py-3.5 text-center font-bold uppercase" style={{ background: "#047857", color: "white", letterSpacing: "0.04em" }}>
                {t("requestQuote")}
              </Link>
              <ul className="space-y-2 pt-4 text-sm" style={{ borderTop: "1px solid #334155", color: "#cbd5e1" }}>
                {(["quotePoint1", "quotePoint2", "quotePoint3"] as const).map((k, i) => (
                  <li key={k} className="flex items-start gap-2.5">
                    <Icon name={(["check", "eye", "truck"] as const)[i]} size={16} className="mt-0.5 text-[#10b981]" />
                    <span>{t(k)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs" style={{ color: "#94a3b8" }}>{t("quoteNote")}</p>
            </div>

            {(metrics.length > 0 || packagings.length > 0) && (
              <div style={{ background: "white", border: `1px solid ${HAIR}` }}>
                <h2 className={`flex items-center gap-2 px-5 py-3 ${CAPS}`} style={{ ...capsStyle, background: STRIP, borderBottom: `1px solid ${HAIR}` }}>
                  <Icon name="chart" size={16} />
                  {t("metricsTitle")}
                </h2>
                <dl className="space-y-4 p-5">
                  {metrics.map((m) => (
                    <div key={m.label} className="flex items-start justify-between gap-3 pb-3" style={{ borderBottom: `1px solid ${HAIR}` }}>
                      <dt>
                        <span className="block text-[11px] font-semibold uppercase" style={{ ...capsStyle, color: "var(--muted)" }}>{m.label}</span>
                        {m.hint && <span className="text-sm">{m.hint}</span>}
                      </dt>
                      <dd className="text-end font-extrabold" style={{ fontFeatureSettings: '"tnum" 1' }}>{m.value}</dd>
                    </div>
                  ))}
                  {packagings.length > 0 && (
                    <div>
                      <dt className="mb-1.5 block text-[11px] font-semibold uppercase" style={{ ...capsStyle, color: "var(--muted)" }}>{t("metricPackagings")}</dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {packagings.slice(0, 6).map((pk) => (
                          <span key={pk} className="px-2 py-0.5 text-[11px]" style={{ background: "#fff8f3", border: `1px solid ${HAIR}` }}>{pk}</span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            <div className="flex items-start gap-3 p-5" style={{ background: "#faecdc", border: `1px solid ${HAIR}` }}>
              <span className="p-2" style={{ background: "var(--ink)", color: "#065f46" }}><Icon name="seal" size={22} /></span>
              <div>
                <h2 className="mb-1 text-xs font-bold uppercase" style={capsStyle}>{t("integrityTitle")}</h2>
                <p className="text-sm leading-snug">{t("integrityText")}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
