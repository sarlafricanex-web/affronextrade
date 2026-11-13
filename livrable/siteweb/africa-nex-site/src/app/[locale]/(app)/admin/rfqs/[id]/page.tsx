import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAdminRfq, listDispatchableProducers } from "@/lib/data/admin-rfqs";
import { rfqAttachments } from "@/lib/data/rfq";
import { destinationLabel, volumeLabel } from "@/lib/rfq-display";
import { countryName } from "@/lib/countries";
import { WILAYAS } from "@/lib/onboarding/reference";
import { isSector } from "@/lib/sectors";
import { StatusBadge } from "@/components/rfq/RfqList";
import { DispatchForm } from "@/components/admin/DispatchForm";
import { closeRfq, qualifyRfq } from "../actions";

export const instant = false;

const HAIR = "#d8cebb";
const caps = { letterSpacing: "0.08em" } as const;

// Fiche d'une demande cote AFRICA NEX : identite de l'acheteur (jamais transmise aux producteurs),
// qualification, brief anonymise et envoi aux producteurs choisis.
export default async function AdminRfqPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ done?: string; count?: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "admin") redirect(`/${locale}/dashboard`);
  const [t, tr, tc, ts, format, rfq, producers, { done, count }] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getTranslations({ locale, namespace: "rfq" }),
    getTranslations({ locale, namespace: "catalog" }),
    getTranslations({ locale, namespace: "sectors" }),
    getFormatter({ locale }),
    getAdminRfq(user.supabase, id),
    listDispatchableProducers(user.supabase),
    searchParams,
  ]);
  if (!rfq) notFound();

  const buyer = rfq.buyer as unknown as { id: string; company_name: string; country: string | null; city: string | null; buyer_type: string | null; website: string | null } | null;
  const source = rfq.source as unknown as { id: string; company_name: string; slug: string } | null;
  const product = rfq.product as unknown as { product_name: string; hs_code: string | null } | null;
  const date = (d: string | null) => (d ? format.dateTime(new Date(`${d.slice(0, 10)}T12:00:00`), { dateStyle: "long" }) : null);
  const files = rfqAttachments(rfq);
  const sentIds = new Set(rfq.dispatches.map((d) => (d.company as unknown as { id: string }).id));
  const dispatchable = ["submitted", "qualified", "dispatched"].includes(rfq.status);
  const volume = volumeLabel(rfq, tr, tc, locale);
  // Brief prerempli SANS l'identite de l'acheteur : AFRICA NEX le relit avant l'envoi.
  const specs = [
    rfq.quantity_mode === "containers" ? `${tr("specQuantity")} : ${volume}` : null,
    rfq.destination_port ? `${tr("port")} : ${rfq.destination_port}` : null,
    rfq.description,
  ].filter(Boolean).join("\n");

  const rows = [
    { label: tr("specQuantity"), value: volume },
    { label: tr("specDestination"), value: destinationLabel(rfq, locale) || null },
    { label: tr("specIncoterm"), value: rfq.incoterm },
    { label: tr("specNeededBy"), value: date(rfq.needed_by) },
    { label: tr("specTargetPrice"), value: rfq.target_unit_price != null ? `${Number(rfq.target_unit_price).toLocaleString(locale)} ${rfq.currency ?? ""}`.trim() : null },
    { label: t("rfqSource"), value: [product?.product_name, source?.company_name].filter(Boolean).join(" · ") || null },
  ];

  return (
    <div className="flex flex-col gap-6">
      {done && <p role="status" className="p-4 font-semibold" style={{ background: "white", borderInlineStart: "4px solid #10b981" }}>{t(`rfqDone_${done}`, { count: Number(count) || 0 })}</p>}

      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <nav className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>
            <Link href="/admin/rfqs" className="hover:underline">{t("rfqsTitle")}</Link>
            <span aria-hidden="true">/</span>
            <span dir="ltr" style={{ color: "#059669" }}>{rfq.reference}</span>
          </nav>
          <h1 className="font-extrabold" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", lineHeight: 1.15 }}>{rfq.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={rfq.status} label={tr(`status_${rfq.status}`)} />
            <span className="text-sm" style={{ color: "var(--muted)" }}>{tr("openedOn", { date: format.dateTime(new Date(rfq.created_at), { dateStyle: "long" }) })}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {rfq.status === "submitted" && (
            <form action={qualifyRfq}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={rfq.id} />
              <button type="submit" className="px-4 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "var(--ink)", color: "white" }}>{t("rfqQualify")}</button>
            </form>
          )}
          {["submitted", "qualified", "dispatched", "offered"].includes(rfq.status) && (
            <form action={closeRfq}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={rfq.id} />
              <button type="submit" className="px-4 py-3 text-xs font-bold uppercase" style={{ ...caps, border: "1px solid #dc2626", color: "#dc2626", background: "white" }}>{t("rfqClose")}</button>
            </form>
          )}
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6" style={{ minWidth: 0 }}>
          <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
            <h2 className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>{t("rfqRequestTitle")}</h2>
            <dl className="grid sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((s) => (
                <div key={s.label} className="p-4" style={{ borderTop: `1px solid ${HAIR}`, borderInlineEnd: `1px solid ${HAIR}` }}>
                  <dt className="text-[10px] font-bold uppercase" style={{ ...caps, color: "var(--muted)" }}>{s.label}</dt>
                  <dd className="mt-1 font-bold" style={{ color: s.value ? "var(--ink)" : "var(--muted)" }}>{s.value ?? tr("notSpecified")}</dd>
                </div>
              ))}
            </dl>
            {(rfq.description || files.length > 0) && (
              <div className="flex flex-col gap-3 p-5" style={{ borderTop: `1px solid ${HAIR}` }}>
                {rfq.description && <p className="whitespace-pre-line text-sm">{rfq.description}</p>}
                {files.map((f, i) => (
                  <a key={f.path} href={`/api/rfq-files/${rfq.id}?i=${i}`} className="w-fit px-3 py-2 text-sm font-semibold underline" style={{ border: `1px solid ${HAIR}` }}>{f.name}</a>
                ))}
                {files.length > 0 && <p className="text-xs" style={{ color: "#c2410c" }}>{t("rfqFilesNotShared")}</p>}
              </div>
            )}
          </section>

          {rfq.dispatches.length > 0 && (
            <section style={{ background: "white", border: `1px solid ${HAIR}` }}>
              <h2 className="px-5 py-3 text-xs font-bold uppercase" style={{ ...caps, background: "#f5efe6", borderBottom: `1px solid ${HAIR}` }}>{t("rfqDispatchesTitle")}</h2>
              <ul>
                {rfq.dispatches.map((d) => {
                  const c = d.company as unknown as { company_name: string; slug: string; claim_status: string; owner_profile_id: string | null };
                  return (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm" style={{ borderTop: `1px solid ${HAIR}` }}>
                      <span className="min-w-0">
                        <span className="block font-semibold">{c.company_name}</span>
                        <span className="block text-xs" dir="ltr" style={{ color: "var(--muted)", textAlign: "start" }}>{d.reference} · {t("rfqRespondBy", { date: date(d.respond_by) ?? "-" })}</span>
                        {!c.owner_profile_id && <span className="block text-xs font-semibold" style={{ color: "#c2410c" }}>{t("rfqOffline")}</span>}
                      </span>
                      <span className="px-2 py-1 text-[10px] font-bold uppercase" style={{ ...caps, background: d.status === "quoted" ? "#ecfdf5" : d.status === "declined" ? "#fef2f2" : "#f5efe6", border: `1px solid ${HAIR}` }}>{t(`dispatch_${d.status}`)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {dispatchable && (
            <section className="p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
              <h2 className="mb-4 font-extrabold" style={{ fontSize: "1.2rem" }}>{rfq.dispatches.length ? t("rfqDispatchMoreTitle") : t("rfqDispatchTitle")}</h2>
              <DispatchForm
                rfqId={rfq.id}
                defaults={{
                  briefTitle: rfq.title,
                  briefSpecs: specs,
                  quantity: rfq.quantity_mode === "units" && rfq.quantity != null ? String(rfq.quantity) : "",
                  unit: rfq.unit ?? "",
                  country: rfq.destination_country ?? "",
                  incoterm: "FOB",
                  neededBy: rfq.needed_by ?? "",
                  respondBy: rfq.defaultRespondBy,
                }}
                preselected={source ? [source.id] : []}
                producers={producers.map((p) => ({
                  id: p.id,
                  name: p.company_name,
                  place: [p.city, WILAYAS.find(([c]) => c === p.wilaya)?.[1]].filter(Boolean).join(", "),
                  sector: p.sector && isSector(p.sector) ? ts(p.sector) : "",
                  claimed: Boolean(p.owner_profile_id),
                  online: p.visibility === "published",
                  sent: sentIds.has(p.id),
                }))}
              />
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4 p-5" style={{ background: "white", border: `1px solid ${HAIR}` }}>
          <h2 className="text-xs font-bold uppercase" style={caps}>{t("rfqBuyerTitle")}</h2>
          <p className="text-xs font-semibold" style={{ color: "#c2410c" }}>{t("rfqBuyerPrivate")}</p>
          <dl className="flex flex-col gap-2 text-sm">
            <div><dt className="text-xs" style={{ color: "var(--muted)" }}>{t("rfqBuyerCompany")}</dt><dd className="font-semibold">{buyer?.company_name ?? "-"}</dd></div>
            <div><dt className="text-xs" style={{ color: "var(--muted)" }}>{t("rfqBuyerPlace")}</dt><dd>{[buyer?.city, buyer?.country ? countryName(buyer.country, locale) : null].filter(Boolean).join(", ") || "-"}</dd></div>
            <div><dt className="text-xs" style={{ color: "var(--muted)" }}>{t("rfqBuyerContact")}</dt><dd>{rfq.buyerProfile?.full_name ?? "-"}</dd></div>
            <div><dt className="text-xs" style={{ color: "var(--muted)" }}>Email</dt><dd dir="ltr" style={{ textAlign: "start" }}>{rfq.buyerProfile?.email ?? "-"}</dd></div>
            <div><dt className="text-xs" style={{ color: "var(--muted)" }}>{t("colPhone")}</dt><dd dir="ltr" style={{ textAlign: "start" }}>{rfq.buyerContact?.contact_phone ?? rfq.buyerProfile?.phone ?? "-"}</dd></div>
            <div><dt className="text-xs" style={{ color: "var(--muted)" }}>WhatsApp</dt><dd dir="ltr" style={{ textAlign: "start" }}>{rfq.buyerContact?.contact_whatsapp ?? rfq.buyerProfile?.whatsapp ?? "-"}</dd></div>
            {buyer?.website && <div><dt className="text-xs" style={{ color: "var(--muted)" }}>{t("rfqBuyerWebsite")}</dt><dd dir="ltr" style={{ textAlign: "start" }}>{buyer.website}</dd></div>}
          </dl>
        </aside>
      </div>
    </div>
  );
}
