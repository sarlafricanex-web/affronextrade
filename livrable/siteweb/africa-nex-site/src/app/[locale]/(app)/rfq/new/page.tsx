import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getRfqContext } from "@/lib/data/rfq";
import { RfqForm } from "@/components/rfq/RfqForm";

export const instant = false;

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

// Nouvelle demande de devis (maquette 12), depuis un produit, une fiche producteur ou libre.
export default async function NewRfqPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ product?: string; producer?: string; profile?: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const [t, { product, producer, profile: profileSaved }] = await Promise.all([getTranslations({ locale, namespace: "rfq" }), searchParams]);

  const notice = (title: string, text: string, href: string, cta: string) => (
    <div className="flex flex-col gap-4 p-6" style={{ background: "white", border: `1px solid ${HAIR}`, maxWidth: 640 }}>
      <h1 className="font-extrabold" style={{ fontSize: "1.5rem" }}>{title}</h1>
      <p style={{ color: "var(--muted)" }}>{text}</p>
      <Link href={href} className="w-fit px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "var(--ink)", color: "white" }}>{cta}</Link>
    </div>
  );
  if (user.role !== "buyer") return notice(t("buyersOnlyTitle"), t("buyersOnlyText"), "/dashboard", t("backDashboard"));
  const { data: profile } = await user.supabase.from("profiles").select("onboarding_completed").eq("id", user.userId).single();
  if (!profile?.onboarding_completed) {
    // Profil d'abord, puis retour automatique sur ce formulaire (produit ou producteur conserves).
    const qs = new URLSearchParams({ ...(product ? { product } : {}), ...(producer ? { producer } : {}) }).toString();
    redirect(`/${locale}/onboarding?next=${encodeURIComponent(`/${locale}/rfq/new${qs ? `?${qs}` : ""}`)}`);
  }

  const context = await getRfqContext(user.supabase, { productId: product, producerSlug: producer });

  return (
    <div className="flex flex-col gap-6">
      {profileSaved && <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #10b981" }}>{t("profileSavedNotice")}</p>}
      <header>
        <nav aria-label={t("breadcrumb")} className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
          <Link href="/rfq" className="hover:underline">{t("navList")}</Link>
          <span aria-hidden="true" style={{ color: HAIR }}>/</span>
          <span style={{ color: "#065f46" }}>{t("newTitle")}</span>
        </nav>
        <h1 className="font-extrabold" style={{ fontSize: "clamp(1.5rem, 3vw, 2.1rem)", lineHeight: 1.15, letterSpacing: "-0.025em" }}>{t("newTitle")}</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)", maxWidth: "65ch" }}>{t("newIntro")}</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div style={{ minWidth: 0 }}>
          <RfqForm
            context={
              context
                ? { productId: context.productId, productName: context.productName, unit: context.unit, moq: context.moq, companyName: context.companyName, producerSlug: context.productId ? null : (producer ?? null), logistics: context.logistics }
                : null
            }
          />
        </div>
        <aside className="flex flex-col gap-4 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <h2 className="text-xs font-bold uppercase" style={caps}>{t("howTitle")}</h2>
          <ol className="flex flex-col gap-3 text-sm">
            {[1, 2, 3, 4].map((i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center text-xs font-bold" style={{ background: "#f5efe6", border: `1px solid ${HAIR}` }}>{i}</span>
                <span style={{ color: "var(--muted)" }}>{t(`how${i}`)}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
