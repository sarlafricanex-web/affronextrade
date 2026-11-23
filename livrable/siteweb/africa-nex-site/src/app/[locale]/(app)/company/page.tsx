import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { countRecentViews, getMyCompany } from "@/lib/data/company";
import { companyChecks } from "@/lib/company-completion";
import { WILAYAS } from "@/lib/onboarding/reference";
import { isSector } from "@/lib/sectors";
import { IdentityForm } from "@/components/onboarding/IdentityForm";
import { PresentationForm } from "@/components/onboarding/PresentationForm";
import { BuyerForm } from "@/components/onboarding/BuyerForm";
import { buyerDefaults } from "@/lib/onboarding/buyer";
import { countryName } from "@/lib/countries";
import { DocumentsPanel } from "@/components/company/DocumentsPanel";
import { AccountDeletion } from "@/components/account/AccountDeletion";
import { AppIcon } from "@/components/app/icons";

export const instant = false;

// Ou mene chaque element manquant de la fiche.
const CHECK_TARGET: Record<string, string> = {
  checkIdentity: "/company?tab=identity#identity",
  checkDescriptionFr: "/company?tab=presentation#presentation",
  checkDescriptionEn: "/company?tab=presentation#presentation",
  checkDescriptionAr: "/company?tab=presentation#presentation",
  checkLogo: "/company?tab=presentation#presentation",
  checkWebsite: "/company?tab=presentation#presentation",
  checkProduct: "/catalog/new",
  checkRegistration: "/company?tab=documents#documents",
};

// "Mon entreprise", structure Europages (24 novembre 2026) : bandeau de completion, puis des cartes
// (informations sur l'entreprise, a propos, documents). Chaque carte se lit ; "Modifier" ouvre son
// formulaire dans la carte (?tab=identity ou ?tab=presentation).
export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; saved?: string; doc?: string; deletion?: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role === "buyer") {
    const [t, defaults, { saved, deletion }] = await Promise.all([
      getTranslations({ locale, namespace: "onboarding" }),
      buyerDefaults(user.supabase, user.userId),
      searchParams,
    ]);
    if (!defaults.companyName) redirect(`/${locale}/onboarding`);
    return (
      <div className="dash">
        {saved && <p role="status" className="dash-notice">{t("savedNotice")}</p>}
        <section className="dash-banner" aria-labelledby="company-title">
          <h1 id="company-title">{defaults.companyName}</h1>
          <p>{[countryName(defaults.country, locale), defaults.city].filter(Boolean).join(" · ")}</p>
        </section>
        <section className="dash-card" aria-label={t("buyerEyebrow")}>
          <BuyerForm defaults={defaults} mode="edit" />
        </section>
        <AccountDeletion locale={locale} supabase={user.supabase} notice={deletion} />
      </div>
    );
  }
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);

  const [t, company, { tab, saved, doc, deletion }] = await Promise.all([
    getTranslations({ locale, namespace: "onboarding" }),
    getMyCompany(user.supabase, user.userId),
    searchParams,
  ]);
  // Pas encore d'entreprise : la premiere configuration la cree.
  if (!company) redirect(`/${locale}/onboarding`);

  const [{ count: productCount }, { count: publishedCount }, { count: registrationCount }, { data: verifiedDocs }, views, tc, ts, td, format] = await Promise.all([
    user.supabase.from("products").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    user.supabase.from("products").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "published"),
    user.supabase.from("company_documents").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("kind", "registration"),
    user.supabase.from("company_documents").select("id, kind, title, expires_on").eq("company_id", company.id).eq("review_status", "accepted").order("kind"),
    countRecentViews(user.supabase, company.id),
    getTranslations({ locale, namespace: "company" }),
    getTranslations({ locale, namespace: "sectors" }),
    getTranslations({ locale, namespace: "documents" }),
    getFormatter({ locale }),
  ]);

  const editing = tab === "identity" || tab === "presentation" ? tab : null;
  const wilaya = WILAYAS.find(([code]) => code === company.wilaya)?.[1];
  // Completion calculee sur les vrais champs de la fiche, rien d'autre.
  const { checks, percent } = companyChecks({ company, productCount: productCount ?? 0, registrationCount: registrationCount ?? 0 });
  const missing = checks.filter((c) => !c.ok);
  const published = company.visibility === "published";
  const priv = company.private;
  const taxComplete = Boolean(priv?.tax_id && priv?.nis && priv?.tax_article && priv?.rc_number);
  const description = (locale === "ar" ? company.description_ar : locale === "en" ? company.description_en : null) || company.description_fr;

  // Ligne d'information : valeur, ou lien "Ajouter" vers le formulaire de la carte.
  const row = (label: string, value: React.ReactNode, editTo: "identity" | "presentation") => (
    <div className="profile-row">
      <dt>{label}</dt>
      <dd>{value || <Link href={`/company?tab=${editTo}#${editTo}`} className="profile-add">+ {tc("addField")}</Link>}</dd>
    </div>
  );

  return (
    <div className="dash" data-company-profile="">
      {saved && <p role="status" className="dash-notice">{t("savedNotice")}</p>}

      {/* Bandeau de completion (comme le bandeau de verification de la reference). */}
      <section className="dash-banner" aria-labelledby="company-title" data-completion={percent}>
        <h1 id="company-title">{tc("title", { name: company.company_name })}</h1>
        <div className="dash-pills" data-status="">
          <span>{published ? t("statusPublished") : t("statusDraft")}</span>
          <span>{company.verified ? tc("badgeVerified") : tc("badgeNotVerified")}</span>
          <span>{[company.city, wilaya].filter(Boolean).join(", ") || "-"}</span>
        </div>
        <p className="dash-banner-sub">{percent >= 100 ? tc("bannerDone") : tc("bannerText", { percent })}</p>
        <div className="dash-banner-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t("completionTitle")}><span style={{ width: `${percent}%` }} /></div>
        {missing.length > 0 && (
          <ul className="profile-missing" aria-label={tc("bannerMissing")}>
            {missing.map((c) => <li key={c.key}><Link href={CHECK_TARGET[c.key] ?? "/company"}>{t(c.key)}</Link></li>)}
          </ul>
        )}
        {published ? (
          <Link href={`/producers/${company.slug}`} className="dash-banner-btn">{tc("viewPublic")}</Link>
        ) : (
          <p className="dash-banner-note" title={tc("viewPublicDraftHint")}>{tc("viewPublicDraft")} · {tc("viewPublicDraftHint")}</p>
        )}
      </section>

      {/* Informations sur l'entreprise */}
      <section className="dash-card" id="identity" aria-labelledby="identity-title" data-section="identity" data-editing={editing === "identity" || undefined}>
        <div className="dash-cardhead">
          <div><h2 id="identity-title">{tc("identityTitle")}</h2><p>{tc("identityHelp")}</p></div>
          {editing === "identity"
            ? <Link href="/company#identity" className="dash-btn">{tc("close")}</Link>
            : <Link href="/company?tab=identity#identity" className="dash-btn">{tc("edit")}</Link>}
        </div>
        {editing === "identity" ? (
          <IdentityForm
            mode="edit"
            defaults={{
              companyName: company.company_name,
              legalForm: company.legal_form ?? "",
              sector: company.sector ?? "",
              activityCode: company.activity_code ?? "",
              activityDescription: company.activity_description ?? "",
              nif: priv?.tax_id ?? "",
              nis: priv?.nis ?? "",
              taxArticle: priv?.tax_article ?? "",
              rc: priv?.rc_number ?? "",
              wilaya: company.wilaya ?? "",
              city: company.city ?? "",
              address: priv?.address ?? "",
              phone: priv?.contact_phone ?? "",
              whatsapp: priv?.contact_whatsapp ?? "",
              exportConsent: company.africanex_export_consent,
            }}
          />
        ) : (
          <div className="profile-identity">
            <div className="profile-logo">
              {company.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logo_url} alt={t("logoAlt")} />
              ) : (
                <Link href="/company?tab=presentation#presentation" className="profile-logo-add"><span>{tc("addLogo")}</span><b aria-hidden="true">+</b></Link>
              )}
            </div>
            <dl className="profile-rows">
              {row(tc("fieldLegalName"), <>{company.company_name}{company.legal_form ? ` · ${company.legal_form}` : ""}</>, "identity")}
              {row(tc("fieldActivity"), company.activity_code ? <><span dir="ltr">{company.activity_code}</span>{company.activity_description ? ` · ${company.activity_description}` : ""}{company.sector && isSector(company.sector) ? <span className="dash-tag" style={{ marginInlineStart: 8 }}>{ts(company.sector)}</span> : null}</> : null, "identity")}
              {row(tc("location"), [company.city, wilaya].filter(Boolean).join(", "), "identity")}
              {row(tc("fieldAddress"), priv?.address, "identity")}
              {row(tc("fieldPhone"), priv?.contact_phone ? <span dir="ltr">{priv.contact_phone}</span> : null, "identity")}
              {row(tc("fieldWhatsapp"), priv?.contact_whatsapp ? <span dir="ltr">{priv.contact_whatsapp}</span> : null, "identity")}
              {row(tc("fieldTax"), taxComplete ? tc("taxComplete") : null, "identity")}
              {row(tc("fieldExport"), company.africanex_export_consent ? tc("exportYes") : tc("exportNo"), "identity")}
            </dl>
          </div>
        )}
        <p className="dash-muted">{t("sidePrivate")}</p>
      </section>

      {/* A propos de l'entreprise */}
      <section className="dash-card" id="presentation" aria-labelledby="presentation-title" data-section="presentation" data-editing={editing === "presentation" || undefined}>
        <div className="dash-cardhead">
          <div><h2 id="presentation-title">{tc("presentationTitle")}</h2><p>{tc("presentationHelp")}</p></div>
          {editing === "presentation"
            ? <Link href="/company#presentation" className="dash-btn">{tc("close")}</Link>
            : <Link href="/company?tab=presentation#presentation" className="dash-btn">{tc("edit")}</Link>}
        </div>
        {editing === "presentation" ? (
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
        ) : description ? (
          <>
            <p className="profile-description">{description}</p>
            <div className="profile-langs" aria-label={tc("fieldLanguages")}>
              {(["fr", "en", "ar"] as const).map((l) => {
                const ok = Boolean(company[`description_${l}`]);
                return <span key={l} className="dash-tag" data-ok={ok || undefined}>{l.toUpperCase()} {ok ? "✓" : `· ${tc("missing")}`}</span>;
              })}
            </div>
            <dl className="profile-rows profile-rows-inline">
              {row(tc("fieldWebsite"), company.website ? <a href={company.website} target="_blank" rel="noopener noreferrer" dir="ltr" className="underline">{company.website.replace(/^https?:\/\//, "")}</a> : null, "presentation")}
              {row(tc("statFounded"), company.founded_year ? String(company.founded_year) : null, "presentation")}
              {row(tc("statHeadcount"), company.headcount ? tc("statHeadcountValue", { range: company.headcount }) : null, "presentation")}
              {row(tc("statProducts"), tc("statProductsValue", { published: publishedCount ?? 0, total: productCount ?? 0 }), "presentation")}
              {row(tc("statViews"), format.number(views), "presentation")}
            </dl>
          </>
        ) : (
          <div className="profile-empty">
            <span className="dash-empty-ico"><AppIcon name="chat" size={22} /></span>
            <p>{tc("descriptionEmpty")}</p>
            <Link href="/company?tab=presentation#presentation" className="profile-empty-btn">{tc("addDescription")}</Link>
          </div>
        )}
      </section>

      {/* Documents et certifications */}
      <section className="dash-card" id="documents" aria-labelledby="documents-title" data-section="documents">
        <div className="dash-cardhead">
          <div><h2 id="documents-title">{tc("documentsTitle")}</h2><p>{tc("documentsHelp")}</p></div>
          <span className="dash-tag">{tc("labelsTitle")} · {verifiedDocs?.length ?? 0}</span>
        </div>
        {verifiedDocs && verifiedDocs.length > 0 && (
          <ul className="profile-labels">
            {verifiedDocs.map((d) => (
              <li key={d.id}><AppIcon name="check" size={16} /><span>{d.title || td(`kind_${d.kind}`)}</span>{d.expires_on && <small>{format.dateTime(new Date(`${d.expires_on}T12:00:00`), { dateStyle: "medium" })}</small>}</li>
            ))}
          </ul>
        )}
        <DocumentsPanel client={user.supabase} companyId={company.id} locale={locale} notice={doc} />
      </section>

      <section className="dash-card dash-contact" aria-labelledby="contact-title">
        <div>
          <h2 id="contact-title">{tc("contactTitle")}</h2>
          <p className="dash-muted">{tc("contactText")}</p>
        </div>
        <div className="dash-contact-lines">
          <a href="mailto:sarlafricanex@gmail.com" dir="ltr"><AppIcon name="mail" size={18} />sarlafricanex@gmail.com</a>
          <a href="tel:+213770960270" dir="ltr"><AppIcon name="chat" size={18} />+213 770 96 02 70</a>
        </div>
      </section>

      <AccountDeletion locale={locale} supabase={user.supabase} notice={deletion} />
    </div>
  );
}
