import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAdminProducer } from "@/lib/data/admin-producers";
import { adminProducerAction } from "../actions";
import { AdminProducerForm } from "@/components/admin/AdminProducerForm";
import { ProducerOps } from "@/components/admin/ProducerOps";

export const instant = false;

// /admin/producers/new : creation pour le compte du producteur ; /admin/producers/<id> : modification.
export default async function AdminProducerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);

  const isNew = id === "new";
  const [t, td, producer, { done, error }] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getTranslations({ locale, namespace: "documents" }),
    isNew ? Promise.resolve(null) : getAdminProducer(user.supabase, id),
    searchParams,
  ]);
  if (!isNew && !producer) notFound();

  return (
    <div className="flex flex-col gap-8">
      {done && <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid var(--accent)" }}>{t(`opDone_${done}`)}</p>}
      {error && <p role="alert" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #dc2626" }}>{t(error === "verifyUnclaimed" ? "opVerifyUnclaimed" : "claimErrorGeneric")}</p>}
      <header>
        <Link href="/admin/producers" className="text-sm font-semibold" style={{ color: "var(--muted)" }}>← {t("producersTitle")}</Link>
        <h1 className="mt-3 font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{producer?.company_name ?? t("apNewTitle")}</h1>
        <p className="mt-3" style={{ color: "var(--muted)", maxWidth: "62ch" }}>
          {isNew ? t("apNewIntro") : `${t(`vis_${producer!.visibility}`)} · ${t(`claim_${producer!.claim_status}`)}${producer!.verified ? ` · ${t("badgeVerified")}` : ""}`}
        </p>
        {producer && (
          <div className="mt-4">
            <ProducerOps id={producer.id} locale={locale} visibility={producer.visibility} verified={producer.verified} claimed={producer.claim_status === "claimed"} back="edit" />
          </div>
        )}
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_320px]">
        <section style={{ background: "white", border: "1px solid var(--field-b)", padding: "clamp(1.25rem, 3vw, 2rem)" }}>
          <AdminProducerForm
            defaults={{
              id: producer?.id ?? "",
              companyName: producer?.company_name ?? "",
              sector: producer?.sector ?? "",
              wilaya: producer?.wilaya ?? "",
              city: producer?.city ?? "",
              descriptionFr: producer?.description_fr ?? "",
              descriptionEn: producer?.description_en ?? "",
              descriptionAr: producer?.description_ar ?? "",
              website: producer?.website ?? "",
              nif: producer?.private?.tax_id ?? "",
              contactEmail: producer?.private?.contact_email ?? "",
              contactPhone: producer?.private?.contact_phone ?? "",
            }}
          />
        </section>
        {producer && (
          <aside className="flex flex-col gap-3 p-5" style={{ background: "white", border: "1px solid var(--field-b)" }}>
            <h2 className="font-bold">{t("apProductList", { count: producer.products.length })}</h2>
            {producer.products.length === 0 && <p className="text-sm" style={{ color: "var(--muted)" }}>{t("apNoProducts")}</p>}
            <ul className="flex flex-col gap-2">
              {producer.products.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{p.product_name}{p.status !== "published" && <span className="ms-2 text-xs" style={{ color: "var(--muted)" }}>({t("draftShort")})</span>}</span>
                  {p.source !== "producer" && (
                    <form action={adminProducerAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={producer.id} />
                      <input type="hidden" name="op" value="removeProduct" />
                      <input type="hidden" name="productId" value={p.id} />
                      <input type="hidden" name="back" value="edit" />
                      <button type="submit" className="text-xs font-bold uppercase" style={{ color: "#dc2626" }} aria-label={`${t("apRemove")} ${p.product_name}`}>{t("apRemove")}</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{t("apProductsOwnerNote")}</p>

            <h2 className="mt-4 font-bold" style={{ borderTop: "1px solid var(--field-b)", paddingTop: "1rem" }}>{t("apDocuments", { count: producer.documents.length })}</h2>
            {producer.documents.length === 0 && <p className="text-sm" style={{ color: "var(--muted)" }}>{t("apNoDocuments")}</p>}
            <ul className="flex flex-col gap-3">
              {producer.documents.map((d) => (
                <li key={d.id} className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold">{d.title || td(`kind_${d.kind}`)}</span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {td(`kind_${d.kind}`)} · {d.is_public ? td("publicShort") : td("privateShort")}
                    {d.expires_on ? ` · ${d.expires_on}` : ""} · <strong>{td(`status_${d.review_status}`)}</strong>
                  </span>
                  <span className="flex flex-wrap items-center gap-3">
                    <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener" className="text-xs font-bold uppercase underline" style={{ color: "var(--accent)" }}>{td("open")}</a>
                    {d.review_status !== "accepted" && (
                      <form action={adminProducerAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={producer.id} />
                        <input type="hidden" name="op" value="acceptDoc" />
                        <input type="hidden" name="docId" value={d.id} />
                        <input type="hidden" name="back" value="edit" />
                        <button type="submit" className="text-xs font-bold uppercase" style={{ color: "var(--accent)" }}>{t("docAccept")}</button>
                      </form>
                    )}
                    {d.review_status !== "rejected" && (
                      <form action={adminProducerAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={producer.id} />
                        <input type="hidden" name="op" value="rejectDoc" />
                        <input type="hidden" name="docId" value={d.id} />
                        <input type="hidden" name="back" value="edit" />
                        <button type="submit" className="text-xs font-bold uppercase" style={{ color: "#dc2626" }}>{t("docReject")}</button>
                      </form>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
