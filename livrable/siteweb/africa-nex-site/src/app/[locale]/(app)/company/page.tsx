import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { countRecentViews, getMyCompany } from "@/lib/data/company";
import { WILAYAS } from "@/lib/onboarding/reference";
import { IdentityForm } from "@/components/onboarding/IdentityForm";
import { PresentationForm } from "@/components/onboarding/PresentationForm";
import { BuyerForm } from "@/components/onboarding/BuyerForm";
import { buyerDefaults } from "@/lib/onboarding/buyer";
import { countryName } from "@/lib/countries";
import { DocumentsPanel } from "@/components/company/DocumentsPanel";

export const instant = false;

const TABS = ["presentation", "identity", "documents"] as const;

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; saved?: string; doc?: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role === "buyer") {
    const [t, defaults, { saved }] = await Promise.all([
      getTranslations({ locale, namespace: "onboarding" }),
      buyerDefaults(user.supabase, user.userId),
      searchParams,
    ]);
    if (!defaults.companyName) redirect(`/${locale}/onboarding`);
    return (
      <div className="flex flex-col gap-8">
        {saved && (
          <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid var(--accent)" }}>{t("savedNotice")}</p>
        )}
        <header>
          <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("buyerEyebrow")}</p>
          <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{defaults.companyName}</h1>
          <p className="mt-3" style={{ color: "var(--muted)" }}>{countryName(defaults.country, locale)} · {defaults.city}</p>
        </header>
        <section style={{ background: "white", border: "1px solid var(--field-b)", padding: "clamp(1.25rem, 3vw, 2rem)" }}>
          <BuyerForm defaults={defaults} mode="edit" />
        </section>
      </div>
    );
  }
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);

  const [t, company, { tab, saved, doc }] = await Promise.all([
    getTranslations({ locale, namespace: "onboarding" }),
    getMyCompany(user.supabase, user.userId),
    searchParams,
  ]);
  // Pas encore d'entreprise : la premiere configuration la cree.
  if (!company) redirect(`/${locale}/onboarding`);

  const [{ count: productCount }, { count: publishedCount }, { count: registrationCount }, { data: verifiedDocs }, views, tc] = await Promise.all([
    user.supabase.from("products").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    user.supabase.from("products").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "published"),
    user.supabase.from("company_documents").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("kind", "registration"),
    user.supabase.from("company_documents").select("id, kind, title, expires_on").eq("company_id", company.id).eq("review_status", "accepted").order("kind"),
    countRecentViews(user.supabase, company.id),
    getTranslations({ locale, namespace: "company" }),
  ]);
  const [td, format] = await Promise.all([getTranslations({ locale, namespace: "documents" }), getFormatter({ locale })]);

  const current = tab === "identity" || tab === "documents" ? tab : "presentation";
  const wilaya = WILAYAS.find(([code]) => code === company.wilaya)?.[1];

  // Completion calculee sur les vrais champs de la fiche, rien d'autre.
  const checks = [
    { key: "checkIdentity", ok: Boolean(company.private?.tax_id && company.private?.rc_number) },
    { key: "checkDescriptionFr", ok: Boolean(company.description_fr) },
    { key: "checkDescriptionEn", ok: Boolean(company.description_en) },
    { key: "checkDescriptionAr", ok: Boolean(company.description_ar) },
    { key: "checkLogo", ok: Boolean(company.logo_url) },
    { key: "checkWebsite", ok: Boolean(company.website) },
    { key: "checkProduct", ok: (productCount ?? 0) > 0 },
    { key: "checkRegistration", ok: (registrationCount ?? 0) > 0 },
  ];
  const percent = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  const published = company.visibility === "published";

  const HAIR = "#d8cebb";
  const caps = { letterSpacing: "0.08em" } as const;
  const badge = (label: string, tone: "ok" | "warn" | "muted") => {
    const s = tone === "ok" ? { background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46" } : tone === "warn" ? { background: "#fff7ed", border: "1px solid #f97316", color: "#9a3412" } : { background: "#f5efe6", border: `1px solid ${HAIR}`, color: "var(--muted)" };
    return <span className="px-2 py-1 text-[11px] font-bold uppercase" style={{ ...caps, ...s }}>{label}</span>;
  };
  const stats = [
    { label: tc("statFounded"), value: company.founded_year ? String(company.founded_year) : null },
    { label: tc("statHeadcount"), value: company.headcount ? tc("statHeadcountValue", { range: company.headcount }) : null },
    { label: tc("statProducts"), value: tc("statProductsValue", { published: publishedCount ?? 0, total: productCount ?? 0 }) },
    { label: tc("statViews"), value: String(views) },
  ];

  return (
    <div className="flex flex-col gap-6">
      {saved && (
        <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #10b981" }}>
          {t("savedNotice")}
        </p>
      )}

      {/* En-tete d'apres la maquette Stitch 05 : nom, badges reels, actions. */}
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <nav aria-label={tc("breadcrumb")} className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
            <Link href="/dashboard" className="hover:underline">{tc("eyebrow")}</Link>
            <span aria-hidden="true" style={{ color: HAIR }}>/</span>
            <span style={{ color: "#059669" }}>{tc("breadcrumbCurrent")}</span>
          </nav>
          <h1 className="font-extrabold uppercase" style={{ fontSize: "clamp(1.5rem, 3vw, 2.1rem)", lineHeight: 1.15, letterSpacing: "-0.025em" }}>
            {tc("title", { name: company.company_name })}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {badge(published ? t("statusPublished") : t("statusDraft"), published ? "ok" : "muted")}
            {company.verified ? badge(tc("badgeVerified"), "ok") : badge(tc("badgeNotVerified"), "muted")}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {published ? (
            <Link href={`/producers/${company.slug}`} className="px-4 py-3 text-xs font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)", background: "white", color: "var(--ink)" }}>
              {tc("viewPublic")}
            </Link>
          ) : (
            <span className="px-4 py-3 text-xs font-bold uppercase" title={tc("viewPublicDraftHint")} style={{ ...caps, border: `1px solid ${HAIR}`, color: "var(--muted)" }}>
              {tc("viewPublicDraft")}
            </span>
          )}
        </div>
      </header>

      {/* Bandeau : couverture si fournie, logo et localisation. */}
      <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
        <div className={`relative w-full overflow-hidden ${company.cover_url ? "h-36 md:h-44" : "h-28"}`} style={{ background: "#e5d8c8", borderBottom: `1px solid ${HAIR}` }}>
          {company.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.cover_url} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute bottom-3 start-4 flex items-center gap-3 p-2" style={{ background: "white", border: "2px solid var(--ink)" }}>
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden" style={{ background: "#f5efe6" }}>
              {company.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logo_url} alt={t("logoAlt")} className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xl font-extrabold" style={{ color: "var(--muted)" }}>{company.company_name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="pe-2">
              <p className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{tc("location")}</p>
              <p className="text-sm font-bold">{[company.city, wilaya].filter(Boolean).join(", ") || "-"}</p>
            </div>
          </div>
          {!company.logo_url && (
            <Link href="/company?tab=presentation" className="absolute end-3 top-3 px-3 py-1.5 text-[11px] font-bold uppercase" style={{ ...caps, background: "white", border: `1px solid ${HAIR}`, color: "var(--ink)" }}>
              + {tc("addLogo")}
            </Link>
          )}
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className="p-4" style={{ borderInlineStart: i ? `1px solid ${HAIR}` : undefined, borderTop: i > 1 ? `1px solid ${HAIR}` : undefined }}>
              <dt className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{s.label}</dt>
              <dd className="mt-1 font-extrabold uppercase" style={{ fontSize: "1.1rem", color: s.value ? "var(--ink)" : "#f97316" }}>{s.value ? <span dir="ltr" style={{ unicodeBidi: "isolate" }}>{s.value}</span> : tc("toComplete")}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col" style={{ minWidth: 0 }}>
          <nav className="grid grid-cols-1 sm:grid-cols-3" aria-label={t("companyTabs")}>
            {TABS.map((key, i) => {
              const active = key === current;
              return (
                <Link
                  key={key}
                  href={`/company?tab=${key}`}
                  aria-current={active ? "page" : undefined}
                  className="flex items-center px-3 py-3 text-[11px] font-bold uppercase leading-snug sm:justify-center sm:text-center"
                  style={{ ...caps, background: active ? "var(--ink)" : "#f5efe6", color: active ? "white" : "var(--ink)", border: `1px solid ${HAIR}` }}
                >
                  {i + 1}. {tc(`tab_${key}`)}
                </Link>
              );
            })}
          </nav>
          <section style={{ background: "white", border: `1px solid ${HAIR}`, borderTop: "none", padding: "clamp(1.25rem, 3vw, 2rem)" }}>
            {current === "documents" ? (
              <DocumentsPanel client={user.supabase} companyId={company.id} locale={locale} notice={doc} />
            ) : current === "presentation" ? (
              <PresentationForm
                mode="edit"
                defaults={{
                  descriptionFr: company.description_fr ?? "",
                  descriptionEn: company.description_en ?? "",
                  descriptionAr: company.description_ar ?? "",
                  website: company.website ?? "",
                  foundedYear: company.founded_year ? String(company.founded_year) : "",
                  headcount: company.headcount ?? "",
                  logoUrl: company.logo_url,
                }}
              />
            ) : (
              <IdentityForm
                mode="edit"
                defaults={{
                  companyName: company.company_name,
                  legalForm: company.legal_form ?? "",
                  sector: company.sector ?? "",
                  nif: company.private?.tax_id ?? "",
                  rc: company.private?.rc_number ?? "",
                  wilaya: company.wilaya ?? "",
                  city: company.city ?? "",
                  address: company.private?.address ?? "",
                  phone: company.private?.contact_phone ?? "",
                  whatsapp: company.private?.contact_whatsapp ?? "",
                }}
              />
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          {/* Completion calculee sur les vrais champs (pas de "score de conformite" invente). */}
          <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
            <h2 className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#fff2e2", borderBottom: `1px solid ${HAIR}` }}>{t("completionTitle")}</h2>
            <div className="flex flex-col gap-3 p-5">
              <p className="font-extrabold" style={{ fontSize: "2.25rem", lineHeight: 1, fontFeatureSettings: '"tnum" 1' }}>{percent} %</p>
              <div className="h-2 w-full" style={{ background: "#f5efe6", border: `1px solid ${HAIR}` }} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full" style={{ width: `${percent}%`, background: "#059669" }} />
              </div>
              <ul className="flex flex-col gap-1.5 text-sm">
                {checks.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2" style={{ color: c.ok ? "var(--ink)" : "var(--muted)" }}>
                      <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center text-[10px] font-bold" style={c.ok ? { background: "#059669", color: "white" } : { border: `1px solid ${HAIR}` }}>{c.ok ? "✓" : ""}</span>
                      {t(c.key)}
                    </span>
                    <span className="text-[10px] font-bold uppercase" style={{ ...caps, color: c.ok ? "#059669" : "#c2410c" }}>{c.ok ? tc("checkOk") : tc("checkTodo")}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs" style={{ color: "var(--muted)" }}>{published ? t("sidePublished") : t("sideDraft")}</p>
            </div>
          </section>

          {/* Labels et accreditations : uniquement les documents verifies par AFRICA NEX. */}
          <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
            <h2 className="flex items-center justify-between px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#fff2e2", borderBottom: `1px solid ${HAIR}` }}>
              {tc("labelsTitle")}
              <span className="px-1.5 py-0.5 text-[10px]" style={{ border: `1px solid ${HAIR}`, background: "white" }}>{tc("labelsCount", { count: verifiedDocs?.length ?? 0 })}</span>
            </h2>
            <div className="flex flex-col gap-3 p-5">
              {(verifiedDocs ?? []).length === 0 ? (
                <p className="text-sm" style={{ color: "var(--muted)" }}>{tc("labelsEmpty")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {(verifiedDocs ?? []).map((d) => (
                    <li key={d.id} className="flex items-start gap-3 p-3 text-sm" style={{ background: "#fff8f3", border: `1px solid ${HAIR}` }}>
                      <span aria-hidden="true" className="font-bold" style={{ color: "#059669" }}>✓</span>
                      <span>
                        <span className="block font-semibold">{d.title || td(`kind_${d.kind}`)}</span>
                        <span className="block text-xs" style={{ color: "var(--muted)" }}>{td(`kind_${d.kind}`)}{d.expires_on ? ` · ${td("validUntil", { date: format.dateTime(new Date(`${d.expires_on}T12:00:00`), { dateStyle: "medium" }) })}` : ""}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/company?tab=documents" className="block py-2.5 text-center text-xs font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)", color: "var(--ink)" }}>
                + {tc("addCertification")}
              </Link>
            </div>
          </section>

          {/* Interlocuteur : les vraies coordonnees d'AFRICA NEX. */}
          <section className="p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
            <h2 className="mb-3 text-xs font-bold uppercase" style={caps}>{tc("contactTitle")}</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>{tc("contactText")}</p>
            <p className="mt-3 text-sm font-semibold" dir="ltr" style={{ textAlign: "start" }}>sarlafricanex@gmail.com</p>
            <p className="text-sm font-semibold" dir="ltr" style={{ textAlign: "start" }}>+213 770 96 02 70</p>
            <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>{t("sidePrivate")}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
