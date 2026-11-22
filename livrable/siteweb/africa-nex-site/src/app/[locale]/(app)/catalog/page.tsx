import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { countRecentViews, getMyCompanyId, getSupplierPricing, listProducts, productImages } from "@/lib/data/company";
import { DefaultTiersForm } from "@/components/catalog/DefaultTiersForm";
import { CatalogTable, type CatalogRow } from "@/components/catalog/CatalogTable";
import { priceStatus, tierValues, todayIso } from "@/lib/catalog/price-list";

export const instant = false;

// Catalogue du producteur d'apres la maquette Stitch 06, alimente uniquement par ses vraies donnees.
const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

function Tile({ label, value, unit, hint, tone = "ink" }: { label: string; value: string | number; unit?: string; hint: string; tone?: "ink" | "accent" | "warn" }) {
  const color = tone === "accent" ? "#065f46" : tone === "warn" ? "#c2410c" : "var(--ink)";
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
  searchParams: Promise<{ saved?: string; deleted?: string; imported?: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "producer") redirect(`/${locale}/dashboard`);
  const companyId = await getMyCompanyId(user.supabase, user.userId);
  if (!companyId) redirect(`/${locale}/onboarding`);

  const [c, format, products, { saved, deleted, imported }, views, pricing] = await Promise.all([
    getTranslations({ locale, namespace: "catalog" }),
    getFormatter({ locale }),
    listProducts(user.supabase, companyId),
    searchParams,
    countRecentViews(user.supabase, companyId),
    getSupplierPricing(user.supabase, companyId),
  ]);
  const published = products.filter((p) => p.status === "published").length;
  const drafts = products.length - published;
  const withoutPhoto = products.filter((p) => productImages(p).length === 0).length;
  // Unites courtes dans le tableau (L, kg, t...) : les libelles complets le font deborder.
  const unit = (u: string | null) => (u ? c(`unitShort_${u}`) : "");
  const today = todayIso();

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
    sku: p.sku,
    validity: { ...priceStatus(p.price_valid_until, today), date: p.price_valid_until ? format.dateTime(new Date(`${p.price_valid_until}T12:00:00`), { dateStyle: "medium" }) : null },
    stockDate: p.stock_updated_at ? format.dateTime(new Date(p.stock_updated_at), { dateStyle: "medium" }) : null,
  }));
  const stale = rows.filter((r) => r.validity.state !== "ok").length;

  return (
    <div className="flex flex-col gap-6">
      {(saved || deleted || imported) && (
        <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #10b981" }}>
          {imported ? c("importedNotice", { count: Number(imported) || 0 }) : saved === "tiers" ? c("tiersSaved") : saved ? c("savedNotice") : c("deletedNotice")}
        </p>
      )}

      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <nav aria-label={c("breadcrumb")} className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
            <Link href="/dashboard" className="hover:underline">{c("eyebrow")}</Link>
            <span aria-hidden="true" style={{ color: HAIR }}>/</span>
            <span style={{ color: "#065f46" }}>{c("title")}</span>
          </nav>
          <h1 className="font-extrabold uppercase" style={{ fontSize: "clamp(1.6rem, 3vw, 2.25rem)", lineHeight: 1.1, letterSpacing: "-0.025em", borderInlineStart: "4px solid #10b981", paddingInlineStart: "0.75rem" }}>{c("pageTitle")}</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{c("summary", { total: products.length, published })}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {/* Liste de prix en Excel : modele selon le forfait, pre-rempli avec les references. */}
          <a href={`/api/catalog/price-list?locale=${locale}`} className="flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)", background: "white", color: "var(--ink)" }} data-download="price-list">
            {c("downloadPriceList")}
          </a>
          <Link href="/catalog/import" className="flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase" style={{ ...caps, border: "1px solid var(--ink)", background: "white", color: "var(--ink)" }}>
            {c("importPriceList")}
          </Link>
          <Link href="/catalog/new" className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold uppercase" style={{ ...caps, background: "var(--ink)", color: "white" }}>
            <span aria-hidden="true" className="text-base leading-none">+</span>
            {c("addProduct")}
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Tile label={c("tileProducts")} value={String(products.length).padStart(2, "0")} unit={c("tileProductsUnit")} hint={c("tileProductsHint", { published })} />
        <Tile label={c("tileDrafts")} value={drafts} hint={c("tileDraftsHint")} tone={drafts ? "warn" : "ink"} />
        <Tile label={c("tilePhotos")} value={withoutPhoto} hint={c("tilePhotosHint")} tone={withoutPhoto ? "warn" : "accent"} />
        <Tile label={c("tileStale")} value={stale} hint={c("tileStaleHint")} tone={stale ? "warn" : "accent"} />
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

      {/* Marge de negociation par defaut : confidentielle, visible par AFRICA NEX seulement. */}
      <section className="flex flex-col gap-3 p-5" style={{ background: "white", border: `1px solid ${HAIR}`, borderInlineStart: "4px solid #f97316" }} aria-labelledby="tiers-title">
        <h2 id="tiers-title" className="font-extrabold" style={{ fontSize: "1.1rem" }}>{c("tiersDefaultTitle")}</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>{c("tiersDefaultHelp")}</p>
        <DefaultTiersForm defaults={tierValues(pricing.discount_tiers)} />
      </section>

      <p className="text-sm" style={{ color: "var(--muted)" }}>{c("visibilityNote")}</p>
    </div>
  );
}
