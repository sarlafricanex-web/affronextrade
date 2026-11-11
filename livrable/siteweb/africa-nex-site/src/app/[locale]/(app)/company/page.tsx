import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyCompany } from "@/lib/data/company";
import { WILAYAS } from "@/lib/onboarding/reference";
import { IdentityForm } from "@/components/onboarding/IdentityForm";
import { PresentationForm } from "@/components/onboarding/PresentationForm";
import { BuyerForm } from "@/components/onboarding/BuyerForm";
import { buyerDefaults } from "@/lib/onboarding/buyer";
import { countryName } from "@/lib/countries";
import { DocumentsPanel } from "@/components/company/DocumentsPanel";

export const instant = false;

const TABS = ["presentation", "identity", "documents"] as const;
const TAB_LABEL = { presentation: "tabPresentation", identity: "tabIdentity", documents: "tabDocuments" } as const;

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

  const [{ count: productCount }, { count: registrationCount }] = await Promise.all([
    user.supabase.from("products").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    user.supabase.from("company_documents").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("kind", "registration"),
  ]);

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

  return (
    <div className="flex flex-col gap-8">
      {saved && (
        <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid var(--accent)" }}>
          {t("savedNotice")}
        </p>
      )}

      <header className="flex flex-wrap items-center gap-5 p-5" style={{ background: "white", border: "1px solid var(--field-b)" }}>
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden" style={{ border: "1px solid var(--field-b)" }}>
          {company.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt={t("logoAlt")} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-2xl font-extrabold" style={{ color: "var(--muted)" }}>{company.company_name.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("companyEyebrow")}</p>
          <h1 className="mt-1 font-extrabold" style={{ fontSize: "var(--step-heading)", lineHeight: 1.1 }}>{company.company_name}</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {[company.city, wilaya, company.sector ? t(`sector_${company.sector}`) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span
          className="px-3 py-2 text-xs font-bold uppercase"
          style={{ letterSpacing: "0.08em", background: published ? "var(--accent)" : "var(--field-a)", color: published ? "white" : "var(--ink)" }}
        >
          {published ? t("statusPublished") : t("statusDraft")}
        </span>
      </header>

      <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
        <div className="flex flex-col gap-0" style={{ minWidth: 0 }}>
          <nav className="flex flex-wrap" aria-label={t("companyTabs")}>
            {TABS.map((key) => {
              const active = key === current;
              return (
                <Link
                  key={key}
                  href={`/company?tab=${key}`}
                  aria-current={active ? "page" : undefined}
                  className="px-5 py-3 text-sm font-bold"
                  style={{ background: active ? "var(--ink)" : "white", color: active ? "white" : "var(--ink)", border: "1px solid var(--field-b)" }}
                >
                  {t(TAB_LABEL[key])}
                </Link>
              );
            })}
          </nav>
          <section style={{ background: "white", border: "1px solid var(--field-b)", borderTop: "none", padding: "clamp(1.25rem, 3vw, 2rem)" }}>
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

        <aside className="flex flex-col gap-4 p-5" style={{ background: "white", border: "1px solid var(--field-b)" }}>
          <h2 className="font-bold">{t("completionTitle")}</h2>
          <p className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{percent} %</p>
          <div className="h-2 w-full" style={{ background: "var(--field-a)" }} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full" style={{ width: `${percent}%`, background: "var(--accent)" }} />
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {checks.map((c) => (
              <li key={c.key} className="flex items-start gap-2" style={{ color: c.ok ? "var(--ink)" : "var(--muted)" }}>
                <span aria-hidden="true" className="font-bold" style={{ color: c.ok ? "var(--accent)" : "var(--muted)" }}>{c.ok ? "✓" : "○"}</span>
                <span>{t(c.key)}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{published ? t("sidePublished") : t("sideDraft")}</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("sidePrivate")}</p>
        </aside>
      </div>
    </div>
  );
}
