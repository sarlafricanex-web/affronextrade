import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyCompanyId, getProduct } from "@/lib/data/company";
import { toEditorProduct } from "@/lib/catalog/editor";
import { ProductEditor } from "@/components/catalog/ProductEditor";

export const instant = false;

// /catalog/new : nouveau produit ; /catalog/<id> : modification (uniquement un produit de sa propre entreprise).
export default async function ProductEditorPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);
  const companyId = await getMyCompanyId(user.supabase, user.userId);
  if (!companyId) redirect(`/${locale}/onboarding`);

  const isNew = id === "new";
  const product = isNew ? null : await getProduct(user.supabase, companyId, id);
  if (!isNew && !product) notFound();
  const c = await getTranslations({ locale, namespace: "catalog" });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{c("eyebrow")}</p>
        <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>
          {isNew ? c("newTitle") : product!.product_name}
        </h1>
      </header>
      <section style={{ background: "white", border: "1px solid var(--field-b)", padding: "clamp(1.25rem, 3vw, 2rem)" }}>
        <ProductEditor product={toEditorProduct(product)} />
      </section>
    </div>
  );
}
