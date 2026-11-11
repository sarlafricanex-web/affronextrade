import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyCompanyId, listProducts, productImages } from "@/lib/data/company";
import { DeleteProductButton } from "@/components/catalog/DeleteProductButton";

export const instant = false;

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

  const [c, t, format, products, { saved, deleted }] = await Promise.all([
    getTranslations({ locale, namespace: "catalog" }),
    getTranslations({ locale, namespace: "onboarding" }),
    getFormatter({ locale }),
    listProducts(user.supabase, companyId),
    searchParams,
  ]);
  const published = products.filter((p) => p.status === "published").length;
  const cell = "py-3 px-4";

  return (
    <div className="flex flex-col gap-8">
      {(saved || deleted) && (
        <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid var(--accent)" }}>
          {saved ? c("savedNotice") : c("deletedNotice")}
        </p>
      )}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{c("eyebrow")}</p>
          <h1 className="mt-2 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{c("title")}</h1>
          <p className="mt-3" style={{ color: "var(--muted)" }}>{c("summary", { total: products.length, published })}</p>
        </div>
        <Link href="/catalog/new" className="px-5 py-3 text-sm font-bold uppercase" style={{ background: "var(--ink)", color: "white", letterSpacing: "0.08em" }}>
          {c("addProduct")}
        </Link>
      </header>

      {products.length === 0 ? (
        <section className="p-8" style={{ background: "white", border: "1px solid var(--field-b)" }}>
          <h2 className="font-extrabold" style={{ fontSize: "var(--step-heading)" }}>{c("emptyTitle")}</h2>
          <p className="mt-3" style={{ color: "var(--muted)" }}>{c("emptyText")}</p>
        </section>
      ) : (
        <div className="relative overflow-x-auto" style={{ background: "white", border: "1px solid var(--field-b)" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--field-b)" }}>
                <th scope="col" className={`${cell} text-start font-semibold`}><span className="sr-only">{c("photoAlt")}</span></th>
                <th scope="col" className={`${cell} text-start font-semibold`}>{c("colProduct")}</th>
                <th scope="col" className={`${cell} text-start font-semibold whitespace-nowrap`}>{c("colHs")}</th>
                <th scope="col" className={`${cell} text-start font-semibold whitespace-nowrap`}>{c("colPrice")}</th>
                <th scope="col" className={`${cell} text-start font-semibold whitespace-nowrap`}>{c("colMoq")}</th>
                <th scope="col" className={`${cell} text-start font-semibold`}>{c("colStatus")}</th>
                <th scope="col" className={cell}><span className="sr-only">{c("colActions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const photo = productImages(p)[0];
                const unit = p.unit ? t(`unit_${p.unit}`) : "";
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--field-b)" }}>
                    <td className={cell}>
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo.url} alt="" className="h-12 w-12 object-cover" />
                      ) : (
                        <span className="block h-12 w-12" style={{ background: "var(--field-a)" }} />
                      )}
                    </td>
                    <td className={`${cell} font-semibold`}>
                      <Link href={`/catalog/${p.id}`} className="hover:underline">{p.product_name}</Link>
                    </td>
                    <td className={`${cell} whitespace-nowrap`} dir="ltr">{p.hs_code ?? "-"}</td>
                    <td className={`${cell} whitespace-nowrap`}>
                      {p.unit_price_ht != null && p.currency ? `${format.number(Number(p.unit_price_ht), { style: "currency", currency: p.currency })} ${p.price_basis ?? ""}` : "-"}
                    </td>
                    <td className={`${cell} whitespace-nowrap`}>
                      {p.min_order_quantity != null ? `${format.number(Number(p.min_order_quantity))} ${unit}` : "-"}
                    </td>
                    <td className={cell}>
                      <span className="px-2 py-1 text-xs font-bold uppercase" style={{ letterSpacing: "0.06em", background: p.status === "published" ? "var(--accent)" : "var(--field-a)", color: p.status === "published" ? "white" : "var(--ink)" }}>
                        {c(`status_${p.status === "published" ? "published" : "draft"}`)}
                      </span>
                    </td>
                    <td className={`${cell} whitespace-nowrap`}>
                      <div className="flex items-center justify-end gap-4">
                        <Link href={`/catalog/${p.id}`} className="text-xs font-bold uppercase" style={{ color: "var(--accent)", letterSpacing: "0.08em" }}>{c("edit")}</Link>
                        <DeleteProductButton id={p.id} name={p.product_name} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm" style={{ color: "var(--muted)" }}>{c("visibilityNote")}</p>
    </div>
  );
}
