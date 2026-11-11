import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { countRecentViews, getMyCompanyId, listProducts, productImages } from "@/lib/data/company";
import { CatalogTable, type CatalogRow } from "@/components/catalog/CatalogTable";

export const instant = false;

// Catalogue du producteur d'apres la maquette Stitch 06, alimente uniquement par ses vraies donnees.
const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

function Tile({ label, value, unit, hint, tone = "ink" }: { label: string; value: string | number; unit?: string; hint: string; tone?: "ink" | "accent" | "warn" }) {
  const color = tone === "accent" ? "#059669" : tone === "warn" ? "#f97316" : "var(--ink)";
  return (
    <div className="flex flex-col gap-2 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
      <p className="text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{label}</p>
      <p className="flex items-baseline gap-2">
        <span className="font-extrabold" style={{ fontSize: "2.25rem", lineHeight: 1, color, fontFeatureSettings: '"tnum" 1' }}>{value}</span>
        {unit && <span className="text-xs font-bold uppercase" style={caps}>{unit}</span>}
      </p>
      <p className="text-xs" style={{ color: "var(--muted)" }}>{hint}</p>
    </div>
  );
}

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);
  const companyId = await getMyCompanyId(user.supabase, user.userId);
  if (!companyId) redirect(`/${locale}/onboarding`);

  const [c, format, products, { saved, deleted }, views] = await Promise.all([
    getTranslations({ locale, namespace: "catalog" }),
    getFormatter({ locale }),
    listProducts(user.supabase, companyId),
    searchParams,
    countRecentViews(user.supabase, companyId),
  ]);
  const published = products.filter((p) => p.status === "published").length;
  const drafts = products.length - published;
  const withoutPhoto = products.filter((p) => productImages(p).length === 0).length;
  // Unites courtes dans le tableau (L, kg, t...) : les libelles complets le font deborder.
  const unit = (u: string | null) => (u ? c(`unitShort_${u}`) : "");

  const rows: CatalogRow[] = products.map((p) => ({
    id: p.id,
    name: p.product_name,
    description: p.description_fr ?? p.description_en ?? p.description_ar,
    photo: productImages(p)[0]?.url ?? null,
    hsCode: p.hs_code,
    price: p.unit_price_ht != null && p.currency ? `${format.number(Number(p.unit_price_ht), { style: "currency", currency: p.currency })}${p.unit ? ` / ${unit(p.unit)}` : ""}` : null,
    priceBasis: p.price_basis,
    moq: p.min_order_quantity != null ? `${format.number(Number(p.min_order_quantity))} ${unit(p.unit)}` : null,
    packaging: p.packaging,
    stock: p.stock_quantity != null ? `${format.number(Number(p.stock_quantity))} ${unit(p.unit)}` : null,
    status: p.status === "published" ? "published" : "draft",
  }));

  return (
    <div className="flex flex-col gap-6">
      {(saved || deleted) && (
        <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #10b981" }}>
          {saved ? c("savedNotice") : c("deletedNotice")}
        </p>
      )}

      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <nav aria-label={c("breadcrumb")} className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
            <Link href="/dashboard" className="hover:underline">{c("eyebrow")}</Link>
            <span aria-hidden="true" style={{ color: HAIR }}>/</span>
            <span style={{ color: "#059669" }}>{c("title")}</span>
          </nav>
          <h1 className="font-extrabold uppercase" style={{ fontSize: "clamp(1.6rem, 3vw, 2.25rem)", lineHeight: 1.1, letterSpacing: "-0.025em", borderInlineStart: "4px solid #10b981", paddingInlineStart: "0.75rem" }}>{c("pageTitle")}</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{c("summary", { total: products.length, published })}</p>
        </div>
        <Link href="/catalog/new" className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold uppercase" style={{ ...caps, background: "var(--ink)", color: "white" }}>
          <span aria-hidden="true" className="text-base leading-none">+</span>
          {c("addProduct")}
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label={c("tileProducts")} value={String(products.length).padStart(2, "0")} unit={c("tileProductsUnit")} hint={c("tileProductsHint", { published })} />
        <Tile label={c("tileDrafts")} value={drafts} hint={c("tileDraftsHint")} tone={drafts ? "warn" : "ink"} />
        <Tile label={c("tilePhotos")} value={withoutPhoto} hint={c("tilePhotosHint")} tone={withoutPhoto ? "warn" : "accent"} />
        <Tile label={c("tileViews")} value={views} hint={c("tileViewsHint")} tone="accent" />
      </div>

      {products.length === 0 ? (
        <section className="p-8" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <h2 className="font-extrabold" style={{ fontSize: "1.25rem" }}>{c("emptyTitle")}</h2>
          <p className="mt-3" style={{ color: "var(--muted)" }}>{c("emptyText")}</p>
        </section>
      ) : (
        <CatalogTable rows={rows} />
      )}

      <p className="text-sm" style={{ color: "var(--muted)" }}>{c("visibilityNote")}</p>
    </div>
  );
}
