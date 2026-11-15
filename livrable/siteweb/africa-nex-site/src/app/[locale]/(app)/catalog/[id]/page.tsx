import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCompanyTier, getMyCompanyId, getProduct } from "@/lib/data/company";
import { toEditorProduct } from "@/lib/catalog/editor";
import { ProductEditor } from "@/components/catalog/ProductEditor";

export const instant = false;

// /catalog/new : nouveau produit ; /catalog/<id> : modification (uniquement un produit de sa propre entreprise).
// Mise en page d'apres la maquette Stitch 07.
export default async function ProductEditorPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);
  const companyId = await getMyCompanyId(user.supabase, user.userId);
  if (!companyId) redirect(`/${locale}/onboarding`);

  const isNew = id === "new";
  const [product, tier] = await Promise.all([isNew ? null : getProduct(user.supabase, companyId, id), getCompanyTier(user.supabase, companyId)]);
  if (!isNew && !product) notFound();
  const c = await getTranslations({ locale, namespace: "catalog" });
  const published = product?.status === "published";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-3 pb-5 lg:flex-row lg:items-end" style={{ borderBottom: "1px solid #d8cebb" }}>
        <div className="min-w-0">
          <nav aria-label={c("breadcrumb")} className="mb-2 flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
            <Link href="/catalog" className="hover:underline">{c("title")}</Link>
            <span aria-hidden="true">/</span>
            <span className="font-semibold" style={{ color: "var(--ink)" }}>{isNew ? c("newTitle") : product!.product_name}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-extrabold" style={{ fontSize: "clamp(1.6rem, 3vw, 2.25rem)", lineHeight: 1.15, letterSpacing: "-0.025em" }}>
              {isNew ? c("newTitle") : product!.product_name}
            </h1>
            <span
              className="px-2 py-1 text-xs font-bold uppercase"
              style={{ letterSpacing: "0.08em", ...(published ? { background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46" } : { background: "#f5efe6", border: "1px solid #d8cebb", color: "var(--muted)" }) }}
            >
              {c(published ? "status_published" : "status_draft")}
            </span>
          </div>
        </div>
        <p className="text-sm" style={{ color: "var(--muted)" }}>{c("editorSubtitle")}</p>
      </header>
      <ProductEditor product={toEditorProduct(product)} tier={tier} />
    </div>
  );
}
