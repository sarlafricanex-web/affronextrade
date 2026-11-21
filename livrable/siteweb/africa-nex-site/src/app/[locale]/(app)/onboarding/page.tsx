import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getFirstProduct, getMyCompany } from "@/lib/data/company";
import { ProductForm } from "@/components/onboarding/ProductForm";
import { IdentityForm } from "@/components/onboarding/IdentityForm";
import { PresentationForm } from "@/components/onboarding/PresentationForm";
import { BuyerForm } from "@/components/onboarding/BuyerForm";
import { buyerDefaults } from "@/lib/onboarding/buyer";
import { WILAYAS } from "@/lib/onboarding/reference";
import { isSector } from "@/lib/sectors";

export const instant = false;

type User = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

// Acheteur : un seul ecran (entreprise, pays, contacts, secteurs recherches).
async function BuyerOnboarding({ locale, user, next }: { locale: string; user: User; next?: string }) {
  const [t, tr, defaults] = await Promise.all([
    getTranslations({ locale, namespace: "onboarding" }),
    getTranslations({ locale, namespace: "rfq" }),
    buyerDefaults(user.supabase, user.userId),
  ]);
  // Venu de "Demander un devis" : il retrouvera son formulaire juste apres ce profil.
  const fromRfq = next && /^\/(fr|en|ar)\/rfq\/new(\?[\w=&%-]*)?$/.test(next) ? next : undefined;
  return (
    <div className="flex flex-col gap-8">
      {fromRfq && (
        <p role="note" className="p-4 text-sm font-semibold" style={{ background: "white", borderInlineStart: "4px solid #10b981" }}>{tr("profileFirstBanner")}</p>
      )}
      <header>
        <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("buyerEyebrow")}</p>
        <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("buyerTitle")}</h1>
        <p className="mt-3" style={{ color: "var(--muted)", maxWidth: "60ch" }}>{t("buyerIntro")}</p>
      </header>
      <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
        <section style={{ background: "white", border: "1px solid var(--field-b)", padding: "clamp(1.25rem, 3vw, 2rem)" }}>
          <BuyerForm defaults={defaults} next={fromRfq} />
        </section>
        <aside className="flex flex-col gap-4 p-5" style={{ background: "white", border: "1px solid var(--field-b)" }}>
          <h2 className="font-bold">{t("sideTitle")}</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("buyerSideIntermediary")}</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("buyerSideInterests")}</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("sideHelp")}</p>
        </aside>
      </div>
    </div>
  );
}

const STEPS = ["stepIdentity", "stepPresentation", "stepProduct"] as const;

export default async function OnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ step?: string; next?: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role === "buyer") return <BuyerOnboarding locale={locale} user={user} next={(await searchParams).next} />;
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);

  const [t, company, { step }] = await Promise.all([
    getTranslations({ locale, namespace: "onboarding" }),
    getMyCompany(user.supabase, user.userId),
    searchParams,
  ]);
  // Les etapes 2 et 3 supposent l'entreprise creee a l'etape 1.
  const current = company && (step === "2" || step === "3") ? Number(step) : 1;
  const [product, { data: pendingClaim }] = await Promise.all([
    company ? getFirstProduct(user.supabase, company.id) : Promise.resolve(null),
    company
      ? Promise.resolve({ data: null })
      : user.supabase.from("company_claims").select("companies(company_name, slug)").eq("profile_id", user.userId).eq("status", "pending").maybeSingle(),
  ]);
  const claimed = pendingClaim?.companies as { company_name: string; slug: string } | null | undefined;
  const done = [Boolean(company), Boolean(company?.description_fr), Boolean(product)];
  const [ts, tsec] = await Promise.all([
    getTranslations({ locale, namespace: "setup" }),
    getTranslations({ locale, namespace: "sectors" }),
  ]);
  type StepState = "current" | "done" | "todo" | "locked";
  const stateOf = (i: number): StepState => (i + 1 === current ? "current" : done[i] ? "done" : !company && i > 0 ? "locked" : "todo");
  const wilaya = company?.wilaya ? WILAYAS.find(([code]) => code === company.wilaya) : undefined;
  const sectorLabel = company?.sector && isSector(company.sector) ? tsec(company.sector) : null;
  const productImage = (Array.isArray(product?.images) ? (product.images[0] as { url?: string } | undefined)?.url : undefined) ?? null;

  // Progression : les 3 etapes, avec leur vrai etat.
  const progress = (
    <Panel title={ts("progressTitle")}>
      <ol className="flex flex-col gap-2">
        {STEPS.map((key, i) => {
          // Une etape deja enregistree reste cochee, meme quand on y revient pour la modifier.
          const s = done[i] ? "done" : stateOf(i);
          return (
            <li key={key} className="flex items-start gap-3 p-3" style={{ background: s === "done" ? "#ecfdf5" : "#fff8f3", border: `1px solid ${s === "done" ? "#10b981" : HAIR}` }}>
              <span aria-hidden="true" className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[10px] font-bold" style={s === "done" ? { background: "#059669", color: "white" } : { border: `1px solid ${HAIR}`, background: "white" }}>{s === "done" ? "✓" : ""}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold" style={{ color: s === "done" ? "#065f46" : "var(--ink)" }}>{t(key)}</span>
                <span className="block text-xs" style={{ color: "var(--muted)" }}>{ts(`progress${i + 1}`)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
  const assistance = (
    <Panel title={ts("assistTitle")}>
      <p className="text-sm" style={{ color: "var(--muted)" }}>{ts("assistText")}</p>
      <p className="mt-3 text-sm font-semibold" dir="ltr" style={{ textAlign: "start" }}>sarlafricanex@gmail.com</p>
      <p className="text-sm font-semibold" dir="ltr" style={{ textAlign: "start" }}>+213 770 96 02 70</p>
    </Panel>
  );
  const row = (label: string, value: string | null) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm" style={{ borderBottom: `1px dashed ${HAIR}` }}>
      <dt style={{ color: "var(--muted)" }}>{label}</dt>
      <dd className="text-end font-semibold" style={{ color: value ? "var(--ink)" : "#c2410c" }}>{value ?? ts("missing")}</dd>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* En-tete d'apres la maquette Stitch 04, sans les references administratives inventees. */}
      <header className="p-5 md:p-6" style={{ background: "#f5efe6", border: `1px solid ${HAIR}` }}>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
          <Link href="/dashboard" className="hover:underline">{t("eyebrow")}</Link>
          <span aria-hidden="true" style={{ color: HAIR }}>/</span>
          <span style={{ color: "var(--ink)" }}>{ts("breadcrumb")}</span>
          <span className="px-2 py-0.5" style={company ? { background: "#f5efe6", border: `1px solid ${HAIR}`, color: "var(--muted)" } : { background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46" }}>
            {company ? t("statusDraft") : ts("statusNew")}
          </span>
        </div>
        <h1 className="mt-3 font-extrabold uppercase" style={{ fontSize: "clamp(1.5rem, 3vw, 2.1rem)", lineHeight: 1.15, letterSpacing: "-0.025em" }}>{ts("title")}</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)", maxWidth: "70ch" }}>{t("intro")}</p>
      </header>

      {!company && (
        <p role="note" className="p-4 text-sm" style={{ background: "white", borderInlineStart: "4px solid var(--accent)" }}>
          {claimed ? (
            <>{t("claimPendingNotice", { name: claimed.company_name })}</>
          ) : (
            <>
              {t("alreadyListed")}{" "}
              <Link href="/producers" className="font-bold underline">{t("alreadyListedLink")}</Link>
            </>
          )}
        </p>
      )}

      {/* Les 3 etapes : validee, en cours, a faire ou verrouillee (entreprise pas encore creee). */}
      <ol className="grid sm:grid-cols-3" style={{ border: `1px solid ${HAIR}`, background: "#f5efe6" }}>
        {STEPS.map((key, index) => {
          const number = index + 1;
          const s = stateOf(index);
          const active = s === "current";
          const content = (
            <span className="flex h-full items-center gap-3 p-4" style={{ borderBottom: `4px solid ${active ? "#10b981" : "transparent"}` }}>
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center text-sm font-bold"
                style={active ? { background: "#10b981", color: "white" } : s === "done" ? { background: "white", border: "1px solid #10b981", color: "#059669" } : { background: "white", border: `1px solid ${HAIR}`, color: "var(--muted)" }}
              >
                {s === "done" ? "✓" : s === "locked" ? <LockIcon /> : String(number).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase" style={{ ...caps, color: active ? "#6ee7b7" : s === "done" ? "#059669" : "var(--muted)" }}>
                  {active ? t("stateCurrent") : s === "done" ? ts("stateValidated") : s === "locked" ? ts("stateLocked") : t("stateTodo")}
                </span>
                <span className="block font-bold uppercase" style={{ fontSize: "0.85rem", letterSpacing: "0.02em" }}>{number}. {t(key)}</span>
              </span>
            </span>
          );
          return (
            <li
              key={key}
              aria-current={active ? "step" : undefined}
              style={{ background: active ? "var(--ink)" : "transparent", color: active ? "white" : s === "locked" ? "var(--muted)" : "var(--ink)", borderInlineEnd: index < 2 ? `1px solid ${HAIR}` : undefined }}
            >
              {s !== "locked" && !active ? <Link href={`/onboarding?step=${number}`} className="block h-full">{content}</Link> : content}
            </li>
          );
        })}
      </ol>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section style={{ background: "white", border: `1px solid ${HAIR}`, padding: "clamp(1.25rem, 3vw, 2rem)", minWidth: 0 }}>
          <p className="mb-5 pb-4 text-xs font-bold uppercase" style={{ ...caps, color: "var(--muted)", borderBottom: `1px solid ${HAIR}` }}>
            {ts(`ref${current}`)}
          </p>
          {current === 1 ? (
            <>
              <h2 className="sr-only">{t("identityTitle")}</h2>
              <p className="mb-6 text-sm" style={{ color: "var(--muted)" }}>{t("identityIntro")}</p>
              <IdentityForm
                defaults={{
                  companyName: company?.company_name ?? "",
                  legalForm: company?.legal_form ?? "",
                  sector: company?.sector ?? "",
                  activityCode: company?.activity_code ?? "",
                  activityDescription: company?.activity_description ?? "",
                  nif: company?.private?.tax_id ?? "",
                  nis: company?.private?.nis ?? "",
                  taxArticle: company?.private?.tax_article ?? "",
                  rc: company?.private?.rc_number ?? "",
                  wilaya: company?.wilaya ?? "",
                  city: company?.city ?? "",
                  address: company?.private?.address ?? "",
                  phone: company?.private?.contact_phone ?? "",
                  whatsapp: company?.private?.contact_whatsapp ?? "",
                  exportConsent: company?.africanex_export_consent ?? false,
                }}
              />
            </>
          ) : current === 2 && company ? (
            <>
              <h2 className="sr-only">{t("presentationTitle")}</h2>
              <p className="mb-6 text-sm" style={{ color: "var(--muted)" }}>{t("presentationIntro")}</p>
              <PresentationForm
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
            </>
          ) : current === 3 && company ? (
            <>
              <h2 className="sr-only">{t("productTitle")}</h2>
              <p className="mb-6 text-sm" style={{ color: "var(--muted)" }}>{t("productIntro")}</p>
              <ProductForm
                defaults={{
                  productName: product?.product_name ?? "",
                  hsCode: product?.hs_code ?? "",
                  price: product?.unit_price_ht != null ? String(product.unit_price_ht) : "",
                  currency: product?.currency ?? "",
                  priceBasis: product?.price_basis ?? "",
                  unit: product?.unit ?? "",
                  moq: product?.min_order_quantity != null ? String(product.min_order_quantity) : "",
                  photoUrl: productImage,
                }}
              />
            </>
          ) : (
            <>
              <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{t(STEPS[current - 1])}</h2>
              <p className="mt-3" style={{ color: "var(--muted)" }}>{t("comingSoon")}</p>
              <Link href="/dashboard" className="mt-6 inline-block px-5 py-3 text-sm font-bold uppercase" style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}>
                {t("backDashboard")}
              </Link>
            </>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          {current === 1 && (
            <Panel title={ts("summaryTitle")}>
              {company ? (
                <dl>
                  {row(t("legalForm"), company.legal_form)}
                  {row(t("wilaya"), wilaya ? `${wilaya[0]} · ${wilaya[1]}` : null)}
                  {row(ts("summarySector"), sectorLabel)}
                  {row("NIF", company.private?.tax_id ? ts("filled") : null)}
                  {row("NIS", company.private?.nis ? ts("filled") : null)}
                  {row(ts("summaryArticle"), company.private?.tax_article ? ts("filled") : null)}
                </dl>
              ) : (
                <p className="text-sm" style={{ color: "var(--muted)" }}>{ts("summaryEmpty")}</p>
              )}
              <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>{t("sidePrivate")}</p>
            </Panel>
          )}

          {current === 2 && company && (
            <Panel title={ts("previewTitle")}>
              <p className="mb-3 text-xs" style={{ color: "var(--muted)" }}>{ts("previewIntro")}</p>
              <div style={{ border: `1px solid ${HAIR}` }}>
                <div className="h-16" style={{ background: "#e5d8c8" }} />
                <div className="-mt-8 flex flex-col gap-2 px-4 pb-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden" style={{ background: "white", border: "2px solid var(--ink)" }}>
                    {company.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={company.logo_url} alt={t("logoAlt")} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-lg font-extrabold" style={{ color: "var(--muted)" }}>{company.company_name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <p className="font-extrabold uppercase" style={{ letterSpacing: "-0.01em" }}>{company.company_name}</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{[company.city, wilaya?.[1]].filter(Boolean).join(", ")}</p>
                  {sectorLabel && <span className="self-start px-2 py-0.5 text-[10px] font-bold uppercase" style={{ ...caps, background: "#f5efe6", border: `1px solid ${HAIR}` }}>{sectorLabel}</span>}
                  <p className="text-xs" style={{ background: "#fff8f3", border: `1px solid ${HAIR}`, padding: "0.6rem", color: company.description_fr ? "var(--ink)" : "var(--muted)" }}>
                    {company.description_fr ? `${company.description_fr.slice(0, 220)}${company.description_fr.length > 220 ? "…" : ""}` : ts("previewNoDescription")}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>{t("sideDraft")}</p>
            </Panel>
          )}

          {current === 3 && company && (
            <Panel title={ts("productPreviewTitle")}>
              <div style={{ border: `1px solid ${HAIR}` }}>
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden" style={{ background: "#f5efe6" }}>
                  {productImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs" style={{ color: "var(--muted)" }}>{ts("noPhoto")}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1 p-4">
                  <p className="font-extrabold uppercase">{product?.product_name || ts("productUnnamed")}</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{company.company_name}</p>
                  <dl className="mt-2">
                    {row(ts("productHs"), product?.hs_code ?? null)}
                    {row(ts("productMoq"), product?.min_order_quantity != null ? `${product.min_order_quantity} ${product.unit ? t(`unit_${product.unit}`) : ""}`.trim() : null)}
                  </dl>
                  <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>{ts("productPricePrivate")}</p>
                </div>
              </div>
            </Panel>
          )}

          {progress}
          {assistance}
        </aside>
      </div>
    </div>
  );
}

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
      <h2 className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#fff2e2", borderBottom: `1px solid ${HAIR}` }}>{title}</h2>
      <div className="p-5">{children}</div>
    </section>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
