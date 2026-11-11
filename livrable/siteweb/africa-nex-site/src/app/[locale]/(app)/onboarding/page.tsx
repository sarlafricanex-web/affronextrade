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

export const instant = false;

type User = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

// Acheteur : un seul ecran (entreprise, pays, contacts, secteurs recherches).
async function BuyerOnboarding({ locale, user }: { locale: string; user: User }) {
  const [t, defaults] = await Promise.all([
    getTranslations({ locale, namespace: "onboarding" }),
    buyerDefaults(user.supabase, user.userId),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("buyerEyebrow")}</p>
        <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("buyerTitle")}</h1>
        <p className="mt-3" style={{ color: "var(--muted)", maxWidth: "60ch" }}>{t("buyerIntro")}</p>
      </header>
      <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
        <section style={{ background: "white", border: "1px solid var(--field-b)", padding: "clamp(1.25rem, 3vw, 2rem)" }}>
          <BuyerForm defaults={defaults} />
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
  searchParams: Promise<{ step?: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role === "buyer") return <BuyerOnboarding locale={locale} user={user} />;
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);

  const [t, company, { step }] = await Promise.all([
    getTranslations({ locale, namespace: "onboarding" }),
    getMyCompany(user.supabase, user.userId),
    searchParams,
  ]);
  // Les etapes 2 et 3 supposent l'entreprise creee a l'etape 1.
  const current = company && (step === "2" || step === "3") ? Number(step) : 1;
  const product = company ? await getFirstProduct(user.supabase, company.id) : null;
  const done = [Boolean(company), Boolean(company?.description_fr), Boolean(product)];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("eyebrow")}</p>
        <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("title")}</h1>
        <p className="mt-3" style={{ color: "var(--muted)", maxWidth: "60ch" }}>{t("intro")}</p>
      </header>

      <ol className="grid sm:grid-cols-3" style={{ border: "1px solid var(--field-b)", background: "white" }}>
        {STEPS.map((key, index) => {
          const number = index + 1;
          const active = number === current;
          const reachable = number === 1 || Boolean(company);
          const content = (
            <span className="flex items-center gap-3 p-4">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center text-sm font-bold"
                style={{ background: active ? "var(--accent)" : done[index] ? "var(--ink)" : "var(--field-a)", color: active || done[index] ? "white" : "var(--muted)" }}
              >
                {done[index] && !active ? "✓" : number}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>
                  {active ? t("stateCurrent") : done[index] ? t("stateDone") : t("stateTodo")}
                </span>
                <span className="block font-bold">{t(key)}</span>
              </span>
            </span>
          );
          return (
            <li
              key={key}
              aria-current={active ? "step" : undefined}
              style={{ background: active ? "var(--ink)" : "transparent", color: active ? "white" : "var(--ink)", borderInlineEnd: index < 2 ? "1px solid var(--field-b)" : undefined }}
            >
              {reachable && !active ? <Link href={`/onboarding?step=${number}`}>{content}</Link> : content}
            </li>
          );
        })}
      </ol>

      <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
        <section style={{ background: "white", border: "1px solid var(--field-b)", padding: "clamp(1.25rem, 3vw, 2rem)" }}>
          {current === 1 ? (
            <>
              <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{t("identityTitle")}</h2>
              <p className="mt-2 mb-6 text-sm" style={{ color: "var(--muted)" }}>{t("identityIntro")}</p>
              <IdentityForm
                defaults={{
                  companyName: company?.company_name ?? "",
                  legalForm: company?.legal_form ?? "",
                  sector: company?.sector ?? "",
                  nif: company?.private?.tax_id ?? "",
                  rc: company?.private?.rc_number ?? "",
                  wilaya: company?.wilaya ?? "",
                  city: company?.city ?? "",
                  address: company?.private?.address ?? "",
                  phone: company?.private?.contact_phone ?? "",
                  whatsapp: company?.private?.contact_whatsapp ?? "",
                }}
              />
            </>
          ) : current === 2 && company ? (
            <>
              <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{t("presentationTitle")}</h2>
              <p className="mt-2 mb-6 text-sm" style={{ color: "var(--muted)" }}>{t("presentationIntro")}</p>
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
              <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{t("productTitle")}</h2>
              <p className="mt-2 mb-6 text-sm" style={{ color: "var(--muted)" }}>{t("productIntro")}</p>
              <ProductForm
                defaults={{
                  productName: product?.product_name ?? "",
                  hsCode: product?.hs_code ?? "",
                  price: product?.unit_price_ht != null ? String(product.unit_price_ht) : "",
                  currency: product?.currency ?? "",
                  priceBasis: product?.price_basis ?? "",
                  unit: product?.unit ?? "",
                  moq: product?.min_order_quantity != null ? String(product.min_order_quantity) : "",
                  photoUrl: (Array.isArray(product?.images) ? (product.images[0] as { url?: string } | undefined)?.url : undefined) ?? null,
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

        <aside className="flex flex-col gap-4 p-5" style={{ background: "white", border: "1px solid var(--field-b)" }}>
          <h2 className="font-bold">{t("sideTitle")}</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("sideDraft")}</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("sidePrivate")}</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("sideHelp")}</p>
        </aside>
      </div>
    </div>
  );
}
