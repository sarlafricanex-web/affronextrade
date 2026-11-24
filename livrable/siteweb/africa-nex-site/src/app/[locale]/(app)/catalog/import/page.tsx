import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canUse, getMyCompanyId } from "@/lib/data/company";
import { ImportForm } from "@/components/catalog/ImportForm";

export const instant = false;

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

// Import de la liste de prix Excel (modele telecharge depuis le catalogue).
export default async function CatalogImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);
  const companyId = await getMyCompanyId(user.supabase, user.userId);
  if (!companyId) redirect(`/${locale}/onboarding`);
  const [c, allowed] = await Promise.all([getTranslations({ locale, namespace: "catalog" }), canUse(user.supabase, companyId, "excel_import")]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <nav className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
          <Link href="/catalog" className="hover:underline">{c("title")}</Link>
          <span aria-hidden="true">/</span>
          <span style={{ color: "#065f46" }}>{c("importCrumb")}</span>
        </nav>
        <h1 className="font-extrabold" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", lineHeight: 1.15 }}>{c("importTitle")}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{c("importIntro")}</p>
      </header>
      {/* Passeport : import Excel reserve aux offres payantes ; la saisie a la main reste ouverte. */}
      {!allowed ? (
        <section className="flex flex-col gap-3 p-5" style={{ background: "white", border: `1px solid ${HAIR}`, borderInlineStart: "4px solid #10b981" }} data-import-locked="">
          <p className="font-bold">{c("importLockedTitle")}</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{c("importLockedText")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/subscription" className="px-4 py-3 text-center text-xs font-bold uppercase" style={{ ...caps, background: "#047857", color: "white" }}>{c("importLockedCta")}</Link>
            <Link href="/catalog" className="px-4 py-3 text-center text-xs font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)" }}>{c("importLockedManual")}</Link>
          </div>
        </section>
      ) : (<>
      <section className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between" style={{ background: "white", border: `1px solid ${HAIR}`, borderInlineStart: "4px solid #10b981" }}>
        <div>
          <p className="font-bold">{c("importTemplate")}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{c("importTemplateHelp")}</p>
        </div>
        <a href={`/api/catalog/price-list?locale=${locale}`} className="shrink-0 px-4 py-3 text-center text-xs font-bold uppercase" style={{ ...caps, background: "var(--ink)", color: "white" }}>{c("downloadPriceList")}</a>
      </section>
      <ImportForm />
      </>)}
    </div>
  );
}
